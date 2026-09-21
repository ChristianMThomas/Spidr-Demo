import { getSocket } from '@/api/apiClient';

export function callAction(event, data = {}) {
  return new Promise((resolve, reject) => {
    getSocket().timeout(10000).emit(event, data, (error, result) => {
      if (error || !result?.ok) reject(new Error(result?.error || 'The call server did not respond. Please try again.'));
      else resolve(result);
    });
  });
}

export function callSessionProps(call, currentUser, initialStream) {
  const peer = call.participants.find(p => p.id !== currentUser.id);
  const name = call.groupName || peer?.name || 'Call';
  return {
    callId: call.callId, acceptedAt: call.acceptedAt, initialStream,
    server: { id: call.groupId ? 'group' : 'dm', name, channels: [], members: [] },
    channel: { id: call.groupId || call.conversationId, name, type: 'voice' },
    currentUser, startWithVideo: call.kind === 'video',
  };
}
