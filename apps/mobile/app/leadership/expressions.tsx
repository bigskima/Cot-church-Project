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
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { CampusBranch } from '@/types/content';

export default function ExpressionsManageScreen() {
  const insets = useSafeAreaInsets();
  const { api } = useSession();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [address, setAddress] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const branches = useResource<CampusBranch[]>('leadership:branches', (signal) =>
    api.request<CampusBranch[]>('branches', { signal })
  );

  const handleCreateBranch = async () => {
    if (!name.trim() || !code.trim()) {
      setErrorMsg('Please enter both an expression name and a short code.');
      return;
    }
    setCreating(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.request('branches', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          timezone,
          address: address.trim() || null,
          is_active: true,
        }),
      });
      setName('');
      setCode('');
      setAddress('');
      setSuccessMsg('Campus expression provisioned successfully.');
      branches.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to provision campus expression.');
    } finally {
      setCreating(false);
    }
  };

  const branchList = branches.data ?? [];

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
          title="Campus Expressions & Branches"
          subtitle="Provision new satellite campuses, church planting centers, and local expressions."
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

          {/* Provisioning Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.cardHeader}>
              <Icon name="business-outline" size={18} color={colors.interactive} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Provision New Campus Expression</Text>
            </View>

            <InputField
              label="Campus / Expression Name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Manchester Sanctuary Campus"
            />

            <InputField
              label="Short Code (Identifier)"
              value={code}
              onChangeText={setCode}
              placeholder="e.g. MAN-01, LON-NORTH"
            />

            <InputField
              label="Local Timezone"
              value={timezone}
              onChangeText={setTimezone}
              placeholder="e.g. Europe/London, America/New_York"
            />

            <InputField
              label="Physical Address / Location"
              value={address}
              onChangeText={setAddress}
              placeholder="Street address, city, postcode"
            />

            <Button
              label="Provision Campus"
              onPress={handleCreateBranch}
              loading={creating}
              variant="primary"
              size="md"
              style={{ marginTop: spacing.xs }}
            />
          </View>

          {/* Existing Expressions List */}
          <View style={styles.listSection}>
            <SectionHeader title="Active Church Expressions" badge={branchList.length} />
            {branches.loading ? (
              <Skeleton height={80} count={2} />
            ) : branchList.length > 0 ? (
              branchList.map((b) => (
                <View
                  key={b.id}
                  style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                >
                  <View style={styles.tileInfo}>
                    <Text style={[styles.tileTitle, { color: colors.text }]}>{b.name}</Text>
                    <Text style={[styles.tileSub, { color: colors.interactive }]}>{b.code}</Text>
                    {b.timezone ? (
                      <Text style={[styles.tileDate, { color: colors.textMuted }]}>{b.timezone}</Text>
                    ) : null}
                  </View>
                  <Badge label="ACTIVE" variant="success" />
                </View>
              ))
            ) : (
              <EmptyState
                title="No Expressions Provisioned"
                message="Use the form above to add your first satellite expression."
                iconName="business-outline"
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
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  tileInfo: {
    flex: 1,
    gap: 2,
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  tileSub: {
    fontSize: 12,
    fontWeight: '700',
  },
  tileDate: {
    fontSize: 11,
  },
});
