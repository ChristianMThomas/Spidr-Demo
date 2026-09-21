import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function ActivityPrivacySettings({ currentUser }) {
  const queryClient = useQueryClient();
  const key = ['activity-privacy', currentUser?.id];
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: key, queryFn: () => api.get('/user-profiles/privacy'), enabled: !!currentUser?.id,
  });
  const save = useMutation({
    mutationFn: patch => api.patch('/user-profiles/privacy', patch),
    onSuccess: privacy => {
      queryClient.setQueryData(key, privacy);
      for (const queryKey of [['enhanced-feed'], ['feed-comments'], ['user-profile'], ['profiles']]) queryClient.invalidateQueries({ queryKey });
      toast.success('Privacy settings saved');
    },
    onError: () => toast.error('Privacy settings were not saved. Please try again.'),
  });
  if (isError) return <p role="alert" className="text-sm text-rose-300">Could not load privacy settings. <button onClick={() => refetch()} className="underline">Retry</button></p>;
  return (
    <section aria-label="Activity privacy" className="space-y-5 pb-5 border-b border-white/10">
      <div className="flex items-start justify-between gap-5">
        <div>
          <label htmlFor="private-account" className="text-white font-medium">Private account</label>
          <p className="text-zinc-400 text-sm mt-1">Only friends can see your activity, comments, and replies in the activity feed.</p>
          <p role="status" className="text-xs text-zinc-500 mt-1">{isPending ? 'Loading...' : data?.is_private ? 'Private' : 'Public'}</p>
        </div>
        <Switch id="private-account" checked={data?.is_private === true} disabled={isPending || save.isPending}
          onCheckedChange={is_private => save.mutate({ is_private })} className="shrink-0 mt-1" />
      </div>
      <div className="flex items-start justify-between gap-5">
        <div>
          <label htmlFor="hide-activity" className="text-white font-medium">Hide my activity</label>
          <p className="text-zinc-400 text-sm mt-1">Your activity, comments, and replies are visible only to you, including for friends.</p>
        </div>
        <Switch id="hide-activity" checked={data?.hide_activity === true} disabled={isPending || save.isPending}
          onCheckedChange={hide_activity => save.mutate({ hide_activity })} className="shrink-0 mt-1" />
      </div>
    </section>
  );
}
