import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  BottomSheet,
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

interface ExpressionItem {
  id: string;
  name: string;
  code: string;
  timezone?: string;
  is_active?: boolean;
}
interface CreatorState {
  organizationId: string;
  authorized: boolean;
}

export default function ExpressionsManageScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [timezone, setTimezone] = useState(detectedTimezone);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const expressions = useResource<ExpressionItem[]>('leadership:expressions', (signal) =>
    api.request<ExpressionItem[]>('branches', { signal })
  );
  const creatorState = useResource<CreatorState>(`expression-creator:${organizationId}`, (signal) => {
    if (!organizationId) return Promise.resolve({ organizationId: '', authorized: false });
    return api.request<CreatorState>(`expression-creators?mode=self&organizationId=${organizationId}`, { signal });
  });
  const canCreateExpression = creatorState.data?.authorized === true;
  const list = expressions.data ?? [];

  const resetForm = () => {
    setName('');
    setCode('');
    setTimezone(detectedTimezone);
    setErrorMsg('');
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const handleCreateExpression = async () => {
    if (!canCreateExpression) return;
    if (!name.trim() || !code.trim()) {
      setErrorMsg('Enter both an Expression name and unique code.');
      return;
    }

    setCreating(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const created = await api.request<ExpressionItem>('branches', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          timezone: timezone.trim() || detectedTimezone,
        }),
      });
      resetForm();
      setCreateOpen(false);
      setSuccessMsg(`${created.name} is ready. You are its owner and Expression Admin.`);
      await expressions.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create Expression.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader
            title="Expressions"
            kicker="LEADERSHIP"
            subtitle="Create and review church community spaces."
            showBack
            rightAction={canCreateExpression ? <Button label="New" onPress={openCreate} size="sm" /> : undefined}
          />
        </View>

        <View style={styles.body}>
          {successMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Icon name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>{successMsg}</Text>
            </View>
          ) : null}

          {creatorState.loading ? (
            <Skeleton height={74} />
          ) : canCreateExpression ? (
            <View style={[styles.creatorCard, { backgroundColor: colors.card, borderColor: colors.interactive }, shadows.sm]}>
              <View style={[styles.creatorIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="add-circle-outline" size={22} color={colors.interactive} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.creatorTitle, { color: colors.text }]}>Expression creation enabled</Text>
                <Text style={[styles.creatorCopy, { color: colors.textSecondary }]}>
                  Platform Authority has approved this account to create Expressions for this church.
                </Text>
              </View>
              <Button label="Create" onPress={openCreate} size="sm" variant="secondary" />
            </View>
          ) : (
            <View style={[styles.creatorCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <View style={[styles.creatorIcon, { backgroundColor: colors.bgSecondary }]}>
                <Icon name="shield-checkmark-outline" size={22} color={colors.textMuted} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.creatorTitle, { color: colors.text }]}>Creation is controlled by Platform Authority</Text>
                <Text style={[styles.creatorCopy, { color: colors.textSecondary }]}>
                  You can view Expressions here. The Create action appears automatically when your account is authorized.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.listSection}>
            <SectionHeader title="Church Expressions" badge={list.length} subtitle="Open a space to view its public profile and community context" />
            {expressions.loading ? (
              <Skeleton height={92} count={2} />
            ) : expressions.error && !expressions.data ? (
              <ResourceError message={expressions.error} retry={expressions.refresh} />
            ) : list.length ? (
              list.map((expression) => (
                <View
                  key={expression.id}
                  style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}
                >
                  <View style={[styles.expressionIcon, { backgroundColor: colors.primarySoft }]}>
                    <Icon name="people-outline" size={20} color={colors.interactive} />
                  </View>
                  <View style={styles.tileInfo}>
                    <Text style={[styles.tileTitle, { color: colors.text }]} numberOfLines={1}>{expression.name}</Text>
                    <Text style={[styles.tileMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      {expression.code}{expression.timezone ? ` · ${expression.timezone}` : ''}
                    </Text>
                  </View>
                  <Badge
                    label={expression.is_active === false ? 'INACTIVE' : 'ACTIVE'}
                    variant={expression.is_active === false ? 'neutral' : 'success'}
                  />
                  <Button
                    label="Open"
                    onPress={() => router.push(`/expression/${expression.id}` as any)}
                    variant="ghost"
                    size="sm"
                  />
                </View>
              ))
            ) : (
              <EmptyState
                title="No Expressions yet"
                message={canCreateExpression ? 'Create the first Expression for this church.' : 'Expressions will appear here after an authorized creator adds them.'}
                iconName="people-outline"
                actionLabel={canCreateExpression ? 'Create Expression' : undefined}
                onAction={canCreateExpression ? openCreate : undefined}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title="Create Expression"
        subtitle="You will become the owner and Expression Admin."
        maxHeightPercent={90}
      >
        <View style={styles.form}>
          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={18} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <InputField
            label="Expression name"
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (!code) setCode(value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase());
            }}
            placeholder="Awka Expression"
          />
          <InputField
            label="Expression code"
            value={code}
            onChangeText={(value) => setCode(value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="AWKA-01"
            helperText="Use a short unique code with letters, numbers, hyphens or underscores."
          />
          <InputField
            label="Timezone"
            value={timezone}
            onChangeText={setTimezone}
            autoCapitalize="none"
            placeholder="Africa/Lagos"
          />
          <Button label="Create Expression" onPress={() => void handleCreateExpression()} loading={creating} size="lg" fullWidth />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xl },
  flex: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  creatorCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1 },
  creatorIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  creatorTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.15 },
  creatorCopy: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  listSection: { gap: spacing.sm },
  tile: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1 },
  expressionIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  tileInfo: { flex: 1, minWidth: 0, gap: 2 },
  tileTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  tileMeta: { fontSize: 11, fontWeight: '600' },
  form: { gap: spacing.md },
});
