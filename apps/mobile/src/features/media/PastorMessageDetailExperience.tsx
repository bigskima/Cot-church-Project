import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioPlayer, Button, Chip, Icon, ResourceError, ScreenHeader, Skeleton, VideoPlayer } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Sermon } from '@/types/content';

type Scope = 'general' | 'expression';
type Playback = {
  available: boolean;
  audioUrl?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  audioDurationSeconds?: number | null;
  videoDurationSeconds?: number | null;
};

export default function PastorMessageDetailExperience({
  sermonId,
  scope = 'general',
}: {
  sermonId: string;
  scope?: Scope;
}) {
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const [format, setFormat] = useState<'audio' | 'video'>('audio');

  const organizationId =
    context?.organization?.id ??
    context?.organizations?.[0]?.id ??
    process.env.EXPO_PUBLIC_ORGANIZATION_ID ??
    '';

  const expressionId = context?.expression?.id;

  const resource = useResource<Sermon>(
    `pastor-message:detail:${scope}:${sermonId}:${mode}:${expressionId ?? 'general'}`,
    async (signal) => {
      if (!sermonId) throw new Error('This Pastor’s Message is unavailable.');

      if (scope === 'general') {
        const suffix = organizationId
          ? `&organizationId=${encodeURIComponent(organizationId)}`
          : '';
        return api.request<Sermon>(
          `public-content?type=pastor-message&id=${encodeURIComponent(sermonId)}${suffix}`,
          { signal, context: 'public' },
        );
      }

      if (!expressionId) {
        throw new Error('Enter this Expression to view its Pastor’s Message.');
      }

      const message = await api.request<Sermon>(
        `sermons?id=${encodeURIComponent(sermonId)}&pastorMessages=true`,
        { signal },
      );

      if (
        !message ||
        message.expression_id !== expressionId ||
        message.is_pastor_message !== true ||
        message.status !== 'published'
      ) {
        throw new Error('This Pastor’s Message is not part of this Expression.');
      }

      return message;
    },
  );

  const message = resource.data;

  const playback = useResource<Playback>(
    `pastor-message:playback:${sermonId}`,
    async (signal) => {
      const result = await api.request<Playback>(
        `content-media?action=pastor_message_playback&sermonId=${encodeURIComponent(sermonId)}`,
        { signal, context: scope === 'expression' ? 'current' : 'public' },
      );
      return result;
    },
  );

  const media = playback.data;
  const hasAudio = Boolean(media?.audioUrl);
  const hasVideo = Boolean(media?.videoUrl);

  useEffect(() => {
    if (hasAudio && !hasVideo) setFormat('audio');
    else if (hasVideo && !hasAudio) setFormat('video');
  }, [hasAudio, hasVideo]);

  const activeUrl = format === 'video' ? media?.videoUrl : media?.audioUrl;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 110 },
        ]}
      >
        <ScreenHeader
          title="Pastor’s Message"
          kicker={scope === 'expression' ? 'EXPRESSION · PASTOR’S MESSAGE' : 'PASTOR’S MESSAGE'}
          showBack
        />

        {resource.loading ? (
          <View style={styles.loading}>
            <Skeleton height={210} borderRadius={radius.xxl} />
            <Skeleton height={90} borderRadius={radius.xl} />
            <Skeleton height={150} borderRadius={radius.xl} />
          </View>
        ) : resource.error && !message ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : message ? (
          <View style={styles.body}>
            {message.thumbnail_url ? (
              <Image
                source={{ uri: message.thumbnail_url }}
                style={styles.banner}
                resizeMode="cover"
                accessibilityLabel={`${message.title} cover`}
              />
            ) : null}

            <View style={styles.heading}>
              <Text style={[styles.title, { color: colors.text }]}>
                {message.title}
              </Text>
              {message.preacher ? (
                <Text style={[styles.preacher, { color: colors.interactive }]}>
                  {message.preacher}
                </Text>
              ) : null}
              {message.sermon_date ? (
                <Text style={[styles.date, { color: colors.textMuted }]}>
                  {new Date(message.sermon_date).toLocaleDateString()}
                </Text>
              ) : null}
            </View>

            {hasAudio || hasVideo || playback.loading || playback.error ? (
              <View style={styles.mediaBlock}>
                {hasAudio && hasVideo ? (
                  <View style={styles.formatRow}>
                    <Chip
                      label="Listen"
                      selected={format === 'audio'}
                      onPress={() => setFormat('audio')}
                    />
                    <Chip
                      label="Watch"
                      selected={format === 'video'}
                      onPress={() => setFormat('video')}
                    />
                  </View>
                ) : null}

                {playback.loading && !activeUrl ? (
                  <Skeleton height={180} borderRadius={radius.xl} />
                ) : playback.error && !activeUrl ? (
                  <ResourceError
                    message="The uploaded teaching could not be loaded right now."
                    retry={playback.refresh}
                  />
                ) : activeUrl ? (
                  format === 'video' ? (
                    <VideoPlayer
                      title={message.title}
                      sourceUrl={media?.videoUrl}
                      posterUrl={media?.posterUrl ?? message.thumbnail_url}
                      durationSeconds={media?.videoDurationSeconds ?? message.duration_seconds}
                    />
                  ) : (
                    <AudioPlayer
                      title={message.title}
                      preacherOrArtist={message.preacher}
                      sourceUrl={media?.audioUrl}
                      durationSeconds={media?.audioDurationSeconds ?? message.duration_seconds}
                    />
                  )
                ) : (
                  <View
                    style={[
                      styles.notice,
                      {
                        backgroundColor: colors.bgSecondary,
                        borderColor: colors.borderSubtle,
                      },
                    ]}
                  >
                    <Icon name="musical-notes-outline" size={20} color={colors.interactive} />
                    <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                      No published audio or video is attached to this Pastor’s Message.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {message.description ? (
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                  shadows.sm,
                ]}
              >
                <Text style={[styles.sectionLabel, { color: colors.interactive }]}>
                  TEACHING
                </Text>
                <Text style={[styles.description, { color: colors.text }]}>
                  {message.description}
                </Text>
              </View>
            ) : null}

            {message.scripture_references?.length ? (
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                ]}
              >
                <Text style={[styles.sectionLabel, { color: colors.interactive }]}>
                  SCRIPTURE REFERENCES
                </Text>
                {message.scripture_references.map((reference) => (
                  <View key={reference} style={styles.referenceRow}>
                    <Icon name="book-outline" size={16} color={colors.interactive} />
                    <Text style={[styles.referenceText, { color: colors.text }]}>
                      {reference}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View
              style={[
                styles.boundary,
                { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
              ]}
            >
              <Icon name="mic-outline" size={18} color={colors.interactive} />
              <View style={styles.flex}>
                <Text style={[styles.boundaryTitle, { color: colors.text }]}>
                  Pastor’s Message
                </Text>
                <Text style={[styles.boundaryText, { color: colors.textMuted }]}>
                  This is a pastoral teaching recording. Sermon reading and sermon study tools are intentionally not shown here.
                </Text>
              </View>
            </View>

            {mode === 'visitor' ? (
              <Button
                label="Sign in to continue"
                variant="outline"
                onPress={() =>
                  router.push({
                    pathname: '/(auth)/login',
                    params: {
                      returnTo:
                        scope === 'expression' && expressionId
                          ? `/expressions/${expressionId}/pastor-messages/${sermonId}`
                          : `/general/pastor-messages/${sermonId}`,
                    },
                  } as any)
                }
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.md, gap: spacing.md },
  loading: { gap: spacing.md },
  body: { gap: spacing.md },
  banner: { width: '100%', height: 210, borderRadius: radius.xxl },
  heading: { gap: 3, paddingTop: spacing.xs },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.55 },
  preacher: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  date: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  mediaBlock: { gap: spacing.sm },
  formatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  sectionLabel: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1 },
  description: { fontSize: 13, lineHeight: 21 },
  referenceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  referenceText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '700' },
  notice: { minHeight: 74, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noticeText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
  boundary: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  boundaryTitle: { fontSize: 12.5, fontWeight: '900' },
  boundaryText: { marginTop: 3, fontSize: 10.5, lineHeight: 16 },
  flex: { flex: 1, minWidth: 0 },
});
