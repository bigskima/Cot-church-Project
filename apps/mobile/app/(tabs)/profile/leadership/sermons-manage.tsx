import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/state/session';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  EmptyState,
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { Sermon } from '@/types/content';

export default function SermonsManageScreen() {
  const { api } = useSession();
  const [title, setTitle] = useState('');
  const [preacher, setPreacher] = useState('');
  const [scripture, setScripture] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const sermons = useResource<Sermon[]>('leadership:sermons', (signal) =>
    api.request<Sermon[]>('sermons', { signal })
  );

  const handleCreateSermon = async () => {
    if (!title.trim() || !preacher.trim()) {
      setErrorMsg('Please provide both a title and preacher name.');
      return;
    }
    setCreating(true);
    setErrorMsg('');
    try {
      await api.request('sermons', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          preacher: preacher.trim(),
          scriptures: scripture ? [scripture.trim()] : [],
          description: description.trim(),
          status: 'published',
          visibility: 'public',
        }),
      });
      setTitle('');
      setPreacher('');
      setScripture('');
      setDescription('');
      sermons.refresh();
      alert('Sermon published to global discover library!');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create sermon.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Sermons & Media Publishing"
        subtitle="Review recorded message drafts, assign scripture topics, and publish sermons to members."
        showBack
      />

      <View style={styles.body}>
        {/* Publish Sermon Card */}
        <View style={[styles.card, shadows.md]}>
          <Text style={styles.cardHeaderTitle}>PUBLISH NEW SERMON MESSAGE</Text>

          <InputField
            label="Sermon Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Walking in Divine Alignment"
          />

          <InputField
            label="Preacher / Speaker"
            value={preacher}
            onChangeText={setPreacher}
            placeholder="e.g. Pastor David"
          />

          <InputField
            label="Key Scriptures (Comma-separated)"
            value={scripture}
            onChangeText={setScripture}
            placeholder="e.g. Proverbs 3:5-6, Romans 8:28"
          />

          <InputField
            label="Message Overview & Notes"
            value={description}
            onChangeText={setDescription}
            placeholder="Key sermon outline and spiritual summary..."
            multiline
            numberOfLines={3}
          />

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <Button
            label="Publish to Sanctuary Library ➔"
            onPress={handleCreateSermon}
            variant="gold"
            size="lg"
            loading={creating}
            style={{ marginTop: spacing.md }}
          />
        </View>

        {/* Existing Sermons List */}
        <SectionHeader title="Published Sermons Library" badge={sermons.data?.length ?? 0} />
        {sermons.loading ? (
          <Skeleton height={100} count={2} />
        ) : sermons.error && !sermons.data ? (
          <ResourceError
            offline={sermons.offline}
            message={sermons.error}
            retry={sermons.refresh}
          />
        ) : sermons.data && sermons.data.length > 0 ? (
          sermons.data.map((sermon) => (
            <View key={sermon.id} style={[styles.sermonCard, shadows.sm]}>
              <View style={styles.sermonHeader}>
                <Badge label={sermon.status.toUpperCase()} variant="success" />
                <Text style={styles.sermonDate}>
                  {new Date(sermon.sermon_date || Date.now()).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.sermonTitle}>{sermon.title}</Text>
              <Text style={styles.sermonPreacher}>Speaker: {sermon.preacher}</Text>
              {sermon.scripture_references && sermon.scripture_references.length > 0 && (
                <Text style={styles.sermonScripture}>
                  📖 {sermon.scripture_references.join(', ')}
                </Text>
              )}
            </View>
          ))
        ) : (
          <EmptyState
            title="No Sermons Published"
            message="Publish sermons above or convert recorded broadcasts into messages."
            icon="📖"
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.muted,
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  errorText: {
    color: palette.live,
    fontSize: 13,
    fontWeight: '800',
    marginVertical: 4,
  },
  sermonCard: {
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  sermonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sermonDate: {
    fontSize: 11,
    color: palette.muted,
  },
  sermonTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.ink,
  },
  sermonPreacher: {
    fontSize: 12,
    color: palette.navy,
    fontWeight: '700',
    marginTop: 2,
  },
  sermonScripture: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 4,
  },
});
