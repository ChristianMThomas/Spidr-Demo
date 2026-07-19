import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Music, Repeat2, Link2, Flag, ShieldAlert } from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';
import { algorithm, entities, follows } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import { ClipVideo } from './ClipVideo';
import { ActionRail } from './ActionRail';

export interface ClipCardProps {
  clip: any;
  active: boolean;
  height: number;
  muted: boolean;
  onToggleMute: () => void;
  onOpenComments: (clipId: string) => void;
}

const phaseTwo = (label: string) =>
  Alert.alert('Phase 2 — Coming soon', `${label} on mobile lands in Phase 2.`);

// Public web URL for a clip — mirrors the web ClipFeed copy-link format.
const clipShareUrl = (clipId: string) =>
  `https://spidrapp.infinitetechteam.com/feed?clip=${clipId}`;

// Same reason list the web ReportModal + mobile profile ReportSheet ship.
const REPORT_REASONS = [
  { id: 'spam', label: 'Spam / Bot Activity', severity: 'low' },
  { id: 'harassment', label: 'Harassment / Abuse', severity: 'medium' },
  { id: 'nsfw', label: 'Inappropriate Content (NSFW)', severity: 'medium' },
  { id: 'impersonation', label: 'Impersonation', severity: 'medium' },
  { id: 'threats', label: 'Threats / Violence', severity: 'high' },
  { id: 'underage', label: 'Underage User', severity: 'high' },
  { id: 'hacking', label: 'Hacking / Exploits', severity: 'critical' },
  { id: 'doxxing', label: 'Doxxing / Leaking Personal Info', severity: 'critical' },
  { id: 'other', label: 'Other', severity: 'medium' },
];

// ── More-options sheet: copy link + report clip ──────────────────────────────
function MoreSheet({
  visible,
  onClose,
  clipId,
  authorName,
  currentUser,
}: {
  visible: boolean;
  onClose: () => void;
  clipId: string;
  authorName: string;
  currentUser: any;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setReporting(false);
    setReason(null);
    setDetails('');
    onClose();
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(clipShareUrl(clipId));
    close();
    Alert.alert('Link copied', 'Clip link copied to clipboard.');
  };

  const submitReport = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      const reasonObj = REPORT_REASONS.find((r) => r.id === reason);
      await entities.Report.create({
        reporter_id: currentUser?.id,
        reporter_name: currentUser?.display_name || currentUser?.full_name || currentUser?.username,
        target_type: 'clip',
        target_id: clipId,
        target_name: `Clip by ${authorName}`,
        reason,
        details,
        severity: reasonObj?.severity || 'medium',
        status: 'pending',
      });
      close();
      Alert.alert('Report submitted', 'Our team will review this clip.');
    } catch (err: any) {
      Alert.alert('Could not submit report', err?.message || 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={close} />
      <View
        style={{
          backgroundColor: '#0a0a0a',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 1,
          borderColor: 'rgba(239,68,68,0.3)',
          padding: 16,
          paddingBottom: 28,
        }}
      >
        {!reporting ? (
          <>
            <TouchableOpacity
              onPress={copyLink}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 13,
                paddingHorizontal: 10,
                borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.04)',
                marginBottom: 8,
              }}
            >
              <Link2 size={16} color="#d4d4d8" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Copy link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setReporting(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 13,
                paddingHorizontal: 10,
                borderRadius: 12,
                backgroundColor: 'rgba(239,68,68,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.25)',
              }}
            >
              <Flag size={16} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '700' }}>Report clip</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <ShieldAlert size={16} color="#ef4444" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>
                REPORT CLIP
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {REPORT_REASONS.map((r) => {
                const active = reason === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => setReason(r.id)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: active ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: active ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <Text style={{ color: active ? '#ef4444' : '#a1a1aa', fontSize: 11, fontWeight: '700' }}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Add details (optional)..."
              placeholderTextColor="#52525b"
              multiline
              style={{
                backgroundColor: '#18181b',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.07)',
                color: '#fff',
                fontSize: 13,
                padding: 10,
                minHeight: 64,
                textAlignVertical: 'top',
                marginBottom: 12,
              }}
            />
            <TouchableOpacity
              onPress={submitReport}
              disabled={!reason || submitting}
              style={{
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: reason ? '#dc2626' : '#3f3f46',
                alignItems: 'center',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 2 }}>
                  SUBMIT REPORT
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

// Single full-screen card in the vertical pager: video + action rail + bottom
// overlay (author, caption, hashtags, music, server CTA). Owns its own like
// state for optimistic toggles; everything else routes through queries.
export function ClipCard({
  clip,
  active,
  height,
  muted,
  onToggleMute,
  onOpenComments,
}: ClipCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const clipId = clip.id || clip._id;
  const isOwn = user?.id === clip.author_id;
  const [showMore, setShowMore] = useState(false);

  // Optimistic like — falls back to server count on success.
  const initialLiked = Array.isArray(clip.likes) && user?.id ? clip.likes.includes(user.id) : false;
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState<number>(clip.likes?.length || 0);

  // Follow state — only relevant for not-own clips.
  const { data: followStatus, refetch: refetchFollow } = useQuery({
    queryKey: ['follow-status', clip.author_id],
    queryFn: () => follows.status(clip.author_id),
    enabled: !!clip.author_id && !isOwn,
    staleTime: 30_000,
  });
  const isFollowing = !!(followStatus as any)?.following;

  // Author live profile — pulled so avatar/name stay in sync with profile edits.
  const { data: authorProfile } = useQuery({
    queryKey: ['profile-of', clip.author_id],
    queryFn: async () => {
      const list = await entities.UserProfile.filter({ user_id: clip.author_id });
      return (list as any[])[0] || null;
    },
    enabled: !!clip.author_id,
    staleTime: 60_000,
  });

  const authorName = authorProfile?.display_name || authorProfile?.username || clip.author_name || 'User';
  const authorAvatar = authorProfile?.avatar_url || clip.author_avatar;

  const likeMutation = useMutation({
    mutationFn: async (nextLiked: boolean) => {
      const current = Array.isArray(clip.likes) ? clip.likes : [];
      const next = nextLiked
        ? Array.from(new Set([...current, user!.id]))
        : current.filter((x: string) => x !== user!.id);
      await entities.Clip.update(clipId, { likes: next });
      algorithm.trackEngagement({
        clipId,
        liked: nextLiked,
        watchTimeSeconds: 0,
        totalDuration: clip.duration || 0,
      });
    },
    onError: () => {
      // Roll back optimistic toggle on failure.
      setLiked((v: boolean) => !v);
      setLikes((n) => n + (liked ? 1 : -1));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clips'] });
    },
  });

  const toggleLike = () => {
    if (!user?.id) return;
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    likeMutation.mutate(next);
  };

  const followMutation = useMutation({
    mutationFn: async (nextFollow: boolean) => {
      if (nextFollow) {
        return follows.follow({
          following_id: clip.author_id,
          following_name: authorName,
          following_avatar: authorAvatar || '',
        });
      }
      return follows.unfollow(clip.author_id);
    },
    onSuccess: () => refetchFollow(),
    onError: () => Alert.alert('Could not update follow', 'Try again in a moment.'),
  });

  const toggleFollow = () => {
    if (!user?.id || isOwn) return;
    followMutation.mutate(!isFollowing);
  };

  // Watch-time telemetry — emitted by the video player as the user dwells.
  const tickRef = useRef({ watchSeconds: 0, total: 0, looped: false });
  const handleWatchTick = (watchSeconds: number, totalDuration: number, looped: boolean) => {
    tickRef.current = { watchSeconds, total: totalDuration, looped };
  };
  useEffect(() => {
    if (active) return;
    const t = tickRef.current;
    if (t.watchSeconds > 0.5 && clipId) {
      algorithm.trackEngagement({
        clipId,
        watchTimeSeconds: t.watchSeconds,
        totalDuration: t.total,
        looped: t.looped,
      });
      tickRef.current = { watchSeconds: 0, total: 0, looped: false };
    }
  }, [active, clipId]);

  const videoUri = clip.video_url;
  const thumbnailUri = clip.thumbnail_url;
  const isTrending = (clip.engagement_scores?.avg || 0) > 60;
  const hashtags: string[] = Array.isArray(clip.hashtags) ? clip.hashtags.slice(0, 4) : [];

  return (
    <View style={{ width: '100%', height, backgroundColor: '#000' }}>
      {videoUri ? (
        <ClipVideo
          uri={videoUri}
          active={active}
          muted={muted}
          onWatchTick={handleWatchTick}
        />
      ) : thumbnailUri ? (
        <ExpoImage
          source={thumbnailUri}
          style={{ flex: 1 }}
          contentFit="contain"
          transition={150}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#52525b' }}>No media</Text>
        </View>
      )}

      {/* Repost header (if applicable) */}
      {clip.repost_by && (
        <View
          style={{
            position: 'absolute',
            top: 60,
            left: 12,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            gap: 6,
          }}
        >
          <Repeat2 size={12} color="#a1a1aa" />
          <Text style={{ color: '#a1a1aa', fontSize: 11, fontWeight: '700' }}>
            {clip.repost_by_name || 'Someone'} relayed
          </Text>
        </View>
      )}

      {/* Trending badge */}
      {isTrending && (
        <View
          style={{
            position: 'absolute',
            top: 60,
            right: 12,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: '#dc2626',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>
            TRENDING
          </Text>
        </View>
      )}

      {/* Action rail */}
      <ActionRail
        authorAvatar={authorAvatar}
        authorName={authorName}
        isFollowing={isFollowing}
        isOwnClip={isOwn}
        onToggleFollow={toggleFollow}
        onAvatarPress={() => phaseTwo('Profile preview')}
        liked={liked}
        likesCount={likes}
        onToggleLike={toggleLike}
        commentsCount={clip.comments_count || 0}
        onOpenComments={() => onOpenComments(clipId)}
        sharesCount={clip.shares_count || 0}
        muted={muted}
        onToggleMute={onToggleMute}
        onMore={() => setShowMore(true)}
      />

      <MoreSheet
        visible={showMore}
        onClose={() => setShowMore(false)}
        clipId={String(clipId)}
        authorName={authorName}
        currentUser={user}
      />

      {/* Bottom overlay: author + caption + hashtags + music + server CTA */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 12,
          right: 76,
          bottom: 110,
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: 16,
            fontWeight: '900',
            textShadowColor: 'rgba(0,0,0,0.85)',
            textShadowRadius: 6,
          }}
          numberOfLines={1}
        >
          @{authorName}
        </Text>

        {!!clip.caption && (
          <Text
            style={{
              color: '#fff',
              fontSize: 14,
              marginTop: 6,
              textShadowColor: 'rgba(0,0,0,0.85)',
              textShadowRadius: 6,
            }}
            numberOfLines={3}
          >
            {clip.caption}
          </Text>
        )}

        {hashtags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 6 }}>
            {hashtags.map((tag) => (
              <Pressable key={tag} onPress={() => phaseTwo('Hashtag search')}>
                <Text
                  style={{
                    color: '#ef4444',
                    fontSize: 13,
                    fontWeight: '800',
                    textShadowColor: 'rgba(0,0,0,0.85)',
                    textShadowRadius: 4,
                  }}
                >
                  #{tag}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {(clip.audio_id || clip.grafted_audio) && (
          <Pressable
            onPress={() => phaseTwo('Audio archive')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 8,
              gap: 6,
              backgroundColor: 'rgba(0,0,0,0.4)',
              alignSelf: 'flex-start',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Music size={12} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
              {clip.grafted_audio?.title || clip.audio_title || 'Original audio'}
            </Text>
          </Pressable>
        )}

        {clip.server_id && (
          <TouchableOpacity
            onPress={() => router.push(`/server/${clip.server_id}`)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 10,
              alignSelf: 'flex-start',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: 'rgba(239,68,68,0.9)',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>
              Open {clip.server_name || 'Server'} →
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
