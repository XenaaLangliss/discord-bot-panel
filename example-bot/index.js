const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// Bot ready event
client.once('ready', () => {
  console.log('✅ Bot is online!');
  console.log(`📝 Logged in as: ${client.user.tag}`);
  console.log(`🌐 Connected to ${client.guilds.cache.size} server(s)`);
  console.log(`👥 Serving ${client.users.cache.size} user(s)`);
  
  // Set bot status
  client.user.setActivity('!help for commands', { type: 'LISTENING' });
});

// Message handler
client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Command prefix
  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    // Ping command
    if (command === 'ping') {
      const sent = await message.reply('🏓 Pinging...');
      const latency = sent.createdTimestamp - message.createdTimestamp;
      sent.edit(`🏓 Pong! Latency: ${latency}ms | API: ${Math.round(client.ws.ping)}ms`);
      console.log(`Ping command used by ${message.author.tag}`);
    }

    // Help command
    else if (command === 'help') {
      const helpMessage = `
**🤖 Bot Commands**

\`!ping\` - Check bot latency
\`!help\` - Show this help message
\`!info\` - Bot information
\`!server\` - Server information

**Need more help?** Contact the bot admin!
      `;
      await message.reply(helpMessage);
      console.log(`Help command used by ${message.author.tag}`);
    }

    // Info command
    else if (command === 'info') {
      const infoMessage = `
**📊 Bot Information**

• Bot Name: ${client.user.username}
• Bot Tag: ${client.user.tag}
• Servers: ${client.guilds.cache.size}
• Users: ${client.users.cache.size}
• Uptime: ${Math.floor(client.uptime / 1000 / 60)} minutes
• Created: ${client.user.createdAt.toDateString()}
      `;
      await message.reply(infoMessage);
      console.log(`Info command used by ${message.author.tag}`);
    }

    // Server command
    else if (command === 'server') {
      if (!message.guild) {
        return message.reply('❌ This command can only be used in a server!');
      }
      
      const serverMessage = `
**🏰 Server Information**

• Name: ${message.guild.name}
• Members: ${message.guild.memberCount}
• Created: ${message.guild.createdAt.toDateString()}
• Owner: <@${message.guild.ownerId}>
• Boost Level: ${message.guild.premiumTier}
      `;
      await message.reply(serverMessage);
      console.log(`Server command used by ${message.author.tag} in ${message.guild.name}`);
    }

  } catch (error) {
    console.error('❌ Error executing command:', error);
    message.reply('❌ An error occurred while executing that command!');
  }
});

// Error handling
client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

client.on('warn', (warning) => {
  console.warn('⚠️ Discord client warning:', warning);
});

// Login to Discord
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ ERROR: DISCORD_TOKEN is not set in environment variables!');
  process.exit(1);
}

console.log('🔄 Logging in to Discord...');
client.login(token)
  .then(() => {
    console.log('✅ Successfully logged in!');
  })
  .catch((error) => {
    console.error('❌ Failed to login:', error.message);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down bot...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down bot...');
  client.destroy();
  process.exit(0);
});
