const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getConfig, saveConfig, getUser, saveUser, addHistory, hasModRole, expirationDate } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('⚙️ Panneau de modération'),

  async execute(interaction) {
    const config = getConfig();
    const isAdmin = interaction.member.permissions.has('Administrator');
    const isModo = hasModRole(interaction.member, config);

    if (!isModo) return interaction.reply({ content: '❌ Vous n\'avez pas la permission.', ephemeral: true });

    const options = [
      new StringSelectMenuOptionBuilder().setLabel('💵 Donner de l\'argent').setValue('give_money'),
      new StringSelectMenuOptionBuilder().setLabel('💸 Retirer de l\'argent').setValue('remove_money'),
      new StringSelectMenuOptionBuilder().setLabel('📦 Donner un objet').setValue('give_item'),
      new StringSelectMenuOptionBuilder().setLabel('🪪 Créer une Carte d\'identité').setValue('creer_ci'),
      new StringSelectMenuOptionBuilder().setLabel('🔫 Créer un PPA').setValue('creer_ppa'),
      new StringSelectMenuOptionBuilder().setLabel('🚗 Ajouter un véhicule').setValue('creer_vehicule'),
      new StringSelectMenuOptionBuilder().setLabel('🏠 Ajouter une habitation').setValue('creer_habitation'),
      new StringSelectMenuOptionBuilder().setLabel('🔄 Réinitialiser un joueur').setValue('reset_player'),
    ];

    if (isAdmin) {
      options.push(new StringSelectMenuOptionBuilder().setLabel('👮 Définir le rôle Modérateur').setValue('set_modo'));
    }

    const menu = new StringSelectMenuBuilder().setCustomId('moderation_menu').setPlaceholder('Choisissez une action').addOptions(options);

    const modRole = config.modRole ? `<@&${config.modRole}>` : '*Non défini*';
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Panneau de Modération')
      .setColor(0xE74C3C)
      .addFields({ name: '👮 Rôle Modérateur', value: modRole, inline: true })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  },

  async handleSelect(interaction) {
    const action = interaction.values[0];

    const modals = {
      give_money: { id: 'moderation_givemoney', title: '💵 Donner de l\'argent', fields: ['user_mention', 'montant', 'type'] },
      remove_money: { id: 'moderation_removemoney', title: '💸 Retirer de l\'argent', fields: ['user_mention', 'montant', 'type'] },
      give_item: { id: 'moderation_giveitem', title: '📦 Donner un objet', fields: ['user_mention', 'nom_objet', 'quantite'] },
      reset_player: { id: 'moderation_reset', title: '🔄 Réinitialiser un joueur', fields: ['user_mention'] },
      set_modo: { id: 'moderation_setmodo', title: '👮 Définir le rôle Modérateur', fields: ['role_mention'] },
      creer_ci: { id: 'moderation_creerci', title: '🪪 Créer une Carte d\'identité', fields: ['user_mention', 'ci_info'] },
      creer_ppa: { id: 'moderation_creerppa', title: '🔫 Créer un PPA', fields: ['user_mention', 'ppa_info'] },
      creer_vehicule: { id: 'moderation_creervehicule', title: '🚗 Ajouter un véhicule', fields: ['user_mention', 'vehicule_info'] },
      creer_habitation: { id: 'moderation_creerhabitation', title: '🏠 Ajouter une habitation', fields: ['user_mention', 'habitation_info'] },
    };

    const cfg = modals[action];
    if (!cfg) return;

    const modal = new ModalBuilder().setCustomId(cfg.id).setTitle(cfg.title);

    const fieldBuilders = {
      user_mention: () => new TextInputBuilder().setCustomId('user_mention').setLabel('Mentionner le joueur (@pseudo)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: @JohnDoe ou ID').setRequired(true),
      montant: () => new TextInputBuilder().setCustomId('montant').setLabel('Montant ($)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 1000').setRequired(true),
      type: () => new TextInputBuilder().setCustomId('type').setLabel('Type: "cash" ou "banque"').setStyle(TextInputStyle.Short).setPlaceholder('cash').setRequired(true),
      nom_objet: () => new TextInputBuilder().setCustomId('nom_objet').setLabel('Nom de l\'objet').setStyle(TextInputStyle.Short).setRequired(true),
      quantite: () => new TextInputBuilder().setCustomId('quantite').setLabel('Quantité').setStyle(TextInputStyle.Short).setPlaceholder('1').setRequired(true),
      role_mention: () => new TextInputBuilder().setCustomId('role_mention').setLabel('Mentionner le rôle (@role) ou ID').setStyle(TextInputStyle.Short).setRequired(true),
      ci_info: () => new TextInputBuilder().setCustomId('ci_info').setLabel('Nom / Prénom / Naissance / Nationalité / Adresse').setStyle(TextInputStyle.Paragraph).setPlaceholder('Dupont / Jean / 01/01/1990 / Française / 12 Rue des Lilas').setRequired(true),
      ppa_info: () => new TextInputBuilder().setCustomId('ppa_info').setLabel('Nom / Prénom / Naissance / ArmeBlanche / ArmeLegere').setStyle(TextInputStyle.Paragraph).setPlaceholder('Dupont / Jean / 01/01/1990 / oui / non').setRequired(true),
      vehicule_info: () => new TextInputBuilder().setCustomId('vehicule_info').setLabel('Marque / Modèle / Plaque / Propriétaire').setStyle(TextInputStyle.Paragraph).setPlaceholder('Toyota / Supra / AA-123-BB / Jean Dupont').setRequired(true),
      habitation_info: () => new TextInputBuilder().setCustomId('habitation_info').setLabel('Type / Adresse / Propriétaire').setStyle(TextInputStyle.Paragraph).setPlaceholder('Appartement / 12 Rue des Lilas / Jean Dupont').setRequired(true),
    };

    for (const field of cfg.fields) {
      modal.addComponents(new ActionRowBuilder().addComponents(fieldBuilders[field]()));
    }

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const subAction = interaction.customId.replace('moderation_', '');

    // Résolution du joueur (mention ou ID)
    async function resolveUser(input) {
      const cleaned = input.replace(/[<@!>]/g, '').trim();
      try { return await interaction.guild.members.fetch(cleaned); } catch { return null; }
    }

    // Résolution du rôle (mention ou ID)
    async function resolveRole(input) {
      const cleaned = input.replace(/[<@&>]/g, '').trim();
      try { return await interaction.guild.roles.fetch(cleaned); } catch { return null; }
    }

    if (subAction === 'setmodo') {
      const roleMention = interaction.fields.getTextInputValue('role_mention');
      const role = await resolveRole(roleMention);
      if (!role) return interaction.reply({ content: '❌ Rôle introuvable.', ephemeral: true });
      const config = getConfig(); config.modRole = role.id; saveConfig(config);
      await interaction.reply({ content: `✅ Rôle modérateur défini sur **${role.name}**.`, ephemeral: true });
    }

    if (subAction === 'givemoney') {
      const targetMember = await resolveUser(interaction.fields.getTextInputValue('user_mention'));
      if (!targetMember) return interaction.reply({ content: '❌ Joueur introuvable.', ephemeral: true });
      const montant = parseInt(interaction.fields.getTextInputValue('montant'));
      const type = interaction.fields.getTextInputValue('type').toLowerCase().trim();
      if (isNaN(montant) || montant <= 0) return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });
      if (type !== 'cash' && type !== 'banque') return interaction.reply({ content: '❌ Type invalide. Mettez "cash" ou "banque".', ephemeral: true });
      const user = getUser(targetMember.id);
      if (type === 'cash') user.cash += montant; else user.bank += montant;
      saveUser(targetMember.id, user);
      addHistory(targetMember.id, `💵 Don admin (${type})`, montant);
      await interaction.reply({ content: `✅ **$${montant}** ajoutés au compte **${type}** de ${targetMember.user.username}.`, ephemeral: true });
    }

    if (subAction === 'removemoney') {
      const targetMember = await resolveUser(interaction.fields.getTextInputValue('user_mention'));
      if (!targetMember) return interaction.reply({ content: '❌ Joueur introuvable.', ephemeral: true });
      const montant = parseInt(interaction.fields.getTextInputValue('montant'));
      const type = interaction.fields.getTextInputValue('type').toLowerCase().trim();
      if (isNaN(montant) || montant <= 0) return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });
      const user = getUser(targetMember.id);
      if (type === 'cash') user.cash = Math.max(0, user.cash - montant); else user.bank = Math.max(0, user.bank - montant);
      saveUser(targetMember.id, user);
      addHistory(targetMember.id, `💸 Retrait admin (${type})`, montant);
      await interaction.reply({ content: `✅ **$${montant}** retirés du compte **${type}** de ${targetMember.user.username}.`, ephemeral: true });
    }

    if (subAction === 'giveitem') {
      const targetMember = await resolveUser(interaction.fields.getTextInputValue('user_mention'));
      if (!targetMember) return interaction.reply({ content: '❌ Joueur introuvable.', ephemeral: true });
      const nom = interaction.fields.getTextInputValue('nom_objet');
      const quantite = parseInt(interaction.fields.getTextInputValue('quantite'));
      const { getItems } = require('../db');
      const items = getItems();
      const item = items.find(i => i.nom.toLowerCase() === nom.toLowerCase());
      if (!item) return interaction.reply({ content: `❌ Objet **${nom}** introuvable. Créez-le d'abord avec /objet.`, ephemeral: true });
      const user = getUser(targetMember.id);
      const existing = user.inventory.findIndex(i => i.nom.toLowerCase() === nom.toLowerCase());
      if (existing !== -1) user.inventory[existing].quantite += quantite;
      else user.inventory.push({ nom: item.nom, poids: item.poids, quantite });
      saveUser(targetMember.id, user);
      await interaction.reply({ content: `✅ **${quantite}x ${nom}** donné à ${targetMember.user.username}.`, ephemeral: true });
    }

    if (subAction === 'reset') {
      const targetMember = await resolveUser(interaction.fields.getTextInputValue('user_mention'));
      if (!targetMember) return interaction.reply({ content: '❌ Joueur introuvable.', ephemeral: true });
      saveUser(targetMember.id, { userId: targetMember.id, cash: 500, bank: 0, inventory: [], history: [], carteIdentite: null, ppa: null, vehicules: [], habitations: [] });
      await interaction.reply({ content: `✅ Compte de **${targetMember.user.username}** réinitialisé.`, ephemeral: true });
    }

    if (subAction === 'creerci') {
      const targetMember = await resolveUser(interaction.fields.getTextInputValue('user_mention'));
      if (!targetMember) return interaction.reply({ content: '❌ Joueur introuvable.', ephemeral: true });
      const info = interaction.fields.getTextInputValue('ci_info').split('/').map(s => s.trim());
      if (info.length < 5) return interaction.reply({ content: '❌ Format invalide. Utilisez: Nom / Prénom / Naissance / Nationalité / Adresse', ephemeral: true });
      const user = getUser(targetMember.id);
      user.carteIdentite = { nom: info[0], prenom: info[1], dateNaissance: info[2], nationalite: info[3], adresse: info[4] };
      saveUser(targetMember.id, user);
      await interaction.reply({ content: `✅ Carte d'identité créée pour **${targetMember.user.username}**.`, ephemeral: true });
    }

    if (subAction === 'creerppa') {
      const targetMember = await resolveUser(interaction.fields.getTextInputValue('user_mention'));
      if (!targetMember) return interaction.reply({ content: '❌ Joueur introuvable.', ephemeral: true });
      const info = interaction.fields.getTextInputValue('ppa_info').split('/').map(s => s.trim());
      if (info.length < 5) return interaction.reply({ content: '❌ Format invalide. Utilisez: Nom / Prénom / Naissance / ArmeBlanche / ArmeLegere', ephemeral: true });
      const user = getUser(targetMember.id);
      user.ppa = {
        nom: info[0], prenom: info[1], dateNaissance: info[2],
        armeBlanche: info[3].toLowerCase() === 'oui',
        armeLegere: info[4].toLowerCase() === 'oui',
        expiration: expirationDate()
      };
      saveUser(targetMember.id, user);
      await interaction.reply({ content: `✅ PPA créé pour **${targetMember.user.username}**. Expire le **${user.ppa.expiration}**.`, ephemeral: true });
    }

    if (subAction === 'creervehicule') {
      const targetMember = await resolveUser(interaction.fields.getTextInputValue('user_mention'));
      if (!targetMember) return interaction.reply({ content: '❌ Joueur introuvable.', ephemeral: true });
      const info = interaction.fields.getTextInputValue('vehicule_info').split('/').map(s => s.trim());
      if (info.length < 4) return interaction.reply({ content: '❌ Format invalide. Utilisez: Marque / Modèle / Plaque / Propriétaire', ephemeral: true });
      const user = getUser(targetMember.id);
      if (!user.vehicules) user.vehicules = [];
      user.vehicules.push({
        marque: info[0], modele: info[1], plaque: info[2], proprietaire: info[3],
        assurance: expirationDate(), ct: expirationDate(), coffre: [], argent: 0
      });
      saveUser(targetMember.id, user);
      await interaction.reply({ content: `✅ Véhicule **${info[0]} ${info[1]}** (${info[2]}) ajouté à **${targetMember.user.username}**.`, ephemeral: true });
    }

    if (subAction === 'creerhabitation') {
      const targetMember = await resolveUser(interaction.fields.getTextInputValue('user_mention'));
      if (!targetMember) return interaction.reply({ content: '❌ Joueur introuvable.', ephemeral: true });
      const info = interaction.fields.getTextInputValue('habitation_info').split('/').map(s => s.trim());
      if (info.length < 3) return interaction.reply({ content: '❌ Format invalide. Utilisez: Type / Adresse / Propriétaire', ephemeral: true });
      const user = getUser(targetMember.id);
      if (!user.habitations) user.habitations = [];
      user.habitations.push({
        id: Date.now().toString(), type: info[0], adresse: info[1], proprietaire: info[2], stock: [], argent: 0
      });
      saveUser(targetMember.id, user);
      await interaction.reply({ content: `✅ **${info[0]}** au **${info[1]}** ajoutée à **${targetMember.user.username}**.`, ephemeral: true });
    }
  }
};
