import React, { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, Loader2, RefreshCw } from 'lucide-react';
import { api, getSocket } from '@/api/apiClient';
import { toast } from 'sonner';

export default function ServerJoinRequests({ serverId }) {
  const client = useQueryClient();
  const key = ['server-join-requests', serverId];
  const requests = useQuery({ queryKey: key, queryFn: () => api.get(`/servers/${serverId}/join-requests`), refetchInterval: 15000 });
  useEffect(() => {
    const socket = getSocket();
    const refresh = event => { if (event.server_id === serverId) client.invalidateQueries({ queryKey: ['server-join-requests', serverId] }); };
    socket.on('server:join-request', refresh);
    return () => socket.off('server:join-request', refresh);
  }, [serverId, client]);
  const decision = useMutation({
    mutationFn: ({ userId, action }) => api.patch(`/servers/${serverId}/join-requests/${userId}`, { decision: action }),
    onSuccess: (_, { action }) => toast.success(action === 'approve' ? 'Member approved' : 'Request declined'),
    onError: error => toast.error(error?.data?.error || error.message || 'Could not review request'),
    onSettled: () => { client.invalidateQueries({ queryKey: key }); client.invalidateQueries({ queryKey: ['servers'] }); client.invalidateQueries({ queryKey: ['server', serverId] }); client.invalidateQueries({ queryKey: ['radar'] }); },
  });
  return <section className="space-y-4">
    <h3 className="text-lg font-semibold text-white">Join requests</h3>
    {requests.isPending ? <Loader2 className="animate-spin text-zinc-400" aria-label="Loading requests" /> : requests.isError ? <div role="alert" className="text-sm text-red-300">Could not load requests. <button onClick={() => requests.refetch()} title="Retry" aria-label="Retry requests"><RefreshCw size={16} /></button></div> : requests.data.length === 0 ? <p className="text-sm text-zinc-400 py-8">No pending join requests.</p> : <ul className="divide-y divide-zinc-800">{requests.data.map(request => <li key={request.user_id} className="flex items-center gap-3 py-4">
      <img src={request.avatar_url || '/spidr-mascot.png'} alt="" className="h-9 w-9 rounded-md object-cover" />
      <div className="min-w-0 flex-1"><p className="text-sm text-white break-words">{request.name}</p><time className="text-xs text-zinc-500">{new Date(request.requested_at).toLocaleDateString()}</time></div>
      <button className="p-2 rounded border border-emerald-800 text-emerald-300 disabled:opacity-40" disabled={decision.isPending} title="Approve request" aria-label={'Approve ' + request.name} onClick={() => decision.mutate({ userId: request.user_id, action: 'approve' })}><Check size={18} /></button>
      <button className="p-2 rounded border border-red-900 text-red-300 disabled:opacity-40" disabled={decision.isPending} title="Decline request" aria-label={'Decline ' + request.name} onClick={() => decision.mutate({ userId: request.user_id, action: 'decline' })}><X size={18} /></button>
    </li>)}</ul>}
  </section>;
}
