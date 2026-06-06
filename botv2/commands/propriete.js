const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUser, saveUser } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('propriete')
    .setDescription('🏠 Gérer vos propriétés et véhicules'),

  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('propriete_menu')
      .setPlaceholder('Que voulez-vous consulter ?')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🚗 Véhicules').setValue('vehicules').setDescription('Voir vos véhicules'),
        new StringSelectMenuOptionBuilder().setLabel('🏠 Habitations').setValue('habitations').setDescription('Voir vos appartements et maisons'),
      );

    const embed = new EmbedBuilder()
      .setTitle('🏠 Mes Propriétés')
      .setColor(0x1ABC9C)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setDescription('Sélectionnez une catégorie ci-dessous.')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  },

  async handleSelect(interaction) {
    const action = interaction.values[0];
    const user = getUser(interaction.user.id);

    if (action === 'vehicules') {
      if (!user.vehicules || user.vehicules.length === 0) {
        return interaction.update({ content: '❌ Vous n\'avez aucun véhicule enregistré.', embeds: [], components: [] });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('propriete_menu')
        .setPlaceholder('Choisissez un véhicule')
        .addOptions(
          user.vehicules.map(v => new StringSelectMenuOptionBuilder()
            .setLabel(`🚗 ${v.marque} — ${v.plaque}`)
            .setValue(`vehicule_${v.plaque}`)
            .setDescription(v.modele || 'Aucun modèle')
          )
        );

      const embed = new EmbedBuilder()
        .setTitle('🚗 Mes Véhicules')
        .setColor(0x3498DB)
        .setDescription(user.vehicules.map(v => `• **${v.marque} ${v.modele}** — Plaque : \`${v.plaque}\``).join('\n'))
        .setTimestamp();

      await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    }

    if (action === 'habitations') {
      if (!user.habitations || user.habitations.length === 0) {
        return interaction.update({ content: '❌ Vous n\'avez aucune habitation enregistrée.', embeds: [], components: [] });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('propriete_menu')
        .setPlaceholder('Choisissez une habitation')
        .addOptions(
          user.habitations.map(h => new StringSelectMenuOptionBuilder()
            .setLabel(`🏠 ${h.adresse}`)
            .setValue(`habitation_${h.id}`)
            .setDescription(h.type || 'Habitation')
          )
        );

      const embed = new EmbedBuilder()
        .setTitle('🏠 Mes Habitations')
        .setColor(0x9B59B6)
        .setDescription(user.habitations.map(h => `• **${h.type}** — ${h.adresse}`).join('\n'))
        .setTimestamp();

      await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    }

    // Véhicule sélectionné
    if (action.startsWith('vehicule_')) {
      const plaque = action.replace('vehicule_', '');
      const vehicule = user.vehicules.find(v => v.plaque === plaque);
      if (!vehicule) return interaction.update({ content: '❌ Véhicule introuvable.', embeds: [], components: [] });

      const coffreText = vehicule.coffre && vehicule.coffre.length > 0
        ? vehicule.coffre.map(i => `• **${i.nom}** x${i.quantite} — ${i.poids}kg/u`).join('\n')
        : '*Coffre vide.*';

      const embed = new EmbedBuilder()
        .setTitle(`🚗 ${vehicule.marque} ${vehicule.modele}`)
        .setColor(0x3498DB)
        .addFields(
          { name: '🔖 Plaque', value: vehicule.plaque, inline: true },
          { name: '👤 Propriétaire', value: vehicule.proprietaire, inline: true },
          { name: '🛡️ Assurance', value: vehicule.assurance ? `✅ Valide jusqu'au ${vehicule.assurance}` : '❌ Non assurée', inline: false },
          { name: '🔧 Contrôle Technique', value: vehicule.ct ? `✅ Valide jusqu'au ${vehicule.ct}` : '❌ Non valide', inline: false },
          { name: '📦 Coffre', value: coffreText },
        )
        .setTimestamp();

      const menu = new StringSelectMenuBuilder()
        .setCustomId('propriete_menu')
        .setPlaceholder('Actions sur ce véhicule')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('📄 Montrer les papiers en public').setValue(`papiers_${plaque}`),
          new StringSelectMenuOptionBuilder().setLabel('📦 Déposer un objet dans le coffre').setValue(`deposer_coffre_${plaque}`),
          new StringSelectMenuOptionBuilder().setLabel('📤 Retirer un objet du coffre').setValue(`retirer_coffre_${plaque}`),
          new StringSelectMenuOptionBuilder().setLabel('💵 Déposer de l\'argent').setValue(`deposer_argent_vehicule_${plaque}`),
          new StringSelectMenuOptionBuilder().setLabel('🔙 Retour').setValue('vehicules'),
        );

      await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    }

    // Habitation sélectionnée
    if (action.startsWith('habitation_')) {
      const id = action.replace('habitation_', '');
      const habitation = user.habitations.find(h => h.id === id);
      if (!habitation) return interaction.update({ content: '❌ Habitation introuvable.', embeds: [], components: [] });

      const stockText = habitation.stock && habitation.stock.length > 0
        ? habitation.stock.map(i => `• **${i.nom}** x${i.quantite}`).join('\n')
        : '*Aucun objet stocké.*';

      const embed = new EmbedBuilder()
        .setTitle(`🏠 ${habitation.type} — ${habitation.adresse}`)
        .setColor(0x9B59B6)
        .addFields(
          { name: '👤 Propriétaire', value: habitation.proprietaire, inline: true },
          { name: '📦 Stockage', value: stockText },
          { name: '💵 Argent planqué', value: `$${(habitation.argent || 0).toLocaleString()}`, inline: true },
        )
        .setTimestamp();

      const menu = new StringSelectMenuBuilder()
        .setCustomId('propriete_menu')
        .setPlaceholder('Actions sur cette habitation')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('📦 Déposer un objet').setValue(`deposer_hab_${id}`),
          new StringSelectMenuOptionBuilder().setLabel('📤 Retirer un objet').setValue(`retirer_hab_${id}`),
          new StringSelectMenuOptionBuilder().setLabel('💵 Déposer de l\'argent').setValue(`deposer_argent_hab_${id}`),
          new StringSelectMenuOptionBuilder().setLabel('🔙 Retour').setValue('habitations'),
        );

      await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    }

    // Montrer papiers véhicule en public
    if (action.startsWith('papiers_')) {
      const plaque = action.replace('papiers_', '');
      const vehicule = user.vehicules.find(v => v.plaque === plaque);
      if (!vehicule) return interaction.update({ content: '❌ Véhicule introuvable.', embeds: [], components: [] });

      const embed = new EmbedBuilder()
        .setTitle('📄 Papiers du Véhicule')
        .setColor(0x2ECC71)
        .addFields(
          { name: '🔖 Plaque', value: vehicule.plaque, inline: true },
          { name: '🚗 Véhicule', value: `${vehicule.marque} ${vehicule.modele}`, inline: true },
          { name: '👤 Propriétaire', value: vehicule.proprietaire, inline: false },
          { name: '🛡️ Assurance', value: vehicule.assurance ? `✅ Valide jusqu'au ${vehicule.assurance}` : '❌ Non assurée', inline: true },
          { name: '🔧 Contrôle Technique', value: vehicule.ct ? `✅ Valide jusqu'au ${vehicule.ct}` : '❌ Non valide', inline: true },
        )
        .setFooter({ text: 'Document officiel — iFruit RP' })
        .setTimestamp();

      await interaction.update({ content: '✅ Papiers affichés en public !', embeds: [], components: [] });
      await interaction.channel.send({ embeds: [embed] });
    }

    // Déposer objet dans coffre véhicule
    if (action.startsWith('deposer_coffre_')) {
      const plaque = action.replace('deposer_coffre_', '');
      const modal = new ModalBuilder().setCustomId(`propriete_deposcoffre_${plaque}`).setTitle('📦 Déposer dans le coffre');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom').setLabel('Nom de l\'objet').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quantite').setLabel('Quantité').setStyle(TextInputStyle.Short).setPlaceholder('1').setRequired(true)),
      );
      await interaction.showModal(modal);
    }

    // Retirer objet du coffre véhicule
    if (action.startsWith('retirer_coffre_')) {
      const plaque = action.replace('retirer_coffre_', '');
      const modal = new ModalBuilder().setCustomId(`propriete_retircoffre_${plaque}`).setTitle('📤 Retirer du coffre');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom').setLabel('Nom de l\'objet').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quantite').setLabel('Quantité').setStyle(TextInputStyle.Short).setPlaceholder('1').setRequired(true)),
      );
      await interaction.showModal(modal);
    }

    // Déposer argent véhicule
    if (action.startsWith('deposer_argent_vehicule_')) {
      const plaque = action.replace('deposer_argent_vehicule_', '');
      const modal = new ModalBuilder().setCustomId(`propriete_argvehicule_${plaque}`).setTitle('💵 Déposer de l\'argent dans le coffre');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('montant').setLabel('Montant ($)').setStyle(TextInputStyle.Short).setRequired(true)));
      await interaction.showModal(modal);
    }

    // Déposer objet habitation
    if (action.startsWith('deposer_hab_')) {
      const id = action.replace('deposer_hab_', '');
      const modal = new ModalBuilder().setCustomId(`propriete_deposhab_${id}`).setTitle('📦 Déposer dans l\'habitation');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom').setLabel('Nom de l\'objet').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quantite').setLabel('Quantité').setStyle(TextInputStyle.Short).setPlaceholder('1').setRequired(true)),
      );
      await interaction.showModal(modal);
    }

    // Retirer objet habitation
    if (action.startsWith('retirer_hab_')) {
      const id = action.replace('retirer_hab_', '');
      const modal = new ModalBuilder().setCustomId(`propriete_retirhab_${id}`).setTitle('📤 Retirer de l\'habitation');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom').setLabel('Nom de l\'objet').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quantite').setLabel('Quantité').setStyle(TextInputStyle.Short).setPlaceholder('1').setRequired(true)),
      );
      await interaction.showModal(modal);
    }

    // Déposer argent habitation
    if (action.startsWith('deposer_argent_hab_')) {
      const id = action.replace('deposer_argent_hab_', '');
      const modal = new ModalBuilder().setCustomId(`propriete_arghab_${id}`).setTitle('💵 Déposer de l\'argent');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('montant').setLabel('Montant ($)').setStyle(TextInputStyle.Short).setRequired(true)));
      await interaction.showModal(modal);
    }
  },

  async handleModal(interaction) {
    const parts = interaction.customId.split('_');
    const user = getUser(interaction.user.id);

    // Déposer dans coffre véhicule
    if (parts[1] === 'deposcoffre') {
      const plaque = parts[2];
      const nom = interaction.fields.getTextInputValue('nom');
      const quantite = parseInt(interaction.fields.getTextInputValue('quantite'));
      const vIndex = user.vehicules.findIndex(v => v.plaque === plaque);
      if (vIndex === -1) return interaction.reply({ content: '❌ Véhicule introuvable.', ephemeral: true });

      const itemIndex = user.inventory.findIndex(i => i.nom.toLowerCase() === nom.toLowerCase());
      if (itemIndex === -1) return interaction.reply({ content: `❌ Objet **${nom}** introuvable dans votre inventaire.`, ephemeral: true });
      if (user.inventory[itemIndex].quantite < quantite) return interaction.reply({ content: '❌ Quantité insuffisante.', ephemeral: true });

      const item = { ...user.inventory[itemIndex], quantite };
      user.inventory[itemIndex].quantite -= quantite;
      if (user.inventory[itemIndex].quantite === 0) user.inventory.splice(itemIndex, 1);

      if (!user.vehicules[vIndex].coffre) user.vehicules[vIndex].coffre = [];
      const existing = user.vehicules[vIndex].coffre.findIndex(i => i.nom.toLowerCase() === nom.toLowerCase());
      if (existing !== -1) user.vehicules[vIndex].coffre[existing].quantite += quantite;
      else user.vehicules[vIndex].coffre.push(item);

      saveUser(interaction.user.id, user);
      await interaction.reply({ content: `✅ **${quantite}x ${nom}** déposé dans le coffre de la **${plaque}**.`, ephemeral: true });
    }

    // Retirer du coffre véhicule
    if (parts[1] === 'retircoffre') {
      const plaque = parts[2];
      const nom = interaction.fields.getTextInputValue('nom');
      const quantite = parseInt(interaction.fields.getTextInputValue('quantite'));
      const vIndex = user.vehicules.findIndex(v => v.plaque === plaque);
      if (vIndex === -1) return interaction.reply({ content: '❌ Véhicule introuvable.', ephemeral: true });

      const coffre = user.vehicules[vIndex].coffre || [];
      const itemIndex = coffre.findIndex(i => i.nom.toLowerCase() === nom.toLowerCase());
      if (itemIndex === -1) return interaction.reply({ content: `❌ Objet **${nom}** introuvable dans le coffre.`, ephemeral: true });
      if (coffre[itemIndex].quantite < quantite) return interaction.reply({ content: '❌ Quantité insuffisante.', ephemeral: true });

      const item = { ...coffre[itemIndex], quantite };
      coffre[itemIndex].quantite -= quantite;
      if (coffre[itemIndex].quantite === 0) user.vehicules[vIndex].coffre.splice(itemIndex, 1);

      const existing = user.inventory.findIndex(i => i.nom.toLowerCase() === nom.toLowerCase());
      if (existing !== -1) user.inventory[existing].quantite += quantite;
      else user.inventory.push(item);

      saveUser(interaction.user.id, user);
      await interaction.reply({ content: `✅ **${quantite}x ${nom}** retiré du coffre dans votre inventaire.`, ephemeral: true });
    }

    // Argent coffre véhicule
    if (parts[1] === 'argvehicule') {
      const plaque = parts[2];
      const montant = parseInt(interaction.fields.getTextInputValue('montant'));
      if (isNaN(montant) || montant <= 0) return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });
      if (montant > user.cash) return interaction.reply({ content: `❌ Vous n'avez que **$${user.cash}** en liquide.`, ephemeral: true });

      const vIndex = user.vehicules.findIndex(v => v.plaque === plaque);
      if (vIndex === -1) return interaction.reply({ content: '❌ Véhicule introuvable.', ephemeral: true });

      user.cash -= montant;
      user.vehicules[vIndex].argent = (user.vehicules[vIndex].argent || 0) + montant;
      saveUser(interaction.user.id, user);
      await interaction.reply({ content: `✅ **$${montant}** déposé dans le coffre de la **${plaque}**.`, ephemeral: true });
    }

    // Déposer objet habitation
    if (parts[1] === 'deposhab') {
      const id = parts[2];
      const nom = interaction.fields.getTextInputValue('nom');
      const quantite = parseInt(interaction.fields.getTextInputValue('quantite'));
      const hIndex = user.habitations.findIndex(h => h.id === id);
      if (hIndex === -1) return interaction.reply({ content: '❌ Habitation introuvable.', ephemeral: true });

      const itemIndex = user.inventory.findIndex(i => i.nom.toLowerCase() === nom.toLowerCase());
      if (itemIndex === -1) return interaction.reply({ content: `❌ Objet **${nom}** introuvable dans votre inventaire.`, ephemeral: true });
      if (user.inventory[itemIndex].quantite < quantite) return interaction.reply({ content: '❌ Quantité insuffisante.', ephemeral: true });

      const item = { ...user.inventory[itemIndex], quantite };
      user.inventory[itemIndex].quantite -= quantite;
      if (user.inventory[itemIndex].quantite === 0) user.inventory.splice(itemIndex, 1);

      if (!user.habitations[hIndex].stock) user.habitations[hIndex].stock = [];
      const existing = user.habitations[hIndex].stock.findIndex(i => i.nom.toLowerCase() === nom.toLowerCase());
      if (existing !== -1) user.habitations[hIndex].stock[existing].quantite += quantite;
      else user.habitations[hIndex].stock.push(item);

      saveUser(interaction.user.id, user);
      await interaction.reply({ content: `✅ **${quantite}x ${nom}** déposé dans l'habitation.`, ephemeral: true });
    }

    // Retirer objet habitation
    if (parts[1] === 'retirhab') {
      const id = parts[2];
      const nom = interaction.fields.getTextInputValue('nom');
      const quantite = parseInt(interaction.fields.getTextInputValue('quantite'));
      const hIndex = user.habitations.findIndex(h => h.id === id);
      if (hIndex === -1) return interaction.reply({ content: '❌ Habitation introuvable.', ephemeral: true });

      const stock = user.habitations[hIndex].stock || [];
      const itemIndex = stock.findIndex(i => i.nom.toLowerCase() === nom.toLowerCase());
      if (itemIndex === -1) return interaction.reply({ content: `❌ Objet **${nom}** introuvable dans l'habitation.`, ephemeral: true });
      if (stock[itemIndex].quantite < quantite) return interaction.reply({ content: '❌ Quantité insuffisante.', ephemeral: true });

      const item = { ...stock[itemIndex], quantite };
      stock[itemIndex].quantite -= quantite;
      if (stock[itemIndex].quantite === 0) user.habitations[hIndex].stock.splice(itemIndex, 1);

      const existing = user.inventory.findIndex(i => i.nom.toLowerCase() === nom.toLowerCase());
      if (existing !== -1) user.inventory[existing].quantite += quantite;
      else user.inventory.push(item);

      saveUser(interaction.user.id, user);
      await interaction.reply({ content: `✅ **${quantite}x ${nom}** retiré de l'habitation dans votre inventaire.`, ephemeral: true });
    }

    // Argent habitation
    if (parts[1] === 'arghab') {
      const id = parts[2];
      const montant = parseInt(interaction.fields.getTextInputValue('montant'));
      if (isNaN(montant) || montant <= 0) return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });
      if (montant > user.cash) return interaction.reply({ content: `❌ Vous n'avez que **$${user.cash}** en liquide.`, ephemeral: true });

      const hIndex = user.habitations.findIndex(h => h.id === id);
      if (hIndex === -1) return interaction.reply({ content: '❌ Habitation introuvable.', ephemeral: true });

      user.cash -= montant;
      user.habitations[hIndex].argent = (user.habitations[hIndex].argent || 0) + montant;
      saveUser(interaction.user.id, user);
      await interaction.reply({ content: `✅ **$${montant}** déposé dans l'habitation.`, ephemeral: true });
    }
  }
};
