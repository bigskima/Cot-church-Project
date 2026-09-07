import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, Icon, InputField, ResourceError, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { toUserFacingErrorMessage } from '@/api';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

type ExpressionRecord = {
  id: string;
  name: string;
  code: string;
  timezone?: string | null;
  is_active?: boolean;
};

function validCode(value: string) {
  return /^[A-Z0-9][A-Z0-9_-]*$/.test(value);
}

export default function ExpressionSettingsScreen() {
  const { api, context, refreshContext } = useSession();
  const { colors } = useTheme();
  const access = useExpressionManagementAccess();
  const id = access.expressionId;

  const records = useResource<ExpressionRecord[]>(
    `expression:settings:${id || 'none'}`,
    (signal) => id ? api.request<ExpressionRecord[]>('branches', { signal }) : Promise.resolve([]),
  );

  const current = useMemo(
    () => (records.data ?? []).find((item) => item.id === id) ?? null,
    [id, records.data],
  );

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [timezone, setTimezone] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!current) return;
    setName(current.name ?? '');
    setCode(current.code ?? '');
    setTimezone(current.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, [current?.id, current?.name, current?.code, current?.timezone]);

  const dirty = Boolean(
    current &&
    (
      name.trim() !== current.name ||
      code.trim().toUpperCase() !== current.code ||
      timezone.trim() !== (current.timezone ?? '')
    ),
  );

  const save = async () => {
    const normalizedName = name.trim();
    const normalizedCode = code.trim().toUpperCase();
    const normalizedTimezone = timezone.trim();

    if (!normalizedName) return setError('Enter an Expression name.');
    if (!normalizedCode || !validCode(normalizedCode)) {
      return setError('Use a code made of letters, numbers, hyphens or underscores.');
    }
    if (!normalizedTimezone) return setError('Enter the Expression timezone.');

    setSaving(true);
    setError('');
    setFeedback('');
    try {
      await api.request<ExpressionRecord>(`branches?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: normalizedName,
          code: normalizedCode,
          timezone: normalizedTimezone,
        }),
      });
      setFeedback('Expression settings updated.');
      await records.refresh();
      refreshContext();
    } catch (value) {
      setError(toUserFacingErrorMessage(value, 'We couldn’t save these Expression settings. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ExpressionManagementGate
      ready={access.ready}
      allowed={access.canManageSettings}
      expressionId={id}
      title="Expression settings unavailable"
    >
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="settings-outline" size={23} color={colors.interactive} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION SETTINGS</Text>
            <Text style={[styles.title, { color: colors.text }]}>Expression Settings</Text>
            <Text style={[styles.copy, { color: colors.textSecondary }]}>
              Update member-facing identity for {context?.expression?.name ?? 'this Expression'}.
            </Text>
          </View>
        </View>

        {feedback ? (
          <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
            <Icon name="checkmark-circle-outline" size={18} color={colors.success} />
            <Text style={[styles.bannerText, { color: colors.success }]}>{feedback}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
            <Icon name="alert-circle-outline" size={18} color={colors.live} />
            <Text style={[styles.bannerText, { color: colors.live }]}>{error}</Text>
          </View>
        ) : null}

        {records.loading && !records.data ? (
          <Skeleton height={78} count={4} />
        ) : records.error && !records.data ? (
          <ResourceError message={records.error} retry={records.refresh} />
        ) : !current ? (
          <EmptyState
            title="Expression settings unavailable"
            message="We couldn’t load this Expression’s settings. Return to the Expression and try again."
            iconName="alert-circle-outline"
          />
        ) : (
          <>
            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <InputField
                label="Expression name"
                value={name}
                onChangeText={setName}
                placeholder="Expression name"
              />
              <InputField
                label="Expression code"
                value={code}
                onChangeText={(value) => setCode(value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="AWKA-01"
                helperText="A short, unique code members can recognize and use when needed."
              />
              <InputField
                label="Timezone"
                value={timezone}
                onChangeText={setTimezone}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Africa/Lagos"
                helperText="Used for dates, schedules and local Expression experiences."
              />
              <Button
                label="Save Expression Settings"
                onPress={() => void save()}
                loading={saving}
                disabled={!dirty}
                size="lg"
                fullWidth
              />
            </View>

            <View style={[styles.boundary, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
              <Icon name="shield-checkmark-outline" size={18} color={colors.interactive} />
              <Text style={[styles.boundaryText, { color: colors.textSecondary }]}>
                This page updates the Expression name, member code and timezone. Other church controls are managed separately.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </ExpressionManagementGate>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: 90,
    gap: spacing.md,
  },
  hero: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  icon: { width: 46, height: 46, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '800', marginTop: 2 },
  copy: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  formCard: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.md },
  banner: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  boundary: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  boundaryText: { flex: 1, fontSize: 11, lineHeight: 17 },
});
