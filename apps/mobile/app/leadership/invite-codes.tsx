import React, { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api';
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

  const [createOpen, setCreateOpen] = useState(false);
  const [validityHours, setValidityHours] = useState('168');
  const [usageLimit, setUsageLimit] = useState('');
  const [generated, setGenerated] = useState<GeneratedCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const resource = useResource<InviteCodeMetadata[]>(
    `expression:invite-codes:${expression?.id ?? 'none'}:${canManage}`,
    (signal) =>
      canManage
        ? api.request<InviteCodeMetadata[]>('expression-memberships?view=codes', { signal })
        : Promise.resolve([]),
  );

  const openCreate = () => {
    setValidityHours('168');
    setUsageLimit('');
    setGenerated(null);
    setMessage('');
    setError('');
    setCreateOpen(true);
  };

  if (!expression?.id) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Invite codes" kicker="EXPRESSION" showBack />
        <View style={styles.emptyPad}>
          <EmptyState title="Enter an Expression first" message="Invite codes belong to one contained Expression and are never managed from public context." iconName="people-outline" />
        </View>
      </View>
    );
  }

  if (!canManage) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Invite codes" kicker="EXPRESSION" showBack />
        <View style={styles.emptyPad}>
          <EmptyState title="Invite access is not assigned" message="The members.invite capability is required in this Expression." iconName="lock-closed-outline" />
        </View>
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
      setMessage('This full code is shown only now. Copy or share it before closing.');
      await resource.refresh();
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
    setMessage('');
    try {
      await api.request('expression-memberships', { method: 'DELETE', body: JSON.stringify({ codeId: id }) });
      setMessage('Invite code revoked.');
      if (generated?.id === id) setGenerated(null);
      await resource.refresh();
    } catch (value) {
      setError(value instanceof ApiError ? value.message : 'Unable to revoke this invite code.');
    } finally {
      setBusyId('');
    }
  };

  const codes = resource.data ?? [];

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
            title="Invite codes"
            kicker="EXPRESSION"
            subtitle={`Invite-only membership for ${expression.name}.`}
            showBack
            rightAction={<Button label="New code" onPress={openCreate} size="sm" />}
          />
        </View>

        <View style={styles.body}>
          {error && !createOpen ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={17} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{error}</Text>
            </View>
          ) : null}
          {message && !createOpen ? (
            <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Icon name="checkmark-circle" size={17} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>{message}</Text>
            </View>
          ) : null}

          <View style={[styles.securityCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={[styles.securityIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="key-outline" size={21} color={colors.interactive} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.securityTitle, { color: colors.text }]}>Secure, revocable access</Text>
              <Text style={[styles.securityCopy, { color: colors.textSecondary }]}>Codes can expire, have usage limits and be revoked without changing membership already accepted.</Text>
            </View>
          </View>

          <View style={styles.listSection}>
            <SectionHeader title="Managed codes" badge={codes.length} subtitle="Only hints and usage metadata remain after code creation" actionLabel="New" onAction={openCreate} />
            {resource.loading && !resource.data ? (
              <Skeleton height={104} count={3} />
            ) : resource.error && !resource.data ? (
              <ResourceError message={resource.error} retry={resource.refresh} />
            ) : codes.length ? (
              codes.map((item) => (
                <View key={item.id} style={[styles.codeRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                  <View style={styles.flex}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>Code ending {item.code_hint}</Text>
                      <Badge label={item.status.toUpperCase()} variant={item.status === 'active' ? 'active' : 'neutral'} />
                    </View>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      {item.usage_count}{item.usage_limit ? ` of ${item.usage_limit}` : ''} uses · Created {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {item.expires_at ? `Expires ${new Date(item.expires_at).toLocaleString()}` : 'No expiry'}
                    </Text>
                  </View>
                  {item.status === 'active' ? (
                    <Button label="Revoke" variant="destructive" size="sm" loading={busyId === item.id} onPress={() => void revoke(item.id)} />
                  ) : null}
                </View>
              ))
            ) : (
              <EmptyState
                title="No invite codes"
                message="Generate a time-limited code when you are ready to invite members."
                iconName="key-outline"
                actionLabel="New code"
                onAction={openCreate}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title={generated ? 'Invite code ready' : 'Generate invite code'}
        subtitle={generated ? 'The full code will not be recoverable after you close this sheet.' : `For ${expression.name}`}
        maxHeightPercent={90}
      >
        {generated ? (
          <View style={styles.generatedSheet}>
            <Badge label="SHOWING ONCE" variant="warning" />
            <Text selectable style={[styles.code, { color: colors.text }]}>{generated.inviteCode}</Text>
            {message ? <Text style={[styles.sheetMessage, { color: colors.textSecondary }]}>{message}</Text> : null}
            <View style={styles.actions}>
              <Button label="Copy" variant="outline" onPress={() => void copyCode()} style={styles.flexButton} />
              <Button label="Share" onPress={() => void shareCode()} style={styles.flexButton} />
            </View>
            <Button label="Done" onPress={() => setCreateOpen(false)} size="lg" fullWidth />
          </View>
        ) : (
          <View style={styles.form}>
            {error ? (
              <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
                <Icon name="alert-circle" size={17} color={colors.live} />
                <Text style={[styles.bannerText, { color: colors.live }]}>{error}</Text>
              </View>
            ) : null}
            <InputField
              label="Valid for hours"
              value={validityHours}
              onChangeText={setValidityHours}
              keyboardType="number-pad"
              helperText="168 hours = 7 days. Maximum is 2160 hours."
            />
            <InputField
              label="Usage limit (optional)"
              value={usageLimit}
              onChangeText={setUsageLimit}
              keyboardType="number-pad"
              placeholder="Unlimited"
            />
            <Button label="Generate secure code" onPress={() => void generate()} loading={busy} size="lg" fullWidth />
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xl },
  emptyPad: { paddingHorizontal: spacing.md },
  flex: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  securityCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  securityIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  securityTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.15 },
  securityCopy: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  listSection: { gap: spacing.sm },
  codeRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  rowTitle: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  form: { gap: spacing.md },
  generatedSheet: { alignItems: 'flex-start', gap: spacing.md },
  code: { fontSize: 24, fontWeight: '800', letterSpacing: 1.2 },
  sheetMessage: { fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  flexButton: { flex: 1 },
});
