import React, { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Clock, Globe, KeyRound, Loader2, Lock, Plus, Radar, RefreshCw, Search, Users, X } from 'lucide-react';
import { api, getSocket } from '@/api/apiClient';
import { toast } from 'sonner';
import CreateServerModal from './CreateServerModal';
import './SignalRadar.css';

export default function SignalRadar({ open = true, onClose, currentUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [view, setView] = useState('all');
  const [sort, setSort] = useState('newest');
  const [modal, setModal] = useState(null);
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim().replace(/^#/, '')), 250); return () => clearTimeout(timer); }, [search]);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['radar'] });
    queryClient.invalidateQueries({ queryKey: ['servers'] });
  };
  useEffect(() => {
    if (!open || !currentUser?.id) return;
    const socket = getSocket();
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['radar'] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    };
    socket.on('server:join-request', refresh);
    socket.on('server:member-joined', refresh);
    return () => { socket.off('server:join-request', refresh); socket.off('server:member-joined', refresh); };
  }, [open, currentUser?.id, queryClient]);
  const results = useInfiniteQuery({
    queryKey: ['radar', currentUser?.id, query, category, view, sort],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.get('/servers/discover?' + new URLSearchParams({ q: query, category, view, sort, page: String(pageParam) })),
    getNextPageParam: page => page.next_page ?? undefined,
    enabled: open && !!currentUser?.id,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });
  const servers = results.data?.pages.flatMap(p => p.items) || [];
  if (!open) return null;
  return (
    <section className="signal-radar" aria-label="Signal Radar">
      <header className="radar-header">
        <div className="radar-title"><Radar aria-hidden="true" size={30} /><div><span className="radar-eyebrow">COMMUNITIES</span><h1>Signal <span>Radar</span></h1></div></div>
        <div className="radar-header-actions">
          <button className="radar-secondary" onClick={() => setModal('join')}><KeyRound size={16} />Invite code</button>
          <button className="radar-secondary" onClick={() => setModal('create')}><Plus size={16} />Create server</button>
          {onClose && <button className="radar-icon" aria-label="Close Signal Radar" title="Close Signal Radar" onClick={onClose}><X size={18} /></button>}
        </div>
      </header>
      <div className="radar-toolbar">
        <label className="radar-search"><Search size={18} /><input aria-label="Search servers" placeholder="Search servers, interests, or tags" value={search} onChange={e => setSearch(e.target.value)} />{search && <button className="radar-icon" aria-label="Clear search" onClick={() => setSearch('')}><X size={16} /></button>}</label>
        <select aria-label="Server category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{['Gaming', 'Music', 'Technology', 'Art', 'Social', 'Education', 'Other'].map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}</select>
        <select aria-label="Sort servers" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest</option><option value="name">Name A-Z</option></select>
      </div>
      <div className="radar-results-bar">
        <div className="radar-tabs" role="tablist" aria-label="Server collections">{[['all', 'All servers'], ['friends', 'With friends'], ['requests', 'My requests']].map(([id, label]) => <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}>{label}</button>)}</div>
        <div className="radar-count"><span aria-live="polite">{results.isPending ? 'Scanning...' : results.isError ? 'Unavailable' : `${results.data?.pages[0]?.total || 0} servers`}</span><button className="radar-icon" aria-label="Refresh servers" title="Refresh servers" disabled={results.isFetching} onClick={() => results.refetch()}><RefreshCw size={15} className={results.isFetching ? 'radar-spin' : ''} /></button></div>
      </div>
      {results.isPending ? <div className="radar-empty" role="status"><Loader2 className="radar-spin" />Loading servers...</div> : results.isError ? <div className="radar-empty" role="alert"><p>Servers could not be loaded.</p><button className="radar-secondary" onClick={() => results.refetch()}><RefreshCw size={16} />Try again</button></div> : servers.length === 0 ? <div className="radar-empty"><Radar size={36} /><h2>{view === 'requests' ? 'No pending requests' : 'No servers found'}</h2>{(search || category) && <button className="radar-secondary" onClick={() => { setSearch(''); setCategory(''); }}>Clear filters</button>}</div> : (
        <div className="radar-grid">{servers.map(server => <ServerSignal key={server.id} server={server} onChanged={invalidate} onOpen={() => navigate('/servers/' + server.id)} onTag={tag => setSearch(tag)} onInvite={() => setModal('join')} />)}</div>
      )}
      {results.hasNextPage && <div className="radar-pagination"><button className="radar-secondary" disabled={results.isFetchingNextPage} onClick={() => results.fetchNextPage()}>{results.isFetchingNextPage ? <Loader2 size={16} className="radar-spin" /> : <ChevronDown size={16} />}Load more</button></div>}
      <CreateServerModal open={!!modal} initialTab={modal || 'create'} onClose={() => { setModal(null); invalidate(); }} currentUser={currentUser} />
    </section>
  );
}

function ServerSignal({ server, onChanged, onOpen, onTag, onInvite }) {
  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const action = useMutation({
    mutationFn: kind => kind === 'cancel' ? api.delete(`/servers/${server.id}/join-requests/me`) : api.post(`/servers/${server.id}/${kind === 'request' ? 'join-requests' : 'join'}`, {}),
    onSuccess: (_, kind) => { onChanged(); toast.success(kind === 'request' ? 'Join request sent' : kind === 'cancel' ? 'Request cancelled' : `Joined ${server.name}`); },
    onError: error => toast.error(error?.data?.error || error.message || 'Could not update membership'),
  });
  const privateServer = server.is_public === false;
  const label = server.is_member ? 'Open server' : server.request_pending ? 'Request pending' : privateServer ? server.allow_join_requests ? 'Request to join' : 'Use invite code' : 'Join server';
  const Icon = server.is_member ? Check : server.request_pending ? Clock : privateServer ? Lock : ArrowRight;
  const join = () => server.is_member ? onOpen() : privateServer ? server.allow_join_requests ? action.mutate('request') : onInvite() : action.mutate('join');
  return (
    <article className="server-signal" aria-label={server.name}>
      {server.banner_url && <img className="server-signal-banner" src={server.banner_url} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}
      <div className="server-signal-body">
        <div className="server-signal-top">
          <div className="server-signal-icon">{server.icon_url && !imageFailed ? <img src={server.icon_url} alt="" loading="lazy" onError={() => setImageFailed(true)} /> : <img src="/spidr-mascot.png" alt="" />}</div>
          <span className={'server-access ' + (privateServer ? 'private' : '')}>{privateServer ? <Lock size={12} /> : <Globe size={12} />}{privateServer ? 'Private' : 'Public'}</span>
        </div>
        <h2>{server.name}</h2>
        <div className="server-signal-stats"><span><Users size={13} />{server.member_count.toLocaleString()} members</span>{server.friend_count > 0 && <span className="server-friends">{server.friend_count} {server.friend_count === 1 ? 'friend' : 'friends'}</span>}</div>
        <div className="server-tags">{(server.tags || []).map(tag => <button key={tag} onClick={() => onTag(tag)}>#{tag}</button>)}</div>
        <p className={'server-description ' + (expanded ? 'expanded' : '')}>{server.description || 'No description yet.'}</p>
        <button className="server-details-toggle" aria-expanded={expanded} aria-controls={'server-info-' + server.id} onClick={() => setExpanded(!expanded)}>{expanded ? 'Less info' : 'Server info & rules'}<ChevronDown size={15} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} /></button>
        {expanded && <div id={'server-info-' + server.id} className="server-details">{server.category && <span className="server-category">{server.category}</span>}<h3>Server rules</h3>{server.rules?.length ? <ol>{server.rules.map((rule, i) => <li key={i}>{rule}</li>)}</ol> : <p>No rules published.</p>}</div>}
      </div>
      <footer className="server-signal-footer">
        <button className={'server-join ' + (privateServer ? 'private' : '')} disabled={action.isPending || (!server.is_member && server.request_pending)} onClick={join}>{action.isPending ? <Loader2 size={16} className="radar-spin" /> : <Icon size={16} />}{label}</button>
        {server.request_pending && !server.is_member && <button className="radar-icon" aria-label={'Cancel request to ' + server.name} title="Cancel request" disabled={action.isPending} onClick={() => action.mutate('cancel')}><X size={16} /></button>}
      </footer>
    </article>
  );
}
