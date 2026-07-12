/**
 * realtime.js — process-wide Socket.io handle for code that runs outside a
 * request/socket context (model hooks, utils like spidrSystem.sendSystemDM).
 *
 * index.js calls setIO(io) right after the server boots. Every emit helper
 * is a silent no-op until then, so model hooks can fire during startup
 * (seeds, backfills) without crashing.
 *
 * Sockets join a per-user room (`user:<id>`) on connection — see
 * socket/handlers.js — which is what makes emitToUser work across every
 * tab/device and across instances when the Redis adapter is active.
 */

let io = null;

exports.setIO = (instance) => {
  io = instance;
};

exports.getIO = () => io;

exports.emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
};

exports.emitToRoom = (room, event, payload) => {
  if (!io || !room) return;
  io.to(room).emit(event, payload);
};
