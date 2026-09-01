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
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { LeadershipProfile } from '@church/types';

export default function LeadershipDirectoryScreen() {
  const insets = useSafeAreaInsets();
  const { api } = useSession();
  const { colors } = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [bio, setBio] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const directory = useResource<LeadershipProfile[]>('leadership:directory', (signal) =>
    api.request<LeadershipProfile[]>('church-story?view=leadership', { signal })
  );

  const handleAddLeader = async () => {
    if (!displayName.trim() || !roleTitle.trim()) {
      setErrorMsg('Please provide a leader name and role title.');
      return;
    }
    setCreating(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.request('organization-units', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add_leader',
          displayName: displayName.trim(),
          roleTitle: roleTitle.trim(),
          bio: bio.trim() || null,
        }),
      });
      setDisplayName('');
      setRoleTitle('');
      setBio('');
      setSuccessMsg('Leader profile added to directory.');
      directory.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to add leadership profile.');
    } finally {
      setCreating(false);
    }
  };

  const leaders = directory.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 60 },
        ]}
      >
        <ScreenHeader
          title="Leadership Directory"
          subtitle="Manage senior pastors, ministers, elders, and ministry directors."
          showBack
        />

        <View style={styles.body}>
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

          {/* Add Leader Form */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.cardHeader}>
              <Icon name="person-add-outline" size={18} color={colors.interactive} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Add New Ministry Leader</Text>
            </View>

            <InputField
              label="Leader Full Name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. Pastor Grace Adebayo"
            />

            <InputField
              label="Role Title / Ministry Department"
              value={roleTitle}
              onChangeText={setRoleTitle}
              placeholder="e.g. Lead Pastor / Worship Director"
            />

            <InputField
              label="Biography / Profile Notes"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              placeholder="Summary of ministerial calling and background..."
            />

            <Button
              label="Add Leader to Directory"
              onPress={handleAddLeader}
              loading={creating}
              variant="primary"
              size="md"
              style={{ marginTop: spacing.xs }}
            />
          </View>

          {/* Current Leaders List */}
          <View style={styles.listSection}>
            <SectionHeader title="Published Leadership Roster" badge={leaders.length} />
            {directory.loading ? (
              <Skeleton height={80} count={3} />
            ) : directory.error && !directory.data ? (
              <ResourceError message={directory.error} retry={directory.refresh} />
            ) : leaders.length > 0 ? (
              leaders.map((leader) => (
                <LeaderCard
                  key={leader.id}
                  leader={leader}
                  variant="standard"
                />
              ))
            ) : (
              <EmptyState
                title="No Leaders Registered"
                message="Add your pastoral staff and ministry coordinators using the form above."
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
