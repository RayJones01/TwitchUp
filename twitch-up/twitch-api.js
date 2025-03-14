const fetch = require('node-fetch');
require('dotenv').config();

// Twitch API credentials
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// Cache for the access token
let accessToken = null;
let tokenExpiry = null;

/**
 * Get an access token from Twitch API
 * @returns {Promise<string>} The access token
 */
async function getAccessToken() {
  // Check if we have a valid token
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    const response = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data = await response.json();
    accessToken = data.access_token;
    // Set expiry time (subtract 1 minute to be safe)
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    
    return accessToken;
  } catch (error) {
    console.error('Error getting Twitch access token:', error);
    throw error;
  }
}

/**
 * Extract username from a Twitch URL
 * @param {string} url - The Twitch URL
 * @returns {string|null} The username or null if not found
 */
function extractUsernameFromUrl(url) {
  try {
    const twitchUrl = new URL(url);
    
    // Handle different URL formats
    if (twitchUrl.hostname === 'twitch.tv' || twitchUrl.hostname === 'www.twitch.tv') {
      // Format: https://twitch.tv/username or https://www.twitch.tv/username
      const pathParts = twitchUrl.pathname.split('/').filter(part => part);
      if (pathParts.length > 0) {
        return pathParts[0].toLowerCase();
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing Twitch URL:', error);
    return null;
  }
}

/**
 * Get user information by username
 * @param {string} username - The Twitch username
 * @returns {Promise<Object|null>} User information or null if not found
 */
async function getUserByUsername(username) {
  try {
    const token = await getAccessToken();
    
    const response = await fetch(
      `https://api.twitch.tv/helix/users?login=${username}`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      return data.data[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error getting Twitch user:', error);
    throw error;
  }
}

/**
 * Check if a streamer is currently live
 * @param {string} userId - The Twitch user ID
 * @returns {Promise<Object|null>} Stream information or null if not live
 */
async function checkIfLive(userId) {
  try {
    const token = await getAccessToken();
    
    const response = await fetch(
      `https://api.twitch.tv/helix/streams?user_id=${userId}`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to check stream status: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      return data.data[0]; // Stream is live, return stream info
    }
    
    return null; // Not live
  } catch (error) {
    console.error('Error checking if streamer is live:', error);
    throw error;
  }
}

/**
 * Get information about a Twitch streamer from a URL
 * @param {string} url - The Twitch URL
 * @returns {Promise<Object|null>} User and stream information or null if not found
 */
async function getStreamerInfo(url) {
  const username = extractUsernameFromUrl(url);
  
  if (!username) {
    return null;
  }
  
  try {
    const user = await getUserByUsername(username);
    
    if (!user) {
      return null;
    }
    
    const streamInfo = await checkIfLive(user.id);
    
    return {
      user,
      stream: streamInfo,
      isLive: !!streamInfo
    };
  } catch (error) {
    console.error('Error getting streamer info:', error);
    throw error;
  }
}

module.exports = {
  getStreamerInfo,
  checkIfLive,
  getUserByUsername,
  extractUsernameFromUrl
};
