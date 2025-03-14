# Twitch Up

A Discord bot that monitors Twitch streamers and notifies when they go live.

## Features

- Add Twitch streamers to monitor via `/tuadd [streamlink]` command
- Remove streamers from monitoring via `/turemove [username]` command
- List all monitored streamers via `/tulist` command
- Check current status of all monitored streamers via `/tustatus` command
- Automatic notifications when monitored streamers go live
- Rich embeds with stream information and thumbnails

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v16.9.0 or higher)
- A Discord bot token
- Twitch API credentials (Client ID and Client Secret)

### Step 1: Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name (e.g., "Twitch Up")
3. Go to the "Bot" tab and click "Add Bot"
4. Under the "Privileged Gateway Intents" section, enable "SERVER MEMBERS INTENT" and "MESSAGE CONTENT INTENT"
5. Click "Reset Token" and copy your bot token (you'll need this later)
6. Go to the "OAuth2" tab, then "URL Generator"
7. Select the following scopes: `bot`, `applications.commands`
8. Select the following bot permissions: `Send Messages`, `Embed Links`, `Read Message History`
9. Copy the generated URL and open it in your browser to invite the bot to your server

### Step 2: Get Twitch API Credentials

1. Go to the [Twitch Developer Console](https://dev.twitch.tv/console)
2. Log in with your Twitch account
3. Click "Register Your Application"
4. Fill in the required fields:
   - Name: "Twitch Up" (or any name you prefer)
   - OAuth Redirect URLs: `http://localhost` (you won't be using this, but it's required)
   - Category: "Application Integration" or similar
5. Click "Create"
6. On the next page, note your Client ID
7. Click "New Secret" to generate a Client Secret and copy it (you'll need both the Client ID and Secret)

### Step 3: Configure Environment Variables

1. Copy the `.env.example` file to a new file named `.env`
2. Fill in your Discord bot token and Twitch API credentials:

```
# Discord Bot Token
DISCORD_TOKEN=your_discord_bot_token_here

# Twitch API Credentials
TWITCH_CLIENT_ID=your_twitch_client_id_here
TWITCH_CLIENT_SECRET=your_twitch_client_secret_here

# Check interval in minutes
CHECK_INTERVAL=5
```

### Step 4: Install Dependencies and Run the Bot

1. Open a terminal in the project directory
2. Install dependencies:

```bash
npm install
```

3. Start the bot:

```bash
npm start
```

For development with auto-restart on file changes:

```bash
npm run dev
```

## Usage

Once the bot is running and invited to your server, you can use the following slash commands:

### `/tuadd [streamlink]`

Add a Twitch streamer to the monitoring list.

Example: `/tuadd https://twitch.tv/shroud`

### `/turemove [username]`

Remove a Twitch streamer from the monitoring list.

Example: `/turemove shroud`

### `/tulist`

List all Twitch streamers currently being monitored.

### `/tustatus`

Check the current status of all monitored streamers and display those who are live.

## How It Works

- The bot periodically checks the status of all monitored streamers (default: every 5 minutes)
- When a streamer goes live, the bot sends a notification to the first available text channel in each server it's in
- The notification includes an embed with the stream title, game, viewer count, and thumbnail
- The bot keeps track of which streams it has already notified about to avoid duplicate notifications

## Troubleshooting

- If the bot doesn't respond to commands, make sure it has the necessary permissions in your Discord server
- If you're not receiving notifications, check that the bot has permission to send messages in at least one channel
- If the bot can't find a streamer, make sure you're using a valid Twitch URL or username

## License

MIT
