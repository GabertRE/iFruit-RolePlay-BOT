const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { getItems, saveItems, getUser, saveUser, getConfig } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('objet')
    .setDescription('🛠️ Gérer les objets (Modérateurs uniquement)'),

  async execute(interaction) {
    const config = getConfig();

    // Vérification du rôle modo
    if (config.modRole) {
      const hasRole = interaction.member.roles.cache.has(config.modRole);
      if (!hasRole) {
        return interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', ephemeral: true });
      }
    } else {
      // Si pas encore configuré, seulement les admins peuvent l'utiliser
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: '❌ Le rôle modérateur n\'est pas encore configuré. Utilisez `/modération` pour le définir.', ephemeral: true });
      }
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('objet_menu')
      .setPlaceholder('Que voulez-vous faire ?')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('➕ Créer un objet').setValue('creer').setDescription('Créer un nouvel objet'),
        new StringSelectMenuOptionBuilder().setLabel('🎁 Donner un objet à un joueur').setValue('donner').setDescription('Donner un objet directement à un joueur'),
        new StringSelectMenuOptionBuilder().setLabel('📋 Liste des objets').setValue('liste').setDescription('Voir tous les objets existants'),
        new StringSelectMenuOptionBuilder().setLabel('🗑️ Supprimer un objet').setValue('supprimer').setDescription('Supprimer un objet de la liste'),
      );

    const row = new ActionRowBuilder().addComponents(menu);

    const embed = new EmbedBuilder()
      .setTitle('🛠️ Panneau de gestion — Objets')
      .setColor(0xE74C3C)
      .setDescription('Bienvenue dans le panneau de gestion des objets.\nSélectionnez une action ci-dessous.')
      .setFooter({ text: 'Accès réservé aux modérateurs' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },

  async handleSelect(interaction) {
    const action = interaction.values[0];

    if (action === 'creer') {
      const modal = new ModalBuilder()
        .setCustomId('objet_creer')
        .setTitle('➕ Créer un nouvel objet');
      const inputNom = new TextInputBuilder().setCustomId('nom').setLabel('Nom de l\'objet').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Pistolet .22').setRequired(true);
      const inputDesc = new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setPlaceholder('Ex: Un petit pistolet discret...').setRequired(false);
      const inputPoids = new TextInputBuilder().setCustomId('poids').setLabel('Poids (en kg)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 2').setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(inputNom),
        new ActionRowBuilder().addComponents(inputDesc),
        new ActionRowBuilder().addComponents(inputPoids),
      );
      await interaction.showModal(modal);
    }

    if (action === 'donner') {
      const modal = new ModalBuilder()
        .setCustomId('objet_donner')
        .setTitle('🎁 Donner un objet à un joueur');
      const inputNom = new TextInputBuilder().setCustomId('nom').setLabel('Nom de l\'objet').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Pistolet .22').setRequired(true);
      const inputQte = new TextInputBuilder().setCustomId('quantite').setLabel('Quantité').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 1').setRequired(true);
      const inputUser = new TextInputBuilder().setCustomId('user_id').setLabel('ID Discord du joueur').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 123456789012345678').setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(inputNom),
        new ActionRowBuilder().addComponents(inputQte),
        new ActionRowBuilder().addComponents(inputUser),
      );
      await interaction.showModal(modal);
    }

    if (action === 'liste') {
      const items = getItems();
      const texte = items.length > 0
        ? items.map(i => `• **${i.nom}** — ${i.poids}kg\n  *${i.description || 'Pas de description'}*`).join('\n\n')
        : '*Aucun objet créé pour le moment.*';
      const embed = new EmbedBuilder()
        .setTitle('📋 Liste des objets')
        .setColor(0x3498DB)
        .setDescription(texte)
        .setTimestamp();
      await interaction.update({ embeds: [embed], components: [] });
    }

    if (action === 'supprimer') {
      const modal = new ModalBuilder()
        .setCustomId('objet_supprimer')
        .setTitle('🗑️ Supprimer un objet');
      const inputNom = new TextInputBuilder().setCustomId('nom').setLabel('Nom de l\'objet à supprimer').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Pistolet .22').setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(inputNom));
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
      if (items.find(i => i.nom.toLowerCase() === nom.toLowerCase())) {
        return interaction.reply({ content: `❌ Un objet nommé **${nom}** existe déjà.`, ephemeral: true });
      }

      items.push({ nom, description, poids, creePar: interaction.user.username, creeAt: new Date().toLocaleString('fr-FR') });
      saveItems(items);

      const embed = new EmbedBuilder()
        .setTitle('✅ Objet créé avec succès !')
        .setColor(0x2ECC71)
        .addFields(
          { name: '📦 Nom', value: nom, inline: true },
          { name: '⚖️ Poids', value: `${poids}kg`, inline: true },
          { name: '📝 Description', value: description || '*Aucune*', inline: false },
          { name: '👮 Créé par', value: interaction.user.username, inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subAction === 'donner') {
      const nom = interaction.fields.getTextInputValue('nom');
      const quantite = parseInt(interaction.fields.getTextInputValue('quantite'));
      const targetId = interaction.fields.getTextInputValue('user_id').trim();

      const items = getItems();
      const item = items.find(i => i.nom.toLowerCase() === nom.toLowerCase());
      if (!item) return interaction.reply({ content: `❌ L'objet **${nom}** n'existe pas. Créez-le d'abord.`, ephemeral: true });
      if (isNaN(quantite) || quantite <= 0) return interaction.reply({ content: '❌ Quantité invalide.', ephemeral: true });

      let targetMember;
      try {
        targetMember = await interaction.guild.members.fetch(targetId);
      } catch {
        return interaction.reply({ content: '❌ Joueur introuvable. Vérifiez l\'ID Discord.', ephemeral: true });
      }

      const targetUser = getUser(targetId);
      const existingIndex = targetUser.inventory.findIndex(i => i.nom.toLowerCase() === nom.toLowerCase());
      if (existingIndex !== -1) {
        targetUser.inventory[existingIndex].quantite += quantite;
      } else {
        targetUser.inventory.push({ nom: item.nom, poids: item.poids, quantite });
      }
      saveUser(targetId, targetUser);

      const embed = new EmbedBuilder()
        .setTitle('✅ Objet donné avec succès !')
        .setColor(0x2ECC71)
        .addFields(
          { name: '📦 Objet', value: `${quantite}x ${nom}`, inline: true },
          { name: '👤 Donné à', value: targetMember.user.username, inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
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
