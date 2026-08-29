import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { Button, EmptyState, InputField, ResourceError, Skeleton, ScreenHeader } from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { LeadershipProfile } from '@church/types';

export default function ExpressionLeadershipManage() {
  const { api, auth } = useSession();
  const { colors, isDark } = useTheme();
  const branchId = auth?.branchId;

  const [displayName, setDisplayName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [ministry, setMinistry] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [isFeaturedPublic, setIsFeaturedPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const leaders = useResource<LeadershipProfile[]>('leadership:expression:manage', (signal) =>
    api.request(`church-story?view=leadership${branchId ? `&expressionId=${branchId}` : ''}`, { signal })
  );

  async function handleAddLeader() {
    if (!displayName.trim() || !roleTitle.trim()) {
      setErrorMsg('Please provide the leader name and role title.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      await api.request('church-story', {
        method: 'POST',
        body: JSON.stringify({
          expressionId: branchId ?? null,
          displayName: displayName.trim(),
          roleTitle: roleTitle.trim(),
          ministry: ministry.trim() || null,
          shortBio: shortBio.trim() || '',
          isFeaturedPublic,
        }),
      });
      setDisplayName('');
      setRoleTitle('');
      setMinistry('');
      setShortBio('');
      setIsFeaturedPublic(false);
      leaders.refresh();
      alert('Expression leader profile created successfully!');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create leader profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title="Expression Leadership Directory"
        subtitle="Manage local pastoral staff, directors, and ministry coordinators."
        showBack
        dark={isDark}
      />

      <View style={styles.body}>
        {/* Add Leader Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
            shadows.md,
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Add Expression Leader
          </Text>

          <InputField
            label="Full Name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="e.g. Pastor John Example"
            dark={isDark}
          />

          <InputField
            label="Configurable Role Title"
            value={roleTitle}
            onChangeText={setRoleTitle}
            placeholder="e.g. Lead Pastor, Worship Director, Campus Coordinator"
            dark={isDark}
          />

          <InputField
            label="Ministry / Responsibility Area"
            value={ministry}
            onChangeText={setMinistry}
            placeholder="e.g. Pastoral Care, Youth Ministry, Media Production"
            dark={isDark}
          />

          <InputField
            label="Short Bio / Background"
            value={shortBio}
            onChangeText={setShortBio}
            placeholder="Describe background and ministry calling..."
            multiline
            numberOfLines={3}
            dark={isDark}
          />

          <Pressable
            onPress={() => setIsFeaturedPublic(!isFeaturedPublic)}
            style={styles.checkboxRow}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: colors.border },
                isFeaturedPublic && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
            >
              {isFeaturedPublic && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.textSecondary }]}>
              Feature on global public Church Leadership directory
            </Text>
          </Pressable>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <Button
            label="Add Leader to Directory ➔"
            onPress={handleAddLeader}
            variant="gold"
            size="lg"
            loading={saving}
            style={{ marginTop: spacing.md } as any}
          />
        </View>

        <Text style={[styles.sectionHeading, { color: colors.text }] as any}>
          Current Campus Leaders
        </Text>

        {leaders.loading ? (
          <Skeleton height={90} count={2} dark={isDark} />
        ) : leaders.error && !leaders.data ? (
          <ResourceError
            offline={leaders.offline}
            message={leaders.error}
            retry={leaders.refresh}
            dark={isDark}
          />
        ) : leaders.data && leaders.data.length > 0 ? (
          leaders.data.map((l) => (
            <View
              key={l.id}
              style={[
                styles.leaderItemCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                shadows.sm,
              ] as any}
            >
              <Text style={[styles.leaderItemName, { color: colors.text }] as any}>{l.display_name}</Text>
              <Text style={styles.leaderItemRole as any}>
                {l.role_title} {l.ministry ? `· ${l.ministry}` : ''}
              </Text>
              {l.short_bio ? (
                <Text style={[styles.leaderItemBio, { color: colors.textMuted }] as any}>{l.short_bio}</Text>
              ) : null}
            </View>
          ))
        ) : (
          <EmptyState
            title="No Campus Leaders Registered"
            message="Add campus leaders using the form above."
            icon="👥"
            dark={isDark}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkmark: {
    color: '#140C07',
    fontSize: 12,
    fontWeight: '900',
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  errorText: {
    color: palette.live,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  leaderItemCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  leaderItemName: {
    fontSize: 16,
    fontWeight: '900',
  },
  leaderItemRole: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.yellowDark,
    marginTop: 2,
  },
  leaderItemBio: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
});
