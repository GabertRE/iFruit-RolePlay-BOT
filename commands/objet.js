const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getItems, saveItems, getUser, saveUser, getConfig, hasModRole } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('objet')
    .setDescription('🛠️ Gérer les objets (Modérateurs uniquement)'),

  async execute(interaction) {
    const config = getConfig();
    if (!hasModRole(interaction.member, config)) {
      return interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', ephemeral: true });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('objet_menu')
      .setPlaceholder('Que voulez-vous faire ?')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('➕ Créer un objet').setValue('creer'),
        new StringSelectMenuOptionBuilder().setLabel('📋 Liste des objets').setValue('liste'),
        new StringSelectMenuOptionBuilder().setLabel('🗑️ Supprimer un objet').setValue('supprimer'),
      );

    const embed = new EmbedBuilder()
      .setTitle('🛠️ Gestion des Objets')
      .setColor(0xE74C3C)
      .setDescription('Panneau de gestion des objets.')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  },

  async handleSelect(interaction) {
    const action = interaction.values[0];

    if (action === 'creer') {
      const modal = new ModalBuilder().setCustomId('objet_creer').setTitle('➕ Créer un objet');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom').setLabel('Nom').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('poids').setLabel('Poids (kg)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 2').setRequired(true)),
      );
      await interaction.showModal(modal);
    }

    if (action === 'liste') {
      const items = getItems();
      const texte = items.length > 0
        ? items.map(i => `• **${i.nom}** — ${i.poids}kg — *${i.description || 'Pas de description'}*`).join('\n')
        : '*Aucun objet créé.*';
      await interaction.update({ embeds: [new EmbedBuilder().setTitle('📋 Liste des objets').setColor(0x3498DB).setDescription(texte).setTimestamp()], components: [] });
    }

    if (action === 'supprimer') {
      const modal = new ModalBuilder().setCustomId('objet_supprimer').setTitle('🗑️ Supprimer un objet');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom').setLabel('Nom de l\'objet').setStyle(TextInputStyle.Short).setRequired(true)));
      await interaction.showModal(modal);
    }
  },

  async handleModal(interaction) {
    const subAction = interaction.customId.split('_')[1];

    if (subAction === 'creer') {
      const nom = interaction.fields.getTextInputValue('nom');
      const description = interaction.fields.getTextInputValue('description') || '';
      const poids = parseFloat(interaction.fields.getTextInputValue('poids'));
      if (isNaN(poids) || poids < 0) return interaction.reply({ content: '❌ Poids invalide.', ephemeral: true });
      const items = getItems();
      if (items.find(i => i.nom.toLowerCase() === nom.toLowerCase())) return interaction.reply({ content: `❌ Un objet **${nom}** existe déjà.`, ephemeral: true });
      items.push({ nom, description, poids, creePar: interaction.user.username });
      saveItems(items);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ Objet créé !').setColor(0x2ECC71).addFields({ name: '📦 Nom', value: nom, inline: true }, { name: '⚖️ Poids', value: `${poids}kg`, inline: true }, { name: '📝 Description', value: description || '*Aucune*' }).setTimestamp()], ephemeral: true });
    }

    if (subAction === 'supprimer') {
      const nom = interaction.fields.getTextInputValue('nom');
      const items = getItems();
      const index = items.findIndex(i => i.nom.toLowerCase() === nom.toLowerCase());
      if (index === -1) return interaction.reply({ content: `❌ Objet **${nom}** introuvable.`, ephemeral: true });
      items.splice(index, 1);
      saveItems(items);
      await interaction.reply({ content: `✅ Objet **${nom}** supprimé.`, ephemeral: true });
    }
  }
};
