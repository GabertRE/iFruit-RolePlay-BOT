const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUser, saveUser, expirationDate } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventaire')
    .setDescription('🎒 Gérer votre inventaire'),

  async execute(interaction) {
    const user = getUser(interaction.user.id);
    const totalPoids = user.inventory.reduce((acc, item) => acc + (item.poids * item.quantite), 0);

    const inventaireText = user.inventory.length > 0
      ? user.inventory.map(i => `• **${i.nom}** x${i.quantite} — ${i.poids}kg/u`).join('\n')
      : '*Votre inventaire est vide.*';

    const embed = new EmbedBuilder()
      .setTitle('🎒 Inventaire — ' + interaction.user.username)
      .setColor(0xF39C12)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '💵 Argent liquide', value: `$${user.cash.toLocaleString()}`, inline: true },
        { name: '⚖️ Poids total', value: `${totalPoids}kg / 50kg`, inline: true },
        { name: '📦 Objets', value: inventaireText },
      )
      .setFooter({ text: 'Sélectionnez une action' })
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId('inventaire_menu')
      .setPlaceholder('Que voulez-vous faire ?')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('📢 Montrer l\'inventaire en public').setValue('montrer').setDescription('Afficher votre inventaire dans le salon'),
        new StringSelectMenuOptionBuilder().setLabel('🤝 Donner un objet').setValue('donner').setDescription('Donner un objet à un autre joueur'),
        new StringSelectMenuOptionBuilder().setLabel('👛 Portefeuille').setValue('portefeuille').setDescription('Voir vos documents (CI, PPA)'),
      );

    await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  },

  async handleSelect(interaction) {
    const action = interaction.values[0];
    const user = getUser(interaction.user.id);

    if (action === 'montrer') {
      const totalPoids = user.inventory.reduce((acc, item) => acc + (item.poids * item.quantite), 0);
      const inventaireText = user.inventory.length > 0
        ? user.inventory.map(i => `• **${i.nom}** x${i.quantite} — ${i.poids}kg/u`).join('\n')
        : '*Inventaire vide.*';

      const embed = new EmbedBuilder()
        .setTitle(`🎒 Inventaire de ${interaction.user.username}`)
        .setColor(0xF39C12)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '💵 Argent liquide', value: `$${user.cash.toLocaleString()}`, inline: true },
          { name: '⚖️ Poids', value: `${totalPoids}kg / 50kg`, inline: true },
          { name: '📦 Objets', value: inventaireText },
        )
        .setTimestamp();

      await interaction.update({ content: '✅ Inventaire affiché en public !', embeds: [], components: [] });
      await interaction.channel.send({ embeds: [embed] });
    }

    if (action === 'donner') {
      if (user.inventory.length === 0) return interaction.update({ content: '❌ Votre inventaire est vide !', embeds: [], components: [] });
      const modal = new ModalBuilder().setCustomId('inventaire_donner').setTitle('🤝 Donner un objet');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom_objet').setLabel('Nom de l\'objet').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quantite').setLabel('Quantité').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 1').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('user_id').setLabel('ID Discord du joueur').setStyle(TextInputStyle.Short).setRequired(true)),
      );
      await interaction.showModal(modal);
    }

    if (action === 'portefeuille') {
      const ci = user.carteIdentite;
      const ppa = user.ppa;

      const ciText = ci
        ? `**${ci.prenom} ${ci.nom}**\nNé(e) le ${ci.dateNaissance}\nNationalité : ${ci.nationalite}\nAdresse : ${ci.adresse}`
        : '*Aucune carte d\'identité.*';

      const ppaText = ppa
        ? `**${ppa.prenom} ${ppa.nom}**\nNé(e) le ${ppa.dateNaissance}\n🔪 Arme blanche : ${ppa.armeBlanche ? '✅' : '❌'}\n🔫 Arme légère : ${ppa.armeLegere ? '✅' : '❌'}\nExpire le : ${ppa.expiration}`
        : '*Aucun permis de port d\'arme.*';

      const embed = new EmbedBuilder()
        .setTitle('👛 Portefeuille — ' + interaction.user.username)
        .setColor(0x8E44AD)
        .addFields(
          { name: '🪪 Carte d\'identité', value: ciText },
          { name: '🔫 Permis Port d\'Arme (PPA)', value: ppaText },
        )
        .setTimestamp();

      const menu = new StringSelectMenuBuilder()
        .setCustomId('inventaire_menu')
        .setPlaceholder('Actions documents')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('📢 Montrer la CI en public').setValue('montrer_ci'),
          new StringSelectMenuOptionBuilder().setLabel('📢 Montrer le PPA en public').setValue('montrer_ppa'),
          new StringSelectMenuOptionBuilder().setLabel('✏️ Modifier mon adresse').setValue('modifier_adresse'),
          new StringSelectMenuOptionBuilder().setLabel('🔙 Retour inventaire').setValue('retour'),
        );

      await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    }

    if (action === 'montrer_ci') {
      const ci = user.carteIdentite;
      if (!ci) return interaction.update({ content: '❌ Vous n\'avez pas de carte d\'identité.', embeds: [], components: [] });

      const embed = new EmbedBuilder()
        .setTitle('🪪 Carte d\'Identité')
        .setColor(0x2980B9)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: 'Nom', value: ci.nom, inline: true },
          { name: 'Prénom', value: ci.prenom, inline: true },
          { name: 'Date de naissance', value: ci.dateNaissance, inline: true },
          { name: 'Nationalité', value: ci.nationalite, inline: true },
          { name: 'Adresse', value: ci.adresse, inline: false },
        )
        .setFooter({ text: 'Document officiel — iFruit RP' })
        .setTimestamp();

      await interaction.update({ content: '✅ CI affichée en public !', embeds: [], components: [] });
      await interaction.channel.send({ embeds: [embed] });
    }

    if (action === 'montrer_ppa') {
      const ppa = user.ppa;
      if (!ppa) return interaction.update({ content: '❌ Vous n\'avez pas de PPA.', embeds: [], components: [] });

      const embed = new EmbedBuilder()
        .setTitle('🔫 Permis de Port d\'Arme')
        .setColor(0xE74C3C)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: 'Nom', value: ppa.nom, inline: true },
          { name: 'Prénom', value: ppa.prenom, inline: true },
          { name: 'Date de naissance', value: ppa.dateNaissance, inline: true },
          { name: '🔪 Arme blanche', value: ppa.armeBlanche ? '✅ Autorisé' : '❌ Non autorisé', inline: true },
          { name: '🔫 Arme légère', value: ppa.armeLegere ? '✅ Autorisé' : '❌ Non autorisé', inline: true },
          { name: '📅 Expiration', value: ppa.expiration, inline: true },
        )
        .setFooter({ text: 'Document officiel — iFruit RP' })
        .setTimestamp();

      await interaction.update({ content: '✅ PPA affiché en public !', embeds: [], components: [] });
      await interaction.channel.send({ embeds: [embed] });
    }

    if (action === 'modifier_adresse') {
      const modal = new ModalBuilder().setCustomId('inventaire_adresse').setTitle('✏️ Modifier mon adresse');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('adresse').setLabel('Nouvelle adresse').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 12 Rue des Lilas, Los Santos').setRequired(true)
      ));
      await interaction.showModal(modal);
    }

    if (action === 'retour') {
      const totalPoids = user.inventory.reduce((acc, item) => acc + (item.poids * item.quantite), 0);
      const inventaireText = user.inventory.length > 0
        ? user.inventory.map(i => `• **${i.nom}** x${i.quantite} — ${i.poids}kg/u`).join('\n')
        : '*Votre inventaire est vide.*';

      const embed = new EmbedBuilder()
        .setTitle('🎒 Inventaire — ' + interaction.user.username)
        .setColor(0xF39C12)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '💵 Argent liquide', value: `$${user.cash.toLocaleString()}`, inline: true },
          { name: '⚖️ Poids total', value: `${totalPoids}kg / 50kg`, inline: true },
          { name: '📦 Objets', value: inventaireText },
        ).setTimestamp();

      const menu = new StringSelectMenuBuilder()
        .setCustomId('inventaire_menu')
        .setPlaceholder('Que voulez-vous faire ?')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('📢 Montrer l\'inventaire en public').setValue('montrer'),
          new StringSelectMenuOptionBuilder().setLabel('🤝 Donner un objet').setValue('donner'),
          new StringSelectMenuOptionBuilder().setLabel('👛 Portefeuille').setValue('portefeuille'),
        );

      await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    }
  },

  async handleModal(interaction) {
    const subAction = interaction.customId.split('_')[1];
    const user = getUser(interaction.user.id);

    if (subAction === 'donner') {
      const nomObjet = interaction.fields.getTextInputValue('nom_objet');
      const quantite = parseInt(interaction.fields.getTextInputValue('quantite'));
      const targetId = interaction.fields.getTextInputValue('user_id').trim();

      const itemIndex = user.inventory.findIndex(i => i.nom.toLowerCase() === nomObjet.toLowerCase());
      if (itemIndex === -1) return interaction.reply({ content: `❌ Objet **${nomObjet}** introuvable.`, ephemeral: true });
      if (isNaN(quantite) || quantite <= 0) return interaction.reply({ content: '❌ Quantité invalide.', ephemeral: true });
      if (user.inventory[itemIndex].quantite < quantite) return interaction.reply({ content: `❌ Vous n'avez que **${user.inventory[itemIndex].quantite}** de cet objet.`, ephemeral: true });

      let targetMember;
      try { targetMember = await interaction.guild.members.fetch(targetId); }
      catch { return interaction.reply({ content: '❌ Joueur introuvable.', ephemeral: true }); }

      const item = { ...user.inventory[itemIndex], quantite };
      user.inventory[itemIndex].quantite -= quantite;
      if (user.inventory[itemIndex].quantite === 0) user.inventory.splice(itemIndex, 1);
      saveUser(interaction.user.id, user);

      const targetUser = getUser(targetId);
      const existingIndex = targetUser.inventory.findIndex(i => i.nom.toLowerCase() === nomObjet.toLowerCase());
      if (existingIndex !== -1) targetUser.inventory[existingIndex].quantite += quantite;
      else targetUser.inventory.push(item);
      saveUser(targetId, targetUser);

      await interaction.reply({ content: `✅ **${quantite}x ${nomObjet}** donné à ${targetMember.user.username}.`, ephemeral: true });
    }

    if (subAction === 'adresse') {
      const adresse = interaction.fields.getTextInputValue('adresse');
      if (!user.carteIdentite) return interaction.reply({ content: '❌ Vous n\'avez pas de carte d\'identité.', ephemeral: true });
      user.carteIdentite.adresse = adresse;
      saveUser(interaction.user.id, user);
      await interaction.reply({ content: `✅ Adresse mise à jour : **${adresse}**`, ephemeral: true });
    }
  }
};
