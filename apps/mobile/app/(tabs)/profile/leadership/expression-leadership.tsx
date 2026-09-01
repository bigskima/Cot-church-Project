import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  InputField,
  LeaderCard,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { LeadershipProfile } from '@church/types';

export default function ExpressionLeadershipManage() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const branchId = context?.expression?.id;

  const [displayName, setDisplayName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [ministry, setMinistry] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const leaders = useResource<LeadershipProfile[]>('leadership:expression:manage', (signal) =>
    api.request<LeadershipProfile[]>(`church-story?view=leadership${branchId ? `&expressionId=${branchId}` : ''}`, { signal }).catch(() => [])
  );

  async function handleAddLeader() {
    if (!displayName.trim() || !roleTitle.trim()) {
      setErrorMsg('Please provide the leader name and role title.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.request('church-story', {
        method: 'POST',
        body: JSON.stringify({
          expressionId: branchId ?? null,
          displayName: displayName.trim(),
          roleTitle: roleTitle.trim(),
          ministry: ministry.trim() || null,
          shortBio: shortBio.trim() || '',
          isFeaturedPublic: true,
        }),
      });
      setDisplayName('');
      setRoleTitle('');
      setMinistry('');
      setShortBio('');
      setSuccessMsg('Leader profile added successfully.');
      leaders.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create leader profile.');
    } finally {
      setSaving(false);
    }
  }

  const leaderList = leaders.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 60 },
        ]}
      >
        <ScreenHeader
          title="Campus Leadership Directory"
          subtitle="Configure pastoral staff, ministry directors, and coordinators."
          showBack
        />

        <View style={styles.body}>
          {/* Notification Messages */}
          {successMsg ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(22, 163, 106, 0.12)', borderColor: 'rgba(22, 163, 106, 0.3)' }]}>
              <Icon name="checkmark-circle" size={18} color="#16A36A" style={{ marginRight: 8 }} />
              <Text style={[styles.bannerText, { color: '#16A36A' }]}>{successMsg}</Text>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(229, 72, 77, 0.12)', borderColor: 'rgba(229, 72, 77, 0.3)' }]}>
              <Icon name="alert-circle" size={18} color="#E5484D" style={{ marginRight: 8 }} />
              <Text style={[styles.bannerText, { color: '#E5484D' }]}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Add Leader Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.cardHeader}>
              <Icon name="person-add-outline" size={18} color={colors.interactive} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Add Leader to Directory</Text>
            </View>

            <InputField
              label="Full Name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. Pastor David Alexander"
            />

            <InputField
              label="Role Title"
              value={roleTitle}
              onChangeText={setRoleTitle}
              placeholder="e.g. Lead Pastor, Worship Director"
            />

            <InputField
              label="Ministry Department (Optional)"
              value={ministry}
              onChangeText={setMinistry}
              placeholder="e.g. Pastoral Care, Youth & Families"
            />

            <InputField
              label="Short Biography"
              value={shortBio}
              onChangeText={setShortBio}
              multiline
              numberOfLines={3}
              placeholder="Summary of ministerial calling and role..."
            />

            <Button
              label="Save Leader Profile"
              onPress={handleAddLeader}
              loading={saving}
              variant="primary"
              size="md"
              style={{ marginTop: spacing.xs }}
            />
          </View>

          {/* Leaders List */}
          <View style={styles.listSection}>
            <SectionHeader title="Configured Leaders" badge={leaderList.length} />
            {leaders.loading ? (
              <Skeleton height={80} count={2} />
            ) : leaderList.length > 0 ? (
              leaderList.map((leader) => (
                <LeaderCard
                  key={leader.id}
                  leader={leader}
                  variant="standard"
                />
              ))
            ) : (
              <EmptyState
                title="No Leaders Configured"
                message="Add your pastoral team using the form above."
                iconName="people-outline"
              />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  listSection: {
    gap: spacing.xs,
  },
});
