const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

client.commands = new Collection();

// Chargement des commandes
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

// Enregistrement des slash commands
client.once('ready', async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash commands enregistrées !');
  } catch (err) {
    console.error(err);
  }
});

// Gestion des interactions
client.on('interactionCreate', async interaction => {
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
    }
  }

  if (interaction.isStringSelectMenu()) {
    const command = client.commands.get(interaction.customId.split('_')[0]);
    if (command && command.handleSelect) {
      try {
        await command.handleSelect(interaction);
      } catch (err) {
        console.error(err);
      }
    }
  }

  if (interaction.isModalSubmit()) {
    const command = client.commands.get(interaction.customId.split('_')[0]);
    if (command && command.handleModal) {
      try {
        await command.handleModal(interaction);
      } catch (err) {
        console.error(err);
      }
    }
  }
});

client.login(process.env.TOKEN);
