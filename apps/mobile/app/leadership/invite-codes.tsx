import React, { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api';
import { Badge, Button, EmptyState, Icon, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type InviteCodeMetadata = {
  id: string;
  code_hint: string;
  status: 'active' | 'revoked' | 'expired';
  expires_at?: string | null;
  usage_limit?: number | null;
  usage_count: number;
  created_at: string;
  revoked_at?: string | null;
};

type GeneratedCode = {
  id: string;
  inviteCode: string;
  codeHint: string;
  expiresAt?: string | null;
  usageLimit?: number | null;
};

export default function ExpressionInviteCodesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { api, context, hasCapability } = useSession();
  const expression = context?.expression;
  const canManage = Boolean(expression?.id) && (hasCapability('members.invite') || hasCapability('*'));
  const [validityHours, setValidityHours] = useState('168');
  const [usageLimit, setUsageLimit] = useState('');
  const [generated, setGenerated] = useState<GeneratedCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const resource = useResource<InviteCodeMetadata[]>(
    `expression:invite-codes:${expression?.id ?? 'none'}:${canManage}`,
    (signal) => canManage
      ? api.request<InviteCodeMetadata[]>('expression-memberships?view=codes', { signal })
      : Promise.resolve([]),
  );

  if (!expression?.id) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ScreenHeader title="Expression Invite Codes" showBack />
        <EmptyState title="Enter an Expression first" message="Invite codes belong to one contained Expression and cannot be managed from public context." iconName="business-outline" />
      </View>
    );
  }

  if (!canManage) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ScreenHeader title="Expression Invite Codes" showBack />
        <EmptyState title="You don’t have permission" message="The members.invite capability is required in this Expression." iconName="lock-closed-outline" />
      </View>
    );
  }

  const generate = async () => {
    const hours = Number(validityHours);
    const limit = usageLimit.trim() ? Number(usageLimit) : undefined;
    if (!Number.isInteger(hours) || hours < 1 || hours > 2160) {
      setError('Expiry must be between 1 and 2160 hours.');
      return;
    }
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100000)) {
      setError('Usage limit must be between 1 and 100000.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const value = await api.request<GeneratedCode>('expression-memberships', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate', validityHours: hours, usageLimit: limit }),
      });
      setGenerated(value);
      setMessage('Invite code created. Copy or share it now; the full code will not be shown again.');
      resource.refresh();
    } catch (value) {
      setError(value instanceof ApiError ? value.message : 'Unable to generate an invite code.');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!generated) return;
    await Clipboard.setStringAsync(generated.inviteCode);
    setMessage('Invite code copied.');
  };

  const shareCode = async () => {
    if (!generated) return;
    await Share.share({ message: `Join ${expression.name} on City of Transformation with invite code ${generated.inviteCode}` });
  };

  const revoke = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      await api.request('expression-memberships', { method: 'DELETE', body: JSON.stringify({ codeId: id }) });
      setMessage('Invite code revoked.');
      if (generated?.id === id) setGenerated(null);
      resource.refresh();
    } catch (value) {
      setError(value instanceof ApiError ? value.message : 'Unable to revoke this invite code.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Expression Invite Codes" subtitle={`Invite-only membership for ${expression.name}`} showBack />

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
          <Text style={[styles.heading, { color: colors.text }]}>Generate a secure code</Text>
          <Text style={[styles.copy, { color: colors.textSecondary }]}>The backend creates and hashes the code. Only its final characters and usage metadata remain visible after this session.</Text>
          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>VALID FOR HOURS</Text>
              <TextInput value={validityHours} onChangeText={setValidityHours} keyboardType="number-pad" style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>USAGE LIMIT (OPTIONAL)</Text>
              <TextInput value={usageLimit} onChangeText={setUsageLimit} keyboardType="number-pad" placeholder="Unlimited" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} />
            </View>
          </View>
          <Button label="Generate Invite Code" onPress={generate} loading={busy} icon={<Icon name="key-outline" size={17} color={colors.textInverse} />} />
        </View>

        {generated ? (
          <View style={[styles.generatedCard, { backgroundColor: colors.primarySoft, borderColor: colors.interactive }]}>
            <Badge label="SHOWING ONCE" variant="warning" />
            <Text selectable style={[styles.code, { color: colors.text }]}>{generated.inviteCode}</Text>
            <Text style={[styles.copy, { color: colors.textSecondary }]}>Store this code securely. It cannot be recovered after leaving this screen.</Text>
            <View style={styles.actions}><Button label="Copy" variant="outline" onPress={copyCode} style={styles.flexButton} /><Button label="Share" onPress={shareCode} style={styles.flexButton} /></View>
          </View>
        ) : null}

        {error ? <Text style={[styles.message, { color: colors.live }]} accessibilityRole="alert">{error}</Text> : null}
        {message ? <Text style={[styles.message, { color: colors.success }]} accessibilityRole="alert">{message}</Text> : null}

        <View style={styles.listSection}>
          <Text style={[styles.heading, { color: colors.text }]}>Managed codes</Text>
          {resource.loading && !resource.data ? <Skeleton height={108} count={3} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : (resource.data ?? []).length ? (resource.data ?? []).map((item) => (
            <View key={item.id} style={[styles.codeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.flex}>
                <View style={styles.titleRow}><Text style={[styles.rowTitle, { color: colors.text }]}>Code ending {item.code_hint}</Text><Badge label={item.status.toUpperCase()} variant={item.status === 'active' ? 'active' : 'neutral'} /></View>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.usage_count}{item.usage_limit ? ` of ${item.usage_limit}` : ''} use(s) · Created {new Date(item.created_at).toLocaleDateString()}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{item.expires_at ? `Expires ${new Date(item.expires_at).toLocaleString()}` : 'No expiry'}</Text>
              </View>
              {item.status === 'active' ? <Button label="Revoke" variant="destructive" size="sm" loading={busyId === item.id} onPress={() => void revoke(item.id)} /> : null}
            </View>
          )) : <EmptyState title="No invite codes" message="Generate a time-limited code when you are ready to invite members." iconName="key-outline" />}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  generatedCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, alignItems: 'flex-start' },
  heading: { ...typography.h3 }, copy: { ...typography.bodySmall, lineHeight: 18 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, field: { flex: 1, minWidth: 140, gap: 5 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7 }, input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15 },
  code: { fontSize: 23, fontWeight: '800', letterSpacing: 1.2 }, actions: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' }, flexButton: { flex: 1 },
  message: { fontSize: 13, lineHeight: 18, fontWeight: '600' }, listSection: { gap: spacing.sm },
  codeRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  flex: { flex: 1 }, titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }, rowTitle: { fontSize: 14, fontWeight: '700' }, meta: { fontSize: 11, lineHeight: 16, marginTop: 3 },
});
