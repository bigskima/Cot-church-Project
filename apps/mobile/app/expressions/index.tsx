import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api';
import { Badge, Button, EmptyState, Icon, InputField, ScreenHeader } from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type InvitePreview = {
  organization_name: string;
  expression_name: string;
  expires_at?: string | null;
};

type RedeemResult = {
  organization_id: string;
  branch_id: string;
  expression_name: string;
};

export default function ExpressionsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { api, auth, context, mode, enterExpression, leaveExpression, selectContext } = useSession();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const expressions = useMemo(() => context?.expressions ?? [], [context?.expressions]);
  const activeExpressionId = context?.expression?.id;

  if (mode === 'visitor') {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ScreenHeader title="My Expressions" showBack />
        <EmptyState title="Sign in to join an Expression" message="Public content remains available without an account. Expression membership and entry require authentication." iconName="lock-closed-outline" actionLabel="Sign In" onAction={() => router.push('/(auth)/login')} />
      </View>
    );
  }

  const validateCode = async () => {
    const normalized = code.trim();
    if (!normalized) {
      setError('Enter the invite code shared by your Expression leader.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      setPreview(await api.request<InvitePreview>('expression-memberships', {
        method: 'POST',
        body: JSON.stringify({ action: 'preview', code: normalized }),
      }));
    } catch (value) {
      setPreview(null);
      setError(value instanceof ApiError ? value.message : 'We couldn’t validate this invite code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const confirmJoin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.request<RedeemResult>('expression-memberships', {
        method: 'POST',
        body: JSON.stringify({ action: 'redeem', code: code.trim() }),
      });
      setPreview(null);
      setCode('');
      setSuccess(`You joined ${result.expression_name}. You can now enter its private space.`);
      await selectContext(result.organization_id);
    } catch (value) {
      setError(value instanceof ApiError ? value.message : 'We couldn’t join this Expression. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader title="Expressions" kicker="YOUR SPACES" subtitle="Enter a community you belong to, or join one with an invite code." showBack />
        </View>

        {activeExpressionId ? (
          <View style={[styles.activeCard, { backgroundColor: colors.primarySoft, borderColor: colors.interactive }]}>
            <View style={styles.row}>
              <Icon name="people" size={22} color={colors.interactive} />
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{context?.expression?.name}</Text>
                <Text style={[styles.copy, { color: colors.textSecondary }]}>You’re currently inside this private community space.</Text>
              </View>
              <Badge label="ACTIVE" variant="active" />
            </View>
            <Button label="Leave Expression" variant="outline" onPress={async () => { await leaveExpression(); router.replace('/(tabs)/home'); }} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.heading, { color: colors.text }]}>Your memberships</Text>
          {expressions.length ? expressions.map((expression) => (
            <View key={expression.membershipId} style={[styles.membershipCard, { backgroundColor: colors.card, borderColor: activeExpressionId === expression.id ? colors.interactive : colors.borderSubtle }, shadows.sm]}>
              <View style={[styles.expressionIcon, { backgroundColor: colors.primarySoft }]}><Icon name="people-outline" size={22} color={colors.interactive} /></View>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{expression.name}</Text>
                <Text style={[styles.copy, { color: colors.textSecondary }]}>{expression.code || 'Expression member'}</Text>
              </View>
              <Button
                label={activeExpressionId === expression.id ? 'Entered' : 'Enter'}
                size="sm"
                variant={activeExpressionId === expression.id ? 'outline' : 'primary'}
                disabled={activeExpressionId === expression.id}
                onPress={async () => { await enterExpression(expression.organizationId, expression.id); router.replace('/(tabs)/home'); }}
              />
            </View>
          )) : (
            <EmptyState title="No Expression memberships yet" message="Use an invite code from an authorized Expression leader to join." iconName="people-outline" />
          )}
        </View>

        <View style={[styles.joinCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <Text style={[styles.heading, { color: colors.text }]}>Join an Expression</Text>
          <Text style={[styles.copy, { color: colors.textSecondary }]}>Invite-only spaces stay private until you join.</Text>
          <InputField
            label="Invite code"
            value={code}
            onChangeText={(value) => { setCode(value.toUpperCase()); setPreview(null); setError(''); }}
            placeholder="COT-XXXX-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            error={error || undefined}
            accessibilityLabel="Expression invite code"
          />
                    {success ? <Text style={[styles.message, { color: colors.success }]} accessibilityRole="alert">{success}</Text> : null}
          {preview ? (
            <View style={[styles.preview, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
              <Icon name="checkmark-circle" size={24} color={colors.success} />
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{preview.expression_name}</Text>
                <Text style={[styles.copy, { color: colors.textSecondary }]}>{preview.organization_name}</Text>
                {preview.expires_at ? <Text style={[styles.meta, { color: colors.textMuted }]}>Code expires {new Date(preview.expires_at).toLocaleString()}</Text> : null}
              </View>
            </View>
          ) : null}
          <Button label={preview ? 'Confirm and Join' : 'Validate Invite Code'} loading={loading} onPress={preview ? confirmJoin : validateCode} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.xl },
  section: { gap: spacing.sm },
  heading: { ...typography.h3 },
  heroCard: { borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  activeCard: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.md },
  joinCard: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.md },
  membershipCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  expressionIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  copy: { ...typography.bodySmall, lineHeight: 18 },
  meta: { fontSize: 11, marginTop: 4 },
  preview: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  message: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
