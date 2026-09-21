const { randomUUID } = require('node:crypto');

const RING_MS = 30_000;
const TRANSFER_MS = 20_000;

/**
 * Own the call lifecycle once per Socket.io instance. User presence remains a
 * Set of sockets; only the media owner is exclusive. All participant identity
 * and names come from the supplied server-side resolvers, never client cards.
 */
function createCallSessions({
  io, onlineUsers, resolveParticipants, describeUser, writeMissedCall,
  sendIncomingPush = async () => {}, sendEndPush = async () => {},
  onOwnerTransferred = async () => {}, onOwnerLeft = async () => {}, onCallEnded = async () => {},
  rateLimit = () => true, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout,
}) {
  const calls = new Map();
  const byConversation = new Map();
  const byUser = new Map();

  function emitUser(userId, event, payload, except) {
    for (const socketId of onlineUsers.get(userId) || []) {
      if (socketId !== except) io.to(socketId).emit(event, payload);
    }
  }

  function snapshot(call, socket) {
    const ownerSocketId = call.owners.get(socket.userId) || null;
    return {
      callId: call.id, conversationId: call.conversationId, groupId: call.groupId,
      groupName: call.groupName, callerId: call.callerId, caller: call.caller,
      kind: call.kind, status: call.status, startedAt: call.startedAt,
      acceptedAt: call.acceptedAt || null, expiresAt: call.expiresAt,
      participants: call.participants, ownerSocketId,
      isOwner: ownerSocketId === socket.id,
      canTransfer: call.status === 'active' && !!ownerSocketId && ownerSocketId !== socket.id,
      declined: call.declined.has(socket.userId),
    };
  }

  function sync(socket) {
    const active = [];
    for (const callId of byUser.get(socket.userId) || []) {
      const call = calls.get(callId);
      if (call) active.push(snapshot(call, socket));
    }
    socket.emit('call:state', { calls: active });
    return { calls: active };
  }

  function broadcastState(call) {
    for (const user of call.participants) {
      for (const socketId of onlineUsers.get(user.id) || []) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) sync(socket);
      }
    }
  }

  function keyOf(data) {
    if (typeof data?.groupId === 'string' && data.groupId) return 'group:' + data.groupId;
    if (typeof data?.conversationId === 'string' && data.conversationId) return 'dm:' + data.conversationId;
    return null;
  }

  function lookup(socket, data) {
    const call = calls.get(data?.callId || byConversation.get(keyOf(data)));
    if (!call || !call.participants.some((user) => user.id === socket.userId)) {
      throw new Error('This call is no longer available');
    }
    return call;
  }

  async function finish(call, reason, byUserId) {
    if (!calls.has(call.id)) return;
    const unanswered = call.status === 'ringing';
    call.status = 'ended';
    clearTimer(call.timer);
    calls.delete(call.id);
    for (const user of call.participants) {
      const index = byUser.get(user.id);
      index?.delete(call.id);
      if (!index?.size) byUser.delete(user.id);
    }
    const payload = {
      callId: call.id, conversationId: call.conversationId, groupId: call.groupId,
      callerId: call.callerId, reason, byUserId,
    };
    // Mark ended before any asynchronous persistence: timeout, cancel and
    // decline racing each other still produce exactly one missed-call row.
    for (const user of call.participants) {
      emitUser(user.id, 'call:cancelled', payload);
      emitUser(user.id, 'call:ended', payload);
      sendEndPush(user.id, { ...payload, reason }).catch(() => {});
    }
    if (reason === 'declined') emitUser(call.callerId, 'call:declined', payload);
    if (reason === 'unanswered') emitUser(call.callerId, 'call:timeout', payload);
    broadcastState(call);
    await onCallEnded(call, reason).catch(() => {});
    if (byConversation.get(call.key) === call.id) byConversation.delete(call.key);
    if (unanswered) await writeMissedCall({ ...call, reason });
  }

  async function invite(socket, data) {
    const identity = await resolveParticipants(socket.userId, data);
    const key = keyOf(identity);
    if (!key || !identity.recipientIds?.length) throw new Error('No recipients are available for this call');
    const existing = calls.get(byConversation.get(key));
    if (existing) {
      if (existing.owners.get(socket.userId) === socket.id) return { call: snapshot(existing, socket) };
      throw new Error('This conversation already has a call');
    }
    const ids = [socket.userId, ...new Set(identity.recipientIds.filter((id) => id !== socket.userId))];
    const participants = await Promise.all(ids.map(async (id) => ({ ...(await describeUser(id)), id })));
    // Recheck after database reads: simultaneous invitations must not create
    // two independent timers for the same conversation or caller.
    if (byConversation.has(key)) throw new Error('This conversation already has a call');
    if (byUser.get(socket.userId)?.size) throw new Error('End or transfer your current call first');
    if (socket.connected === false) throw new Error('Device disconnected');
    const call = {
      id: randomUUID(), key, ...identity, participants,
      callerId: socket.userId, caller: participants[0],
      kind: identity.groupId ? 'group' : data.kind === 'video' ? 'video' : 'voice',
      status: 'ringing', startedAt: now(), expiresAt: now() + RING_MS,
      owners: new Map([[socket.userId, socket.id]]), transfers: new Map(), declined: new Set(), departing: new Set(),
    };
    calls.set(call.id, call);
    byConversation.set(key, call.id);
    for (const { id } of participants) {
      if (!byUser.has(id)) byUser.set(id, new Set());
      byUser.get(id).add(call.id);
    }
    call.timer = setTimer(() => finish(call, 'unanswered', call.callerId).catch(() => {}), RING_MS);
    call.timer?.unref?.();
    socket.emit('call:outgoing', snapshot(call, socket));
    for (const recipientId of call.recipientIds) {
      const payload = { ...snapshot(call, { id: null, userId: recipientId }), caller: call.caller };
      emitUser(recipientId, 'call:incoming', payload);
      sendIncomingPush(recipientId, payload, call.callerId).catch(() => {});
    }
    broadcastState(call);
    return { call: snapshot(call, socket) };
  }

  async function accept(socket, data) {
    const call = lookup(socket, data);
    if (call.departing.has(socket.userId)) throw new Error('Your previous device is still leaving this call');
    if (!call.recipientIds.includes(socket.userId) && !(call.groupId && call.status === 'active')) throw new Error('Only an invited recipient can answer');
    for (const otherId of byUser.get(socket.userId) || []) {
      if (otherId !== call.id && calls.get(otherId)?.owners.has(socket.userId)) throw new Error('End your current call first');
    }
    if (call.status === 'ringing' && now() >= call.expiresAt) {
      await finish(call, 'unanswered', call.callerId);
      throw new Error('This call has expired');
    }
    const owner = call.owners.get(socket.userId);
    if (owner && owner !== socket.id) throw new Error('This call was answered on another device');
    if (owner === socket.id) return { call: snapshot(call, socket) };
    call.owners.set(socket.userId, socket.id);
    call.status = 'active';
    call.acceptedAt ||= now();
    clearTimer(call.timer);
    const payload = { ...snapshot(call, socket), byUserId: socket.userId, answeredSocketId: socket.id };
    emitUser(call.callerId, 'call:accepted', payload);
    emitUser(socket.userId, 'call:answered-elsewhere', payload, socket.id);
    sendEndPush(socket.userId, { callId: call.id, conversationId: call.conversationId, groupId: call.groupId, reason: 'answered' }).catch(() => {});
    broadcastState(call);
    return { call: snapshot(call, socket) };
  }

  async function decline(socket, data) {
    const call = lookup(socket, data);
    if (!call.recipientIds.includes(socket.userId) || call.owners.has(socket.userId)) throw new Error('You cannot decline this call');
    if (call.status !== 'ringing') throw new Error('This call has already been answered');
    call.declined.add(socket.userId);
    emitUser(socket.userId, 'call:cancelled', {
      callId: call.id, conversationId: call.conversationId, groupId: call.groupId, reason: 'declined',
    });
    sendEndPush(socket.userId, { callId: call.id, conversationId: call.conversationId, groupId: call.groupId, reason: 'declined' }).catch(() => {});
    if (call.recipientIds.every((id) => call.declined.has(id))) await finish(call, 'declined', socket.userId);
    return {};
  }

  async function cancel(socket, data) {
    const call = lookup(socket, data);
    if (call.owners.get(socket.userId) !== socket.id) throw new Error('Only the device in this call can end it');
    if (call.groupId && call.status === 'active' && call.owners.size > 1) {
      call.departing.add(socket.userId);
      call.owners.delete(socket.userId);
      emitUser(socket.userId, 'call:left', { callId: call.id, groupId: call.groupId });
      broadcastState(call);
      try { await onOwnerLeft({ call, userId: socket.userId, socket }); }
      finally { call.departing.delete(socket.userId); }
    } else {
      await finish(call, call.status === 'ringing' ? 'cancelled' : 'ended', socket.userId);
    }
    return {};
  }

  async function requestTransfer(socket, data) {
    const call = lookup(socket, data);
    const ownerSocketId = call.owners.get(socket.userId);
    if (call.status !== 'active' || !ownerSocketId || ownerSocketId === socket.id) throw new Error('No call is active on another device');
    const transfer = { id: randomUUID(), ownerSocketId, targetSocketId: socket.id, expiresAt: now() + TRANSFER_MS };
    call.transfers.set(socket.userId, transfer);
    const payload = { ...snapshot(call, socket), transferId: transfer.id, transferExpiresAt: transfer.expiresAt };
    socket.emit('call:transfer-ready', payload);
    return { call: payload };
  }

  async function commitTransfer(socket, data) {
    const call = lookup(socket, data);
    const transfer = call.transfers.get(socket.userId);
    if (call.status !== 'active' || !transfer || data.transferId !== transfer.id
      || transfer.targetSocketId !== socket.id || transfer.expiresAt <= now()
      || call.owners.get(socket.userId) !== transfer.ownerSocketId) throw new Error('This transfer expired or changed');
    call.transfers.delete(socket.userId);
    call.owners.set(socket.userId, socket.id);
    const oldSocket = io.sockets.sockets.get(transfer.ownerSocketId);
    try {
      await onOwnerTransferred({ call, userId: socket.userId, oldSocket, newSocket: socket });
    } catch (error) {
      if (calls.has(call.id)) call.owners.set(socket.userId, transfer.ownerSocketId);
      throw error;
    }
    if (!calls.has(call.id)) throw new Error('This call has ended');
    const payload = { ...snapshot(call, socket), fromSocketId: transfer.ownerSocketId, toSocketId: socket.id };
    oldSocket?.emit('call:transferred', payload);
    socket.emit('call:transfer-complete', payload);
    broadcastState(call);
    return { call: payload };
  }

  function register(socket) {
    for (const [event, handler] of Object.entries({
      'call:invite': invite, 'call:accept': accept, 'call:decline': decline, 'call:cancel': cancel,
      'call:sync': (client) => sync(client),
      'call:transfer:request': requestTransfer, 'call:transfer:commit': commitTransfer,
    })) {
      socket.on(event, (data = {}, ack) => {
        if (!rateLimit(socket, 5)) return typeof ack === 'function' && ack({ ok: false, error: 'Please wait before trying again' });
        Promise.resolve().then(() => handler(socket, data || {})).then((result) => {
          if (typeof ack === 'function') ack({ ok: true, ...result });
        }).catch((error) => {
          const payload = { callId: data?.callId, conversationId: data?.conversationId, groupId: data?.groupId, error: error.message };
          socket.emit('call:error', payload);
          if (typeof ack === 'function') ack({ ok: false, ...payload });
        });
      });
    }
    sync(socket);
  }

  function ownsVoice(socket, data) {
    const key = data.serverId === 'dm' ? 'dm:' + data.channelId
      : data.serverId === 'group' || data.groupId ? 'group:' + (data.groupId || data.channelId) : null;
    const call = calls.get(byConversation.get(key));
    if (!call) return data.serverId !== 'dm';
    return call.owners.get(socket.userId) === socket.id;
  }

  async function disconnect(socket) {
    for (const id of [...(byUser.get(socket.userId) || [])]) {
      const call = calls.get(id);
      if (call?.owners.get(socket.userId) === socket.id) await cancel(socket, { callId: id });
      else if (call?.transfers.get(socket.userId)?.targetSocketId === socket.id) call.transfers.delete(socket.userId);
    }
  }

  async function leaveVoice(socket, data) {
    const key = data.serverId === 'dm' ? 'dm:' + data.channelId
      : data.serverId === 'group' || data.groupId ? 'group:' + (data.groupId || data.channelId) : null;
    const call = calls.get(byConversation.get(key));
    if (call?.owners.get(socket.userId) === socket.id) await cancel(socket, { callId: call.id });
  }

  return { register, ownsVoice, disconnect, sync, leaveVoice };
}

module.exports = { createCallSessions, RING_MS, TRANSFER_MS };
