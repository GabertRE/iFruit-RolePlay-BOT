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
        new StringSelectMenuOptionBuilder().setLabel('💰 Déposer').setValue('deposer').setDescription('Déposer du liquide en banque'),
        new StringSelectMenuOptionBuilder().setLabel('💸 Retirer').setValue('retirer').setDescription('Retirer de la banque en liquide'),
        new StringSelectMenuOptionBuilder().setLabel('🔄 Virement Liquide → Banque').setValue('virement_lb').setDescription('Virer du liquide vers la banque'),
        new StringSelectMenuOptionBuilder().setLabel('🔄 Virement Banque → Liquide').setValue('virement_bl').setDescription('Virer de la banque vers le liquide'),
        new StringSelectMenuOptionBuilder().setLabel('📜 Historique').setValue('historique').setDescription('Voir vos 10 dernières transactions'),
      );

    await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  },

  async handleSelect(interaction) {
    const action = interaction.values[0];

    if (action === 'historique') {
      const user = getUser(interaction.user.id);
      const history = user.history.length > 0
        ? user.history.map(h => `\`${h.date}\` — ${h.action} **$${h.amount}**`).join('\n')
        : 'Aucune transaction pour le moment.';
      return interaction.update({ embeds: [new EmbedBuilder().setTitle('📜 Historique').setColor(0x3498DB).setDescription(history).setTimestamp()], components: [] });
    }

    const titles = {
      deposer: '💰 Déposer de l\'argent',
      retirer: '💸 Retirer de l\'argent',
      virement_lb: '🔄 Virement Liquide → Banque',
      virement_bl: '🔄 Virement Banque → Liquide',
    };

    const modal = new ModalBuilder().setCustomId(`banque_${action}`).setTitle(titles[action]);
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('montant').setLabel('Montant ($)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 500').setRequired(true)
    ));
    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const subAction = interaction.customId.split('_').slice(1).join('_');
    const montant = parseInt(interaction.fields.getTextInputValue('montant'));
    const user = getUser(interaction.user.id);

    if (isNaN(montant) || montant <= 0) return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });

    let title, color;

    if (subAction === 'deposer') {
      if (montant > user.cash) return interaction.reply({ content: `❌ Vous n'avez que **$${user.cash}** en liquide.`, ephemeral: true });
      user.cash -= montant; user.bank += montant;
      title = '✅ Dépôt effectué'; color = 0x2ECC71;
      addHistory(interaction.user.id, '💰 Dépôt', montant);
    } else if (subAction === 'retirer') {
      if (montant > user.bank) return interaction.reply({ content: `❌ Vous n'avez que **$${user.bank}** en banque.`, ephemeral: true });
      user.bank -= montant; user.cash += montant;
      title = '✅ Retrait effectué'; color = 0xE74C3C;
      addHistory(interaction.user.id, '💸 Retrait', montant);
    } else if (subAction === 'virement_lb') {
      if (montant > user.cash) return interaction.reply({ content: `❌ Vous n'avez que **$${user.cash}** en liquide.`, ephemeral: true });
      user.cash -= montant; user.bank += montant;
      title = '✅ Virement effectué (Liquide → Banque)'; color = 0x3498DB;
      addHistory(interaction.user.id, '🔄 Virement L→B', montant);
    } else if (subAction === 'virement_bl') {
      if (montant > user.bank) return interaction.reply({ content: `❌ Vous n'avez que **$${user.bank}** en banque.`, ephemeral: true });
      user.bank -= montant; user.cash += montant;
      title = '✅ Virement effectué (Banque → Liquide)'; color = 0x9B59B6;
      addHistory(interaction.user.id, '🔄 Virement B→L', montant);
    }

    saveUser(interaction.user.id, user);
    const embed = new EmbedBuilder().setTitle(title).setColor(color)
      .addFields(
        { name: '💸 Montant', value: `$${montant.toLocaleString()}`, inline: true },
        { name: '💵 Liquide', value: `$${user.cash.toLocaleString()}`, inline: true },
        { name: '🏦 Banque', value: `$${user.bank.toLocaleString()}`, inline: true },
      ).setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
