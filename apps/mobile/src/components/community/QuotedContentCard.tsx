import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';
import { Avatar } from '../primitives/Avatar';
import { Icon } from '../primitives/Icon';
import { AdaptiveMediaImage } from '../media/AdaptiveMediaImage';

function age(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function authorOf(value: any) {
  const author = value?.author ?? {};
  return {
    name: author.displayName || author.display_name || 'COT member',
    username: author.username || author.handle || undefined,
    avatar: author.avatarUrl || author.avatar_url || null,
  };
}

export function QuotedContentCard({
  reference,
  fallbackPreview,
  currentExpressionId,
}: {
  reference: any;
  fallbackPreview?: any | null;
  currentExpressionId?: string | null;
}) {
  const { colors } = useTheme();
  const kind = reference?.type;
  const reel = reference?.quotedReel ?? null;
  const post = reference?.quotedPost ?? null;
  const unavailable = kind === 'post_reference' ? !post : !reel;
  const source = post || reel || {};
  const author = authorOf(source);
  const label = kind === 'post_reference' ? 'QUOTED POST' : 'QUOTED REEL';
  const body = kind === 'post_reference'
    ? String(source.body || '').trim()
    : String(source.caption || reference?.caption || '').trim();
  const publishedAt = source.publishedAt || source.published_at || null;
  const expressionName = source.expression?.name || null;

  const preview = kind === 'post_reference'
    ? source.previewMedia || null
    : reel?.preview || fallbackPreview || null;
  const previewType = preview?.type || preview?.media_type;
  const previewImage = preview?.thumbnailUrl || (previewType === 'image' ? preview?.url : null);

  const open = () => {
    if (unavailable) return;
    if (kind === 'post_reference') {
      const postId = source.id || reference.postId;
      const expressionId = source.branch_id || source.expression?.id || currentExpressionId;
      router.push((source.visibility === 'branch' && expressionId
        ? `/expressions/${expressionId}/post/${postId}`
        : `/general/post/${postId}`) as any);
      return;
    }
    const reelId = source.id || reference.reelId;
    const expressionId = source.expression?.id || currentExpressionId;
    router.push((source.visibility === 'branch' && expressionId
      ? { pathname: `/expressions/${expressionId}/reels`, params: { reelId } }
      : { pathname: '/general/reels', params: { reelId } }) as any);
  };

  return (
    <Pressable
      onPress={(event) => { event.stopPropagation?.(); open(); }}
      disabled={unavailable}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
        pressed && !unavailable && { opacity: 0.9 },
        unavailable && { opacity: 0.68 },
      ]}
      accessibilityRole={unavailable ? undefined : 'button'}
      accessibilityLabel={unavailable ? 'Quoted content unavailable' : `Open ${label.toLowerCase()}`}
    >
      <View style={styles.quoteTop}>
        <View style={[styles.quoteIcon, { backgroundColor: colors.primarySoft }]}>
          <Icon name={kind === 'post_reference' ? 'chatbox-ellipses-outline' : 'play-outline'} size={14} color={colors.interactive} />
        </View>
        <Text style={[styles.quoteLabel, { color: colors.interactive }]}>{label}</Text>
        {expressionName ? <Text style={[styles.scope, { color: colors.textMuted }]} numberOfLines={1}>· {expressionName}</Text> : null}
      </View>

      {unavailable ? (
        <View style={styles.unavailable}>
          <Icon name='alert-circle-outline' size={18} color={colors.textMuted} />
          <Text style={[styles.unavailableText, { color: colors.textMuted }]}>The original content is no longer available.</Text>
        </View>
      ) : (
        <>
          <View style={styles.identity}>
            <Avatar name={author.name} url={author.avatar} size='sm' />
            <View style={styles.identityCopy}>
              <View style={styles.nameLine}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{author.name}</Text>
                <Text style={[styles.time, { color: colors.textMuted }]}>{age(publishedAt)}</Text>
              </View>
              {author.username ? <Text style={[styles.handle, { color: colors.textMuted }]} numberOfLines={1}>@{author.username}</Text> : null}
            </View>
            <Icon name='open-outline' size={15} color={colors.textMuted} />
          </View>

          {body ? <Text style={[styles.body, { color: colors.text }]} numberOfLines={4}>{body}</Text> : null}

          {preview ? (
            <View style={[styles.preview, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              {previewImage ? (
                <AdaptiveMediaImage
                  url={previewImage}
                  alt={preview?.alt || (kind === 'reel_reference' ? 'Quoted Reel preview' : 'Quoted post media')}
                  resizeMode='cover'
                  style={styles.previewImage}
                  backgroundColor={colors.card}
                />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Icon name={previewType === 'video' ? 'videocam-outline' : 'image-outline'} size={24} color={colors.textMuted} />
                  <Text style={[styles.previewPlaceholderText, { color: colors.textMuted }]}>
                    {previewType === 'video' ? 'Video' : 'Media'}
                  </Text>
                </View>
              )}
              {(kind === 'reel_reference' || previewType === 'video') ? (
                <View style={styles.play}>
                  <Icon name='play' size={20} color='#FFFFFF' />
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, gap: 10, overflow: 'hidden' },
  quoteTop: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 6 },
  quoteIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quoteLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  scope: { flex: 1, minWidth: 0, fontSize: 9.5, fontWeight: '700' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  identityCopy: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 12.5, fontWeight: '900' },
  time: { fontSize: 9.5, fontWeight: '700' },
  handle: { fontSize: 9.5, marginTop: 1 },
  body: { fontSize: 13, lineHeight: 19 },
  preview: { position: 'relative', height: 210, borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  previewPlaceholderText: { fontSize: 10, fontWeight: '800' },
  play: { position: 'absolute', left: '50%', top: '50%', marginLeft: -24, marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', justifyContent: 'center' },
  unavailable: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  unavailableText: { flex: 1, fontSize: 11, lineHeight: 16 },
});
