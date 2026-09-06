import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Icon, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

type NotificationPreferences = {
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  quiet_hours?: {
    enabled?: boolean;
    startTime?: string;
    endTime?: string;
  } | Record<string, unknown>;
  updated_at?: string | null;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();
  const [preferences, setPreferences] = React.useState<NotificationPreferences | null>(null);
  const [emailEnabled, setEmailEnabled] = React.useState(true);
  const [smsEnabled, setSmsEnabled] = React.useState(true);
  const [pushEnabled, setPushEnabled] = React.useState(true);
  const [quietEnabled, setQuietEnabled] = React.useState(false);
  const [quietStart, setQuietStart] = React.useState('22:00');
  const [quietEnd, setQuietEnd] = React.useState('07:00');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const organizationId = context?.organization?.id;

  const applyPreferences = React.useCallback((data: NotificationPreferences) => {
    setPreferences(data);
    setEmailEnabled(data.email_enabled !== false);
    setSmsEnabled(data.sms_enabled !== false);
    setPushEnabled(data.push_enabled !== false);
    const quiet = data.quiet_hours && typeof data.quiet_hours === 'object' ? data.quiet_hours : {};
    setQuietEnabled(quiet.enabled === true);
    setQuietStart(typeof quiet.startTime === 'string' && TIME_PATTERN.test(quiet.startTime) ? quiet.startTime : '22:00');
    setQuietEnd(typeof quiet.endTime === 'string' && TIME_PATTERN.test(quiet.endTime) ? quiet.endTime : '07:00');
  }, []);

  const load = React.useCallback(async () => {
    if (mode !== 'authenticated' || !organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.request<NotificationPreferences>('notification-settings');
      applyPreferences(data);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load notification preferences.');
    } finally {
      setLoading(false);
    }
  }, [api, applyPreferences, mode, organizationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!TIME_PATTERN.test(quietStart) || !TIME_PATTERN.test(quietEnd)) {
      setError('Quiet hours must use 24-hour time, for example 22:00 and 07:00.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await api.request<NotificationPreferences>('notification-settings', {
        method: 'PUT',
        body: JSON.stringify({
          emailEnabled,
          smsEnabled,
          pushEnabled,
          quietHours: {
            enabled: quietEnabled,
            startTime: quietStart,
            endTime: quietEnd,
          },
        }),
      });
      applyPreferences(data);
      setSuccess('Notification preferences saved.');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save notification preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (mode !== 'authenticated') {
    return (
      <View style={[styles.stateScreen, { backgroundColor: colors.bg }]}>
        <EmptyState title="Sign in to manage alerts" message="Notification preferences are available with your COT member account." iconName="notifications-outline" />
      </View>
    );
  }

  if (!organizationId) {
    return (
      <View style={[styles.stateScreen, { backgroundColor: colors.bg }]}>
        <EmptyState title="No active church membership" message="Notification delivery preferences become available when your account has an active church membership." iconName="business-outline" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 130 }]}
      >
        <ScreenHeader
          title="Notifications & alerts"
          kicker="PREFERENCES"
          subtitle="Choose how COT reaches you without changing what remains available in your in-app inbox."
          showBack
        />

        {loading && !preferences ? (
          <View style={styles.stack}><Skeleton height={170} /><Skeleton height={170} /></View>
        ) : error && !preferences ? (
          <ResourceError message={error} retry={() => void load()} />
        ) : (
          <View style={styles.stack}>
            {success ? (
              <Pressable onPress={() => setSuccess('')} style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
                <Icon name="checkmark-circle-outline" size={18} color={colors.success} />
                <Text style={[styles.bannerText, { color: colors.success }]}>{success}</Text>
                <Icon name="close" size={15} color={colors.success} />
              </Pressable>
            ) : null}
            {error ? (
              <Pressable onPress={() => setError('')} style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
                <Icon name="alert-circle-outline" size={18} color={colors.live} />
                <Text style={[styles.bannerText, { color: colors.live }]}>{error}</Text>
                <Icon name="close" size={15} color={colors.live} />
              </Pressable>
            ) : null}

            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <View style={[styles.summaryIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="notifications-outline" size={24} color={colors.interactive} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Delivery choices</Text>
                <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
                  The in-app inbox stays available. These controls decide which additional channels COT may use for church updates.
                </Text>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <PreferenceRow
                icon="notifications-outline"
                title="Push alerts"
                description="Receive supported mobile alerts for important church activity."
                value={pushEnabled}
                onChange={setPushEnabled}
                colors={colors}
              />
              <PreferenceRow
                icon="mail-outline"
                title="Email updates"
                description="Allow church announcements and selected updates to reach your account email."
                value={emailEnabled}
                onChange={setEmailEnabled}
                colors={colors}
              />
              <PreferenceRow
                icon="chatbubble-ellipses-outline"
                title="SMS updates"
                description="Allow selected time-sensitive updates by text when that channel is available."
                value={smsEnabled}
                onChange={setSmsEnabled}
                colors={colors}
                last
              />
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <View style={styles.sectionHeading}>
                <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="moon-outline" size={19} color={colors.interactive} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Quiet hours</Text>
                  <Text style={[styles.cardBody, { color: colors.textSecondary }]}>Reduce non-urgent delivery during the time window you choose.</Text>
                </View>
                <Switch
                  value={quietEnabled}
                  onValueChange={setQuietEnabled}
                  trackColor={{ false: colors.borderSubtle, true: colors.primarySoft }}
                  thumbColor={quietEnabled ? colors.interactive : colors.textMuted}
                  accessibilityLabel="Quiet hours"
                />
              </View>

              <View style={[styles.timePanel, { backgroundColor: colors.bgSecondary, opacity: quietEnabled ? 1 : 0.55 }]}>
                <TimeField label="FROM" value={quietStart} onChangeText={setQuietStart} disabled={!quietEnabled} colors={colors} />
                <View style={styles.timeArrow}><Icon name="arrow-forward" size={17} color={colors.textMuted} /></View>
                <TimeField label="UNTIL" value={quietEnd} onChangeText={setQuietEnd} disabled={!quietEnabled} colors={colors} />
              </View>
              <Text style={[styles.helper, { color: colors.textMuted }]}>Use 24-hour time. The window can cross midnight, for example 22:00 → 07:00.</Text>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
              <Icon name="information-circle-outline" size={18} color={colors.interactive} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Turning off a delivery channel does not remove church updates from your Notifications inbox.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {preferences ? (
        <View style={[styles.saveBar, { backgroundColor: colors.glass, borderColor: colors.borderSubtle, bottom: Math.max(insets.bottom, spacing.sm) }, shadows.floating]}>
          <Button label="Save preferences" onPress={() => void save()} loading={saving} fullWidth size="lg" />
        </View>
      ) : null}
    </View>
  );
}

function PreferenceRow({
  icon,
  title,
  description,
  value,
  onChange,
  colors,
  last = false,
}: {
  icon: string;
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  colors: any;
  last?: boolean;
}) {
  return (
    <View style={[styles.preferenceRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle }]}>
      <View style={[styles.preferenceIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={18} color={colors.interactive} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.preferenceTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.preferenceBody, { color: colors.textSecondary }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.borderSubtle, true: colors.primarySoft }}
        thumbColor={value ? colors.interactive : colors.textMuted}
        accessibilityLabel={title}
      />
    </View>
  );
}

function TimeField({
  label,
  value,
  onChangeText,
  disabled,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  disabled: boolean;
  colors: any;
}) {
  return (
    <View style={styles.timeField}>
      <Text style={[styles.timeLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        maxLength={5}
        placeholder="22:00"
        placeholderTextColor={colors.textMuted}
        keyboardType="numbers-and-punctuation"
        style={[styles.timeInput, { backgroundColor: colors.card, borderColor: colors.borderSubtle, color: colors.text }]}
        accessibilityLabel={label === 'FROM' ? 'Quiet hours start time' : 'Quiet hours end time'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stateScreen: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.lg },
  stack: { gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  summaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg },
  summaryIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden', padding: spacing.md },
  cardTitle: { ...typography.h3 },
  cardBody: { ...typography.bodySmall, lineHeight: 19, marginTop: 3 },
  preferenceRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  preferenceIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  preferenceTitle: { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  preferenceBody: { fontSize: 12, lineHeight: 17, maxWidth: 430 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sectionIcon: { width: 42, height: 42, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  timePanel: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, borderRadius: radius.xl, padding: spacing.md, marginTop: spacing.lg },
  timeField: { flex: 1, gap: 5 },
  timeLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  timeInput: { minHeight: 48, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, fontSize: 15, fontWeight: '800' },
  timeArrow: { paddingBottom: 15 },
  helper: { fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  bannerText: { flex: 1, fontSize: 12, fontWeight: '700' },
  saveBar: { position: 'absolute', left: spacing.md, right: spacing.md, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.sm },
});
