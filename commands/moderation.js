const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getConfig, saveConfig } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('⚙️ Panneau de configuration (Administrateurs uniquement)'),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ Vous devez être **Administrateur** pour utiliser cette commande.', ephemeral: true });
    }

    const config = getConfig();
    const modRole = config.modRole ? `<@&${config.modRole}>` : '*Non défini*';

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Panneau de Modération')
      .setColor(0xE74C3C)
      .setDescription('Configurez les rôles et paramètres de votre serveur RP.')
      .addFields(
        { name: '👮 Rôle Modérateur actuel', value: modRole, inline: true },
      )
      .setFooter({ text: 'Accès réservé aux administrateurs' })
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId('moderation_menu')
      .setPlaceholder('Que voulez-vous configurer ?')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('👮 Définir le rôle Modérateur').setValue('set_modo').setDescription('Définir quel rôle peut créer des objets'),
        new StringSelectMenuOptionBuilder().setLabel('💵 Donner de l\'argent à un joueur').setValue('give_money').setDescription('Ajouter de l\'argent au compte d\'un joueur'),
        new StringSelectMenuOptionBuilder().setLabel('💸 Retirer de l\'argent à un joueur').setValue('remove_money').setDescription('Retirer de l\'argent du compte d\'un joueur'),
        new StringSelectMenuOptionBuilder().setLabel('🔄 Réinitialiser un joueur').setValue('reset_player').setDescription('Remettre à zéro le compte d\'un joueur'),
      );

    const row = new ActionRowBuilder().addComponents(menu);
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },

  async handleSelect(interaction) {
    const action = interaction.values[0];

    if (action === 'set_modo') {
      const modal = new ModalBuilder()
        .setCustomId('moderation_setmodo')
        .setTitle('👮 Définir le rôle Modérateur');
      const input = new TextInputBuilder()
        .setCustomId('role_id')
        .setLabel('ID du rôle Modérateur')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Clic droit sur le rôle → Copier l\'ID')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (action === 'give_money') {
      const modal = new ModalBuilder()
        .setCustomId('moderation_givemoney')
        .setTitle('💵 Donner de l\'argent');
      const inputUser = new TextInputBuilder().setCustomId('user_id').setLabel('ID Discord du joueur').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 123456789012345678').setRequired(true);
      const inputMontant = new TextInputBuilder().setCustomId('montant').setLabel('Montant ($)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 1000').setRequired(true);
      const inputType = new TextInputBuilder().setCustomId('type').setLabel('Type: "cash" ou "banque"').setStyle(TextInputStyle.Short).setPlaceholder('cash').setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(inputUser),
        new ActionRowBuilder().addComponents(inputMontant),
        new ActionRowBuilder().addComponents(inputType),
      );
      await interaction.showModal(modal);
    }

    if (action === 'remove_money') {
      const modal = new ModalBuilder()
        .setCustomId('moderation_removemoney')
        .setTitle('💸 Retirer de l\'argent');
      const inputUser = new TextInputBuilder().setCustomId('user_id').setLabel('ID Discord du joueur').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 123456789012345678').setRequired(true);
      const inputMontant = new TextInputBuilder().setCustomId('montant').setLabel('Montant ($)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 1000').setRequired(true);
      const inputType = new TextInputBuilder().setCustomId('type').setLabel('Type: "cash" ou "banque"').setStyle(TextInputStyle.Short).setPlaceholder('cash').setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(inputUser),
        new ActionRowBuilder().addComponents(inputMontant),
        new ActionRowBuilder().addComponents(inputType),
      );
      await interaction.showModal(modal);
    }

    if (action === 'reset_player') {
      const modal = new ModalBuilder()
        .setCustomId('moderation_reset')
        .setTitle('🔄 Réinitialiser un joueur');
      const input = new TextInputBuilder().setCustomId('user_id').setLabel('ID Discord du joueur').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 123456789012345678').setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },

  async handleModal(interaction) {
    const subAction = interaction.customId.split('_')[1];
    const { getUser, saveUser, addHistory } = require('../db');

    if (subAction === 'setmodo') {
      const roleId = interaction.fields.getTextInputValue('role_id').trim();
      let role;
      try {
        role = await interaction.guild.roles.fetch(roleId);
      } catch {
        return interaction.reply({ content: '❌ Rôle introuvable. Vérifiez l\'ID.', ephemeral: true });
      }
      const config = getConfig();
      config.modRole = roleId;
      saveConfig(config);
      await interaction.reply({ content: `✅ Rôle modérateur défini sur **${role.name}**. Ce rôle peut désormais créer des objets.`, ephemeral: true });
    }

    if (subAction === 'givemoney') {
      const targetId = interaction.fields.getTextInputValue('user_id').trim();
      const montant = parseInt(interaction.fields.getTextInputValue('montant'));
      const type = interaction.fields.getTextInputValue('type').toLowerCase().trim();

      if (isNaN(montant) || montant <= 0) return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });
      if (type !== 'cash' && type !== 'banque') return interaction.reply({ content: '❌ Type invalide. Mettez "cash" ou "banque".', ephemeral: true });

      let targetMember;
      try { targetMember = await interaction.guild.members.fetch(targetId); } catch { return interaction.reply({ content: '❌ Joueur introuvable.', ephemeral: true }); }

      const user = getUser(targetId);
      if (type === 'cash') user.cash += montant;
      else user.bank += montant;
      saveUser(targetId, user);
      addHistory(targetId, `💵 Don admin (${type})`, montant);

      await interaction.reply({ content: `✅ **$${montant}** ajoutés au compte **${type}** de ${targetMember.user.username}.`, ephemeral: true });
    }

    if (subAction === 'removemoney') {
      const targetId = interaction.fields.getTextInputValue('user_id').trim();
      const montant = parseInt(interaction.fields.getTextInputValue('montant'));
      const type = interaction.fields.getTextInputValue('type').toLowerCase().trim();

      if (isNaN(montant) || montant <= 0) return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });
      if (type !== 'cash' && type !== 'banque') return interaction.reply({ content: '❌ Type invalide. Mettez "cash" ou "banque".', ephemeral: true });

      let targetMember;
      try { targetMember = await interaction.guild.members.fetch(targetId); } catch { return interaction.reply({ content: '❌ Joueur introuvable.', ephemeral: true }); }

      const user = getUser(targetId);
      if (type === 'cash') user.cash = Math.max(0, user.cash - montant);
      else user.bank = Math.max(0, user.bank - montant);
      saveUser(targetId, user);
      addHistory(targetId, `💸 Retrait admin (${type})`, montant);

      await interaction.reply({ content: `✅ **$${montant}** retirés du compte **${type}** de ${targetMember.user.username}.`, ephemeral: true });
    }

    if (subAction === 'reset') {
      const targetId = interaction.fields.getTextInputValue('user_id').trim();
      let targetMember;
      try { targetMember = await interaction.guild.members.fetch(targetId); } catch { return interaction.reply({ content: '❌ Joueur introuvable.', ephemeral: true }); }

      saveUser(targetId, { userId: targetId, cash: 500, bank: 0, inventory: [], vehicle: [], appartement: [], history: [] });
      await interaction.reply({ content: `✅ Le compte de **${targetMember.user.username}** a été réinitialisé. (500$ de départ)`, ephemeral: true });
    }
  }
};
