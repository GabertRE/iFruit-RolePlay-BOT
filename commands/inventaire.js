const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUser, saveUser, getItems } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventaire')
    .setDescription('🎒 Gérer votre inventaire'),

  async execute(interaction) {
    const user = getUser(interaction.user.id);
    const totalPoids = user.inventory.reduce((acc, item) => acc + (item.poids * item.quantite), 0);
    const maxPoids = 50;

    const inventaireText = user.inventory.length > 0
      ? user.inventory.map(i => `• **${i.nom}** x${i.quantite} — ${i.poids}kg/u`).join('\n')
      : '*Votre inventaire est vide.*';

    const embed = new EmbedBuilder()
      .setTitle('🎒 Inventaire — ' + interaction.user.username)
      .setColor(0xF39C12)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setDescription(inventaireText)
      .addFields(
        { name: '⚖️ Poids total', value: `${totalPoids}kg / ${maxPoids}kg`, inline: true },
      )
      .setFooter({ text: 'Sélectionnez une action' })
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId('inventaire_menu')
      .setPlaceholder('Que voulez-vous faire ?')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🚗 Envoyer dans le véhicule').setValue('vehicule').setDescription('Transférer un objet dans votre véhicule'),
        new StringSelectMenuOptionBuilder().setLabel('🏠 Envoyer dans l\'appart').setValue('appart').setDescription('Transférer un objet dans votre appartement'),
        new StringSelectMenuOptionBuilder().setLabel('🤝 Donner à quelqu\'un').setValue('donner').setDescription('Donner un objet à un autre joueur'),
        new StringSelectMenuOptionBuilder().setLabel('🚗 Voir véhicule').setValue('voir_vehicule').setDescription('Voir le contenu de votre véhicule'),
        new StringSelectMenuOptionBuilder().setLabel('🏠 Voir appartement').setValue('voir_appart').setDescription('Voir le contenu de votre appartement'),
      );

    const row = new ActionRowBuilder().addComponents(menu);
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },

  async handleSelect(interaction) {
    const action = interaction.values[0];
    const user = getUser(interaction.user.id);

    if (action === 'voir_vehicule') {
      const texte = user.vehicle.length > 0
        ? user.vehicle.map(i => `• **${i.nom}** x${i.quantite} — ${i.poids}kg/u`).join('\n')
        : '*Votre véhicule est vide.*';
      const embed = new EmbedBuilder()
        .setTitle('🚗 Coffre du véhicule')
        .setColor(0x3498DB)
        .setDescription(texte)
        .setTimestamp();
      return interaction.update({ embeds: [embed], components: [] });
    }

    if (action === 'voir_appart') {
      const texte = user.appartement.length > 0
        ? user.appartement.map(i => `• **${i.nom}** x${i.quantite} — ${i.poids}kg/u`).join('\n')
        : '*Votre appartement est vide.*';
      const embed = new EmbedBuilder()
        .setTitle('🏠 Appartement')
        .setColor(0x9B59B6)
        .setDescription(texte)
        .setTimestamp();
      return interaction.update({ embeds: [embed], components: [] });
    }

    if (user.inventory.length === 0) {
      return interaction.update({ content: '❌ Votre inventaire est vide !', embeds: [], components: [] });
    }

    if (action === 'vehicule' || action === 'appart') {
      const modal = new ModalBuilder()
        .setCustomId(`inventaire_transfer_${action}`)
        .setTitle(action === 'vehicule' ? '🚗 Envoyer dans le véhicule' : '🏠 Envoyer dans l\'appart');
      const inputNom = new TextInputBuilder()
        .setCustomId('nom_objet')
        .setLabel('Nom de l\'objet')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Pistolet')
        .setRequired(true);
      const inputQte = new TextInputBuilder()
        .setCustomId('quantite')
        .setLabel('Quantité')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 1')
        .setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(inputNom),
        new ActionRowBuilder().addComponents(inputQte)
      );
      await interaction.showModal(modal);
    }

    if (action === 'donner') {
      const modal = new ModalBuilder()
        .setCustomId('inventaire_donner')
        .setTitle('🤝 Donner un objet');
      const inputNom = new TextInputBuilder()
        .setCustomId('nom_objet')
        .setLabel('Nom de l\'objet')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Pistolet')
        .setRequired(true);
      const inputQte = new TextInputBuilder()
        .setCustomId('quantite')
        .setLabel('Quantité')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 1')
        .setRequired(true);
      const inputUser = new TextInputBuilder()
        .setCustomId('user_id')
        .setLabel('ID Discord du joueur')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 123456789012345678')
        .setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(inputNom),
        new ActionRowBuilder().addComponents(inputQte),
        new ActionRowBuilder().addComponents(inputUser)
      );
      await interaction.showModal(modal);
    }
  },

  async handleModal(interaction) {
    const parts = interaction.customId.split('_');
    const user = getUser(interaction.user.id);

    // Transfer vers véhicule ou appart
    if (parts[1] === 'transfer') {
      const destination = parts[2];
      const nomObjet = interaction.fields.getTextInputValue('nom_objet');
      const quantite = parseInt(interaction.fields.getTextInputValue('quantite'));

      const itemIndex = user.inventory.findIndex(i => i.nom.toLowerCase() === nomObjet.toLowerCase());
      if (itemIndex === -1) return interaction.reply({ content: `❌ Objet **${nomObjet}** introuvable dans votre inventaire.`, ephemeral: true });
      if (isNaN(quantite) || quantite <= 0) return interaction.reply({ content: '❌ Quantité invalide.', ephemeral: true });
      if (user.inventory[itemIndex].quantite < quantite) return interaction.reply({ content: `❌ Vous n'avez que **${user.inventory[itemIndex].quantite}** de cet objet.`, ephemeral: true });

      const item = { ...user.inventory[itemIndex], quantite };
      user.inventory[itemIndex].quantite -= quantite;
      if (user.inventory[itemIndex].quantite === 0) user.inventory.splice(itemIndex, 1);

      const dest = destination === 'vehicule' ? user.vehicle : user.appartement;
      const existingIndex = dest.findIndex(i => i.nom.toLowerCase() === nomObjet.toLowerCase());
      if (existingIndex !== -1) {
        dest[existingIndex].quantite += quantite;
      } else {
        dest.push(item);
      }

      saveUser(interaction.user.id, user);
      const icon = destination === 'vehicule' ? '🚗' : '🏠';
      const label = destination === 'vehicule' ? 'véhicule' : 'appartement';
      await interaction.reply({ content: `✅ **${quantite}x ${nomObjet}** transféré dans votre ${icon} ${label}.`, ephemeral: true });
    }

    // Donner à quelqu'un
    if (parts[1] === 'donner') {
      const nomObjet = interaction.fields.getTextInputValue('nom_objet');
      const quantite = parseInt(interaction.fields.getTextInputValue('quantite'));
      const targetId = interaction.fields.getTextInputValue('user_id').trim();

      const itemIndex = user.inventory.findIndex(i => i.nom.toLowerCase() === nomObjet.toLowerCase());
      if (itemIndex === -1) return interaction.reply({ content: `❌ Objet **${nomObjet}** introuvable.`, ephemeral: true });
      if (isNaN(quantite) || quantite <= 0) return interaction.reply({ content: '❌ Quantité invalide.', ephemeral: true });
      if (user.inventory[itemIndex].quantite < quantite) return interaction.reply({ content: `❌ Vous n'avez que **${user.inventory[itemIndex].quantite}** de cet objet.`, ephemeral: true });

      let targetMember;
      try {
        targetMember = await interaction.guild.members.fetch(targetId);
      } catch {
        return interaction.reply({ content: '❌ Joueur introuvable. Vérifiez l\'ID Discord.', ephemeral: true });
      }

      const item = { ...user.inventory[itemIndex], quantite };
      user.inventory[itemIndex].quantite -= quantite;
      if (user.inventory[itemIndex].quantite === 0) user.inventory.splice(itemIndex, 1);
      saveUser(interaction.user.id, user);

      const targetUser = getUser(targetId);
      const existingIndex = targetUser.inventory.findIndex(i => i.nom.toLowerCase() === nomObjet.toLowerCase());
      if (existingIndex !== -1) {
        targetUser.inventory[existingIndex].quantite += quantite;
      } else {
        targetUser.inventory.push(item);
      }
      saveUser(targetId, targetUser);

      await interaction.reply({ content: `✅ Vous avez donné **${quantite}x ${nomObjet}** à ${targetMember.user.username}.`, ephemeral: true });
    }
  }
};
