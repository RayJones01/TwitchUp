const fs = require('fs');
const path = require('path');

// Path to the storage file
const STORAGE_FILE = path.join(__dirname, 'streamers.json');

/**
 * Initialize the storage file if it doesn't exist
 */
function initStorage() {
  if (!fs.existsSync(STORAGE_FILE)) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify({
      streamers: [],
      lastNotified: {}
    }, null, 2));
  }
}

/**
 * Read the current storage data
 * @returns {Object} The storage data
 */
function readStorage() {
  initStorage();
  const data = fs.readFileSync(STORAGE_FILE, 'utf8');
  return JSON.parse(data);
}

/**
 * Write data to the storage file
 * @param {Object} data - The data to write
 */
function writeStorage(data) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Add a streamer to the monitoring list
 * @param {Object} streamer - The streamer information
 * @returns {boolean} True if added, false if already exists
 */
function addStreamer(streamer) {
  const storage = readStorage();
  
  // Check if streamer already exists
  const exists = storage.streamers.some(s => s.id === streamer.id);
  
  if (exists) {
    return false;
  }
  
  // Add the streamer
  storage.streamers.push({
    id: streamer.id,
    username: streamer.login,
    displayName: streamer.display_name,
    profileImageUrl: streamer.profile_image_url,
    addedAt: new Date().toISOString(),
    isLive: false
  });
  
  writeStorage(storage);
  return true;
}

/**
 * Remove a streamer from the monitoring list
 * @param {string} streamerId - The streamer ID
 * @returns {boolean} True if removed, false if not found
 */
function removeStreamer(streamerId) {
  const storage = readStorage();
  
  const initialLength = storage.streamers.length;
  storage.streamers = storage.streamers.filter(s => s.id !== streamerId);
  
  // Also remove from lastNotified if exists
  if (storage.lastNotified[streamerId]) {
    delete storage.lastNotified[streamerId];
  }
  
  writeStorage(storage);
  return storage.streamers.length < initialLength;
}

/**
 * Get all streamers in the monitoring list
 * @returns {Array} The list of streamers
 */
function getAllStreamers() {
  const storage = readStorage();
  return storage.streamers;
}

/**
 * Update a streamer's live status
 * @param {string} streamerId - The streamer ID
 * @param {boolean} isLive - Whether the streamer is live
 * @param {Object} streamInfo - Stream information (if live)
 * @returns {Object} Updated streamer information
 */
function updateStreamerStatus(streamerId, isLive, streamInfo = null) {
  const storage = readStorage();
  
  const streamer = storage.streamers.find(s => s.id === streamerId);
  
  if (!streamer) {
    return null;
  }
  
  // Update live status
  streamer.isLive = isLive;
  
  // If live, update stream info
  if (isLive && streamInfo) {
    streamer.currentStream = {
      title: streamInfo.title,
      gameName: streamInfo.game_name,
      thumbnailUrl: streamInfo.thumbnail_url,
      viewerCount: streamInfo.viewer_count,
      startedAt: streamInfo.started_at
    };
  } else {
    delete streamer.currentStream;
  }
  
  writeStorage(storage);
  return streamer;
}

/**
 * Check if we should notify about a streamer going live
 * @param {string} streamerId - The streamer ID
 * @param {string} streamStartTime - The stream start time
 * @returns {boolean} True if we should notify
 */
function shouldNotify(streamerId, streamStartTime) {
  const storage = readStorage();
  
  // Get the last notification time for this streamer
  const lastNotified = storage.lastNotified[streamerId];
  
  // If we've never notified for this streamer, we should notify
  if (!lastNotified) {
    return true;
  }
  
  // If the stream started after our last notification, we should notify
  const streamStart = new Date(streamStartTime);
  const lastNotifyTime = new Date(lastNotified);
  
  return streamStart > lastNotifyTime;
}

/**
 * Mark a streamer as notified
 * @param {string} streamerId - The streamer ID
 */
function markNotified(streamerId) {
  const storage = readStorage();
  
  storage.lastNotified[streamerId] = new Date().toISOString();
  
  writeStorage(storage);
}

module.exports = {
  addStreamer,
  removeStreamer,
  getAllStreamers,
  updateStreamerStatus,
  shouldNotify,
  markNotified
};
