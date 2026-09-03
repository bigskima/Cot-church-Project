import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { Badge, Button, EmptyState, Icon, InputField, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

interface ExpressionItem { id: string; name: string; code: string; timezone?: string; is_active?: boolean; }
interface CreatorState { organizationId: string; authorized: boolean; }

export default function ExpressionsManageScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [timezone, setTimezone] = useState(detectedTimezone);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const expressions = useResource<ExpressionItem[]>('leadership:expressions', (signal) => api.request<ExpressionItem[]>('branches', { signal }));
  const creatorState = useResource<CreatorState>(`expression-creator:${organizationId}`, (signal) => {
    if (!organizationId) return Promise.resolve({ organizationId: '', authorized: false });
    return api.request<CreatorState>(`expression-creators?mode=self&organizationId=${organizationId}`, { signal });
  });
  const canCreateExpression = creatorState.data?.authorized === true;

  const handleCreateExpression = async () => {
    if (!canCreateExpression) return;
    if (!name.trim() || !code.trim()) { setErrorMsg('Please provide both an Expression name and unique code.'); return; }
    setBootstrapping(true); setErrorMsg(''); setSuccessMsg('');
    try {
      await api.request('branches', { method: 'POST', body: JSON.stringify({ name: name.trim(), code: code.trim().toUpperCase(), timezone }) });
      const createdName = name.trim();
      setName(''); setCode('');
      setSuccessMsg(`Expression “${createdName}” created. You are now its Expression Admin and owner.`);
      expressions.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create Expression.');
    } finally { setBootstrapping(false); }
  };

  const list = expressions.data ?? [];
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: 60 }]}>
        <ScreenHeader title="Expressions" subtitle="View church Expressions and create a new one only when Platform Authority has authorized you." showBack />
        <View style={styles.body}>
          {successMsg ? <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.bannerText, { color: colors.success }]}>{successMsg}</Text></View> : null}
          {errorMsg ? <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text></View> : null}

          {creatorState.loading ? <Skeleton height={120} /> : canCreateExpression ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
              <View style={styles.cardHeader}><Icon name="add-circle-outline" size={18} color={colors.interactive} /><Text style={[styles.cardTitle, { color: colors.text }]}>Create an Expression</Text></View>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>Platform Authority has authorized your account to create Expressions. The Expression you create will be owned by you and you will receive Expression Admin authority for that Expression only.</Text>
              <InputField label="Expression Name" value={name} onChangeText={(val) => { setName(val); if (!code) setCode(val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()); }} placeholder="e.g. Awka Expression" />
              <InputField label="Expression Code" value={code} onChangeText={(val) => setCode(val.toUpperCase())} placeholder="e.g. AWKA-01" />
              <InputField label="Timezone" value={timezone} onChangeText={setTimezone} placeholder="e.g. Africa/Lagos" />
              <Button label="Create Expression" onPress={handleCreateExpression} loading={bootstrapping} variant="primary" size="md" style={{ marginTop: spacing.xs }} />
            </View>
          ) : null}

          <View style={styles.listSection}>
            <SectionHeader title="Church Expressions" badge={list.length} />
            {expressions.loading ? <Skeleton height={80} count={2} /> : expressions.error && !expressions.data ? (
              <ResourceError message={expressions.error} retry={expressions.refresh} />
            ) : list.length ? list.map((exp) => (
              <View key={exp.id} style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
                <View style={styles.tileInfo}><Text style={[styles.tileTitle, { color: colors.text }]}>{exp.name}</Text><Text style={[styles.tileMeta, { color: colors.interactive }]}>{exp.code}{exp.timezone ? ` · ${exp.timezone}` : ''}</Text></View>
                <Badge label={exp.is_active === false ? 'INACTIVE' : 'ACTIVE'} variant={exp.is_active === false ? 'neutral' : 'primary'} />
              </View>
            )) : <EmptyState title="No Expressions registered" message="Expressions will appear here after they are created by an authorized creator." iconName="business-outline" />}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 }, bannerText: { fontSize: 13, fontWeight: '600', flex: 1 },
  card: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, cardTitle: { fontSize: 16, fontWeight: '700' }, helper: { fontSize: 12, lineHeight: 18 },
  listSection: { gap: spacing.xs }, tile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.xs }, tileInfo: { flex: 1, gap: 2 }, tileTitle: { fontSize: 15, fontWeight: '700' }, tileMeta: { fontSize: 12, fontWeight: '600' },
});
