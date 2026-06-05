const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUser, saveUser, addHistory } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banque')
    .setDescription('💳 Accéder à votre compte bancaire'),

  async execute(interaction) {
    const user = getUser(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('🏦 Banque Nationale — iFruit')
      .setColor(0x2ECC71)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '💵 Argent liquide', value: `$${user.cash.toLocaleString()}`, inline: true },
        { name: '🏦 Compte bancaire', value: `$${user.bank.toLocaleString()}`, inline: true },
        { name: '💰 Total', value: `$${(user.cash + user.bank).toLocaleString()}`, inline: true },
      )
      .setFooter({ text: 'Sélectionnez une action ci-dessous' })
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId('banque_menu')
      .setPlaceholder('Que voulez-vous faire ?')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('💰 Déposer de l\'argent').setValue('deposer').setDescription('Déposer du liquide en banque'),
        new StringSelectMenuOptionBuilder().setLabel('💸 Retirer de l\'argent').setValue('retirer').setDescription('Retirer de l\'argent de la banque'),
        new StringSelectMenuOptionBuilder().setLabel('📜 Historique').setValue('historique').setDescription('Voir vos 10 dernières transactions'),
      );

    const row = new ActionRowBuilder().addComponents(menu);
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },

  async handleSelect(interaction) {
    const action = interaction.values[0];

    if (action === 'deposer') {
      const modal = new ModalBuilder()
        .setCustomId('banque_deposer')
        .setTitle('💰 Déposer de l\'argent');
      const input = new TextInputBuilder()
        .setCustomId('montant')
        .setLabel('Montant à déposer ($)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 500')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (action === 'retirer') {
      const modal = new ModalBuilder()
        .setCustomId('banque_retirer')
        .setTitle('💸 Retirer de l\'argent');
      const input = new TextInputBuilder()
        .setCustomId('montant')
        .setLabel('Montant à retirer ($)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 500')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (action === 'historique') {
      const user = getUser(interaction.user.id);
      const history = user.history.length > 0
        ? user.history.map(h => `\`${h.date}\` — ${h.action} **$${h.amount}**`).join('\n')
        : 'Aucune transaction pour le moment.';

      const embed = new EmbedBuilder()
        .setTitle('📜 Historique des transactions')
        .setColor(0x3498DB)
        .setDescription(history)
        .setTimestamp();

      await interaction.update({ embeds: [embed], components: [] });
    }
  },

  async handleModal(interaction) {
    const subAction = interaction.customId.split('_')[1];
    const montant = parseInt(interaction.fields.getTextInputValue('montant'));
    const user = getUser(interaction.user.id);

    if (isNaN(montant) || montant <= 0) {
      return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });
    }

    if (subAction === 'deposer') {
      if (montant > user.cash) {
        return interaction.reply({ content: `❌ Vous n'avez que **$${user.cash}** en liquide.`, ephemeral: true });
      }
      user.cash -= montant;
      user.bank += montant;
      saveUser(interaction.user.id, user);
      addHistory(interaction.user.id, '💰 Dépôt', montant);

      const embed = new EmbedBuilder()
        .setTitle('✅ Dépôt effectué')
        .setColor(0x2ECC71)
        .addFields(
          { name: '💰 Montant déposé', value: `$${montant.toLocaleString()}`, inline: true },
          { name: '💵 Nouveau liquide', value: `$${user.cash.toLocaleString()}`, inline: true },
          { name: '🏦 Nouveau solde banque', value: `$${user.bank.toLocaleString()}`, inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subAction === 'retirer') {
      if (montant > user.bank) {
        return interaction.reply({ content: `❌ Vous n'avez que **$${user.bank}** en banque.`, ephemeral: true });
      }
      user.bank -= montant;
      user.cash += montant;
      saveUser(interaction.user.id, user);
      addHistory(interaction.user.id, '💸 Retrait', montant);

      const embed = new EmbedBuilder()
        .setTitle('✅ Retrait effectué')
        .setColor(0xE74C3C)
        .addFields(
          { name: '💸 Montant retiré', value: `$${montant.toLocaleString()}`, inline: true },
          { name: '💵 Nouveau liquide', value: `$${user.cash.toLocaleString()}`, inline: true },
          { name: '🏦 Nouveau solde banque', value: `$${user.bank.toLocaleString()}`, inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
