import React from 'react';

export const discoveryForm = (server = {}) => ({
  category: server?.category || '',
  tagsInput: (server?.tags || []).map(t => '#' + t).join(' '),
  rulesInput: (server?.rules || []).join('\n'),
  is_public: server?.is_public !== false,
  is_discoverable: server?.is_discoverable ?? server?.is_public !== false,
  allow_join_requests: server?.allow_join_requests !== false,
});

export const discoveryPayload = form => ({
  category: form.category || '',
  tags: [...new Set((form.tagsInput || '').split(/[\s,]+/).map(t => t.replace(/^#/, '').toLowerCase()).filter(Boolean))],
  rules: (form.rulesInput || '').split('\n').map(r => r.trim()).filter(Boolean),
  is_public: form.is_public,
  is_discoverable: form.is_discoverable,
  allow_join_requests: form.allow_join_requests,
});

export default function ServerDiscoveryFields({ value, onChange, disabled = false, section = 'all' }) {
  const field = (key, next) => onChange({ ...value, [key]: next });
  const inputClass = 'w-full bg-zinc-950 border border-zinc-700 rounded-md p-2 text-sm text-white disabled:opacity-50';
  return <fieldset disabled={disabled} className="space-y-4 min-w-0 text-sm text-zinc-300">
    {section !== 'access' && <>
      <label className="block space-y-1"><span>Category</span><select aria-label="Category" className={inputClass} value={value.category} onChange={e => field('category', e.target.value)}><option value="">Uncategorized</option>{['Gaming', 'Music', 'Technology', 'Art', 'Social', 'Education', 'Other'].map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}</select></label>
      <label className="block space-y-1"><span>Tags (up to 5)</span><input className={inputClass} value={value.tagsInput || ''} onChange={e => field('tagsInput', e.target.value)} placeholder="#gaming #community" maxLength={130} /></label>
      <label className="block space-y-1"><span>Server rules (one per line)</span><textarea className={inputClass} rows={4} value={value.rulesInput || ''} onChange={e => field('rulesInput', e.target.value)} maxLength={6000} /></label>
    </>}
    {section !== 'metadata' && <>
      <label className="block space-y-1"><span>Membership</span><select aria-label="Membership" className={inputClass} value={value.is_public ? 'public' : 'private'} onChange={e => field('is_public', e.target.value === 'public')}><option value="public">Public - anyone can join</option><option value="private">Private - approval or invite required</option></select></label>
      <label className="flex items-center gap-3"><input type="checkbox" className="accent-red-500 h-4 w-4" checked={value.is_discoverable} onChange={e => field('is_discoverable', e.target.checked)} />List on Signal Radar</label>
      {!value.is_public && <label className="flex items-center gap-3"><input type="checkbox" className="accent-red-500 h-4 w-4" checked={value.allow_join_requests} onChange={e => field('allow_join_requests', e.target.checked)} />Accept join requests</label>}
    </>}
  </fieldset>;
}
