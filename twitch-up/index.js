const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAllStreamers, addStreamer, removeStreamer, updateStreamerStatus, shouldNotify, markNotified } = require('./storage');
const { getStreamerInfo, checkIfLive } = require('./twitch-api');
require('dotenv').config();

// Discord bot token
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN in .env file');
  process.exit(1);
}

// Check interval in minutes
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '5', 10);

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('tuadd')
    .setDescription('Add a Twitch streamer to monitor')
    .addStringOption(option => 
      option.setName('streamlink')
        .setDescription('The Twitch streamer URL (e.g., https://twitch.tv/username)')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('turemove')
    .setDescription('Remove a Twitch streamer from monitoring')
    .addStringOption(option => 
      option.setName('username')
        .setDescription('The Twitch username to remove')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('tulist')
    .setDescription('List all monitored Twitch streamers'),
  
  new SlashCommandBuilder()
    .setName('tustatus')
    .setDescription('Check the status of all monitored streamers')
];

// Register slash commands when the bot is ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  try {
    console.log('Started refreshing application (/) commands.');
    
    const rest = new REST({ version: '10' }).setToken(token);
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands.map(command => command.toJSON()) }
    );
    
    console.log('Successfully reloaded application (/) commands.');
    
    // Start the periodic check for live streamers
    startPeriodicCheck();
  } catch (error) {
    console.error('Error refreshing application commands:', error);
  }
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  
  const { commandName } = interaction;
  
  try {
    switch (commandName) {
      case 'tuadd':
        await handleAddCommand(interaction);
        break;
      case 'turemove':
        await handleRemoveCommand(interaction);
        break;
      case 'tulist':
        await handleListCommand(interaction);
        break;
      case 'tustatus':
        await handleStatusCommand(interaction);
        break;
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    
    // Reply with error if the interaction hasn't been replied to yet
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while processing your command.',
        ephemeral: true
      });
    }
  }
});

/**
 * Handle the /tuadd command
 * @param {Object} interaction - The Discord interaction
 */
async function handleAddCommand(interaction) {
  await interaction.deferReply();
  
  const streamLink = interaction.options.getString('streamlink');
  
  try {
    const streamerInfo = await getStreamerInfo(streamLink);
    
    if (!streamerInfo || !streamerInfo.user) {
      await interaction.editReply('Could not find a valid Twitch streamer at that URL. Please check the link and try again.');
      return;
    }
    
    const added = addStreamer(streamerInfo.user);
    
    if (added) {
      const embed = new EmbedBuilder()
        .setColor('#6441a5')
        .setTitle(`Added ${streamerInfo.user.display_name}`)
        .setDescription(`Now monitoring ${streamerInfo.user.display_name} for live streams.`)
        .setThumbnail(streamerInfo.user.profile_image_url)
        .addFields(
          { name: 'Username', value: streamerInfo.user.login, inline: true },
          { name: 'Currently Live', value: streamerInfo.isLive ? '✅ Yes' : '❌ No', inline: true }
        )
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply(`${streamerInfo.user.display_name} is already being monitored.`);
    }
  } catch (error) {
    console.error('Error adding streamer:', error);
    await interaction.editReply('An error occurred while adding the streamer. Please try again later.');
  }
}

/**
 * Handle the /turemove command
 * @param {Object} interaction - The Discord interaction
 */
async function handleRemoveCommand(interaction) {
  await interaction.deferReply();
  
  const username = interaction.options.getString('username').toLowerCase();
  
  try {
    const streamers = getAllStreamers();
    const streamer = streamers.find(s => s.username.toLowerCase() === username);
    
    if (!streamer) {
      await interaction.editReply(`Could not find a monitored streamer with username "${username}".`);
      return;
    }
    
    const removed = removeStreamer(streamer.id);
    
    if (removed) {
      await interaction.editReply(`Removed ${streamer.displayName} from monitoring.`);
    } else {
      await interaction.editReply(`Failed to remove ${streamer.displayName} from monitoring.`);
    }
  } catch (error) {
    console.error('Error removing streamer:', error);
    await interaction.editReply('An error occurred while removing the streamer. Please try again later.');
  }
}

/**
 * Handle the /tulist command
 * @param {Object} interaction - The Discord interaction
 */
async function handleListCommand(interaction) {
  await interaction.deferReply();
  
  try {
    const streamers = getAllStreamers();
    
    if (streamers.length === 0) {
      await interaction.editReply('No streamers are currently being monitored. Add one with `/tuadd [streamlink]`.');
      return;
    }
    
    const embed = new EmbedBuilder()
      .setColor('#6441a5')
      .setTitle('Monitored Twitch Streamers')
      .setDescription(`Currently monitoring ${streamers.length} streamer(s).`)
      .addFields(
        streamers.map(streamer => ({
          name: streamer.displayName,
          value: `Username: ${streamer.username}\nLive: ${streamer.isLive ? '✅' : '❌'}`,
          inline: true
        }))
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error listing streamers:', error);
    await interaction.editReply('An error occurred while listing streamers. Please try again later.');
  }
}

/**
 * Handle the /tustatus command
 * @param {Object} interaction - The Discord interaction
 */
async function handleStatusCommand(interaction) {
  await interaction.deferReply();
  
  try {
    const streamers = getAllStreamers();
    
    if (streamers.length === 0) {
      await interaction.editReply('No streamers are currently being monitored. Add one with `/tuadd [streamlink]`.');
      return;
    }
    
    // Check current status of all streamers
    await interaction.editReply('Checking status of all monitored streamers...');
    
    // Update status for all streamers
    await checkAllStreamers();
    
    // Get updated streamers list
    const updatedStreamers = getAllStreamers();
    
    // Create embed for live streamers
    const liveStreamers = updatedStreamers.filter(s => s.isLive);
    
    if (liveStreamers.length === 0) {
      await interaction.editReply('None of the monitored streamers are currently live.');
      return;
    }
    
    const embed = new EmbedBuilder()
      .setColor('#6441a5')
      .setTitle('Live Twitch Streamers')
      .setDescription(`${liveStreamers.length} out of ${updatedStreamers.length} monitored streamer(s) are currently live.`)
      .setTimestamp();
    
    // Add fields for each live streamer
    liveStreamers.forEach(streamer => {
      const streamUrl = `https://twitch.tv/${streamer.username}`;
      
      embed.addFields({
        name: streamer.displayName,
        value: `[Watch Now](${streamUrl})\n${streamer.currentStream ? `Playing: ${streamer.currentStream.gameName}\nViewers: ${streamer.currentStream.viewerCount}` : ''}`
      });
    });
    
    await interaction.editReply({ content: null, embeds: [embed] });
  } catch (error) {
    console.error('Error checking streamer status:', error);
    await interaction.editReply('An error occurred while checking streamer status. Please try again later.');
  }
}

/**
 * Start the periodic check for live streamers
 */
function startPeriodicCheck() {
  console.log(`Starting periodic check every ${CHECK_INTERVAL} minutes`);
  
  // Initial check
  checkAllStreamers();
  
  // Set up interval
  setInterval(checkAllStreamers, CHECK_INTERVAL * 60 * 1000);
}

/**
 * Check all streamers and send notifications for those who are live
 */
async function checkAllStreamers() {
  try {
    const streamers = getAllStreamers();
    
    if (streamers.length === 0) {
      return;
    }
    
    console.log(`Checking status for ${streamers.length} streamers...`);
    
    for (const streamer of streamers) {
      try {
        const streamInfo = await checkIfLive(streamer.id);
        const wasLive = streamer.isLive;
        const isLive = !!streamInfo;
        
        // Update streamer status
        updateStreamerStatus(streamer.id, isLive, streamInfo);
        
        // If streamer just went live, send notification
        if (isLive && !wasLive && shouldNotify(streamer.id, streamInfo.started_at)) {
          await sendLiveNotification(streamer, streamInfo);
          markNotified(streamer.id);
        }
      } catch (error) {
        console.error(`Error checking status for ${streamer.displayName}:`, error);
      }
    }
    
    console.log('Finished checking streamer status');
  } catch (error) {
    console.error('Error in checkAllStreamers:', error);
  }
}

/**
 * Send a notification that a streamer is live
 * @param {Object} streamer - The streamer information
 * @param {Object} streamInfo - The stream information
 */
async function sendLiveNotification(streamer, streamInfo) {
  try {
    // Get all guilds the bot is in
    const guilds = client.guilds.cache.values();
    
    for (const guild of guilds) {
      try {
        // Find the first text channel we can send messages in
        const channel = guild.channels.cache.find(
          channel => channel.isTextBased() && channel.permissionsFor(guild.members.me).has('SendMessages')
        );
        
        if (!channel) {
          console.log(`No suitable channel found in guild ${guild.name}`);
          continue;
        }
        
        const streamUrl = `https://twitch.tv/${streamer.username}`;
        
        // Create embed
        const embed = new EmbedBuilder()
          .setColor('#6441a5')
          .setTitle(`${streamer.displayName} is now live on Twitch!`)
          .setURL(streamUrl)
          .setDescription(streamInfo.title || 'No stream title')
          .setThumbnail(streamer.profileImageUrl)
          .addFields(
            { name: 'Game', value: streamInfo.game_name || 'Unknown', inline: true },
            { name: 'Viewers', value: streamInfo.viewer_count.toString(), inline: true }
          )
          .setImage(streamInfo.thumbnail_url?.replace('{width}', '640').replace('{height}', '360'))
          .setTimestamp(new Date(streamInfo.started_at))
          .setFooter({ text: 'Stream started' });
        
        await channel.send({
          content: `🔴 **${streamer.displayName}** is now live! ${streamUrl}`,
          embeds: [embed]
        });
        
        console.log(`Sent live notification for ${streamer.displayName} in guild ${guild.name}`);
      } catch (error) {
        console.error(`Error sending notification in guild ${guild.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error sending live notification:', error);
  }
}

// Log in to Discord
client.login(token);
