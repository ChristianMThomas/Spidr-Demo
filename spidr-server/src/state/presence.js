// Shared in-memory presence map: userId → socketId
// Imported by both socket/handlers.js and routes/users.js
const onlineUsers = new Map();
module.exports = { onlineUsers };
