import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  Icon,
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { DateTimeField } from '@/components/DateTimeField';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { GeneralHomeNotice } from './GeneralHomeNoticeStrip';

const PRESETS = [
  { label: 'Midnight', background: '#08111F', text: '#F8FAFC', accent: '#38BDF8' },
  { label: 'COT blue', background: '#082F49', text: '#F8FAFC', accent: '#38BDF8' },
  { label: 'Royal', background: '#1E1B4B', text: '#F8FAFC', accent: '#A5B4FC' },
  { label: 'Burgundy', background: '#4C0519', text: '#FFF7ED', accent: '#FB7185' },
  { label: 'Emerald', background: '#052E2B', text: '#ECFDF5', accent: '#34D399' },
  { label: 'Gold', background: '#422006', text: '#FFFBEB', accent: '#FBBF24' },
] as const;

function activeState(item: GeneralHomeNotice) {
  const now = Date.now();
  const start = Date.parse(item.starts_at);
  const end = item.ends_at ? Date.parse(item.ends_at) : null;
  if (item.status !== 'published') return { label: 'DRAFT', variant: 'neutral' as const };
  if (!item.is_enabled) return { label: 'DISABLED', variant: 'neutral' as const };
  if (Number.isFinite(start) && start > now) return { label: 'SCHEDULED', variant: 'active' as const };
  if (end && Number.isFinite(end) && end <= now) return { label: 'ENDED', variant: 'neutral' as const };
  return { label: 'LIVE', variant: 'success' as const };
}

function safeDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function GeneralHomeNoticeManageExperience() {
  const insets = useSafeAreaInsets();
  const { api, context, hasOrganizationCapability } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const canManage = hasOrganizationCapability('announcements.manage');

  const resource = useResource<GeneralHomeNotice[]>(
    `general-home-notices-manage:${organizationId || 'none'}`,
    (signal) => canManage && organizationId
      ? api.request<GeneralHomeNotice[]>(`general-home-notices?mode=manage&organizationId=${encodeURIComponent(organizationId)}`, { signal })
      : Promise.resolve([]),
  );

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<GeneralHomeNotice | null>(null);
  const [label, setLabel] = React.useState('COT UPDATE');
  const [message, setMessage] = React.useState('');
  const [status, setStatus] = React.useState<'draft' | 'published'>('draft');
  const [isEnabled, setIsEnabled] = React.useState(true);
  const [startsAt, setStartsAt] = React.useState<Date | null>(new Date());
  const [endsAt, setEndsAt] = React.useState<Date | null>(null);
  const [backgroundColor, setBackgroundColor] = React.useState('#082F49');
  const [textColor, setTextColor] = React.useState('#F8FAFC');
  const [accentColor, setAccentColor] = React.useState('#38BDF8');
  const [linkLabel, setLinkLabel] = React.useState('');
  const [linkPath, setLinkPath] = React.useState('');
  const [priority, setPriority] = React.useState('0');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const reset = () => {
    setEditing(null);
    setLabel('COT UPDATE');
    setMessage('');
    setStatus('draft');
    setIsEnabled(true);
    setStartsAt(new Date());
    setEndsAt(null);
    setBackgroundColor('#082F49');
    setTextColor('#F8FAFC');
    setAccentColor('#38BDF8');
    setLinkLabel('');
    setLinkPath('');
    setPriority('0');
    setError('');
  };

  const openCreate = () => {
    reset();
    setSuccess('');
    setOpen(true);
  };

  const openEdit = (item: GeneralHomeNotice) => {
    setEditing(item);
    setLabel(item.label);
    setMessage(item.message);
    setStatus(item.status);
    setIsEnabled(item.is_enabled);
    setStartsAt(safeDate(item.starts_at));
    setEndsAt(safeDate(item.ends_at));
    setBackgroundColor(item.background_color);
    setTextColor(item.text_color);
    setAccentColor(item.accent_color);
    setLinkLabel(item.link_label ?? '');
    setLinkPath(item.link_path ?? '');
    setPriority(String(item.priority ?? 0));
    setError('');
    setSuccess('');
    setOpen(true);
  };

  const payload = () => ({
    organizationId,
    label: label.trim(),
    message: message.trim(),
    status,
    isEnabled,
    startsAt: (startsAt ?? new Date()).toISOString(),
    endsAt: endsAt?.toISOString() ?? null,
    backgroundColor: backgroundColor.trim(),
    textColor: textColor.trim(),
    accentColor: accentColor.trim(),
    linkLabel: linkLabel.trim() || null,
    linkPath: linkPath.trim() || null,
    priority: Number(priority || 0),
  });

  const save = async () => {
    if (!canManage || !organizationId) return;
    if (!message.trim()) {
      setError('Add the update message before saving.');
      return;
    }
    if (endsAt && startsAt && endsAt.getTime() <= startsAt.getTime()) {
      setError('End time must be after the start time.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.request<GeneralHomeNotice>('general-home-notices', { method: 'PATCH', body: JSON.stringify({ id: editing.id, ...payload() }) });
      } else {
        await api.request<GeneralHomeNotice>('general-home-notices', { method: 'POST', body: JSON.stringify(payload()) });
      }
      setOpen(false);
      setSuccess(status === 'published' && isEnabled ? 'General COT update strip saved. It will appear automatically during its active time window.' : 'General COT update strip saved.');
      reset();
      resource.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save this General COT update strip.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (item: GeneralHomeNotice) => {
    setError('');
    try {
      await api.request<GeneralHomeNotice>('general-home-notices', {
        method: 'PATCH',
        body: JSON.stringify({ id: item.id, organizationId, isEnabled: !item.is_enabled }),
      });
      setSuccess(item.is_enabled ? 'Update strip disabled.' : 'Update strip enabled.');
      resource.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to change update visibility.');
    }
  };

  const remove = (item: GeneralHomeNotice) => {
    Alert.alert(
      'Delete update strip?',
      'This permanently removes this General COT header update. Normal announcements are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.request(`general-home-notices?id=${encodeURIComponent(item.id)}&organizationId=${encodeURIComponent(organizationId)}`, { method: 'DELETE' });
              setSuccess('Update strip deleted.');
              resource.refresh();
            } catch (value) {
              setError(value instanceof Error ? value.message : 'Unable to delete this update strip.');
            }
          },
        },
      ],
    );
  };

  if (!canManage) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Home update strip" kicker="GENERAL COT" showBack />
        <View style={styles.body}><EmptyState title="Management unavailable" message="Only authorized General COT announcement managers can configure the home update strip." iconName="lock-closed-outline" /></View>
      </View>
    );
  }

  const list = resource.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]}>
        <ScreenHeader
          title="Home update strip"
          kicker="GENERAL COT · HEADER"
          subtitle="Publish a short moving update below the General COT header. This is separate from Announcements and never appears inside Expressions."
          showBack
          rightAction={<Button label="New strip" size="sm" onPress={openCreate} />}
        />
        <View style={styles.body}>
          {success ? <View style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{success}</Text></View> : null}
          {error && !open ? <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></View> : null}

          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={[styles.infoIcon, { backgroundColor: colors.primarySoft }]}><Icon name="swap-horizontal-outline" size={21} color={colors.interactive} /></View>
            <View style={styles.flex}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>Independent from announcements</Text>
              <Text style={[styles.infoCopy, { color: colors.textSecondary }]}>The moving strip needs no flyer. Announcement banners remain attached only to their own published announcement content.</Text>
            </View>
          </View>

          <SectionHeader title="Update-strip library" badge={list.length} subtitle="Draft, schedule, publish, disable or delete without touching Expression content" />
          {resource.loading ? <Skeleton height={132} count={3} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : list.length ? list.map((item) => {
            const state = activeState(item);
            return (
              <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <Pressable onPress={() => openEdit(item)} style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}>
                  <View style={[styles.swatch, { backgroundColor: item.background_color, borderColor: `${item.accent_color}66` }]}>
                    <View style={[styles.swatchDot, { backgroundColor: item.accent_color }]} />
                    <Text style={[styles.swatchText, { color: item.text_color }]} numberOfLines={1}>{item.label}</Text>
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.cardTop}>
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.message}</Text>
                      <Badge label={state.label} variant={state.variant} />
                    </View>
                    <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Starts {new Date(item.starts_at).toLocaleString()}{item.ends_at ? ` · Ends ${new Date(item.ends_at).toLocaleString()}` : ' · No end date'}</Text>
                  </View>
                </Pressable>
                <View style={[styles.cardActions, { borderTopColor: colors.borderSubtle }]}>
                  <Pressable onPress={() => void toggleEnabled(item)} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}>
                    <Icon name={item.is_enabled ? 'pause-circle-outline' : 'play-circle-outline'} size={16} color={colors.interactive} />
                    <Text style={[styles.smallActionText, { color: colors.interactive }]}>{item.is_enabled ? 'Disable' : 'Enable'}</Text>
                  </Pressable>
                  <Pressable onPress={() => openEdit(item)} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}>
                    <Icon name="create-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.smallActionText, { color: colors.textSecondary }]}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => remove(item)} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}>
                    <Icon name="trash-outline" size={16} color={colors.live} />
                    <Text style={[styles.smallActionText, { color: colors.live }]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          }) : <EmptyState title="No moving update is configured" message="Create one only when General COT needs a temporary message directly under the header." iconName="swap-horizontal-outline" actionLabel="Create update strip" onAction={openCreate} />}
        </View>
      </ScrollView>

      <BottomSheet visible={open} onClose={() => { if (!saving) { setOpen(false); reset(); } }} title={editing ? 'Edit home update' : 'New home update'} subtitle="General COT only · No image required" maxHeightPercent={96}>
        {error ? <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></View> : null}

        <View style={styles.formSection}>
          <Text style={[styles.formTitle, { color: colors.text }]}>Message</Text>
          <InputField label="Strip label" value={label} onChangeText={setLabel} placeholder="COT UPDATE" />
          <InputField label="Moving message" value={message} onChangeText={setMessage} multiline numberOfLines={4} placeholder="What should General COT see right now?" />
          <InputField label="Optional link label" value={linkLabel} onChangeText={setLinkLabel} placeholder="View details" />
          <InputField label="Optional General COT route" value={linkPath} onChangeText={setLinkPath} placeholder="/general/events" helperText="For safety, links can only point inside /general." />
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.formTitle, { color: colors.text }]}>Appearance</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
            {PRESETS.map((preset) => (
              <Pressable
                key={preset.label}
                onPress={() => { setBackgroundColor(preset.background); setTextColor(preset.text); setAccentColor(preset.accent); }}
                style={({ pressed }) => [styles.preset, { backgroundColor: preset.background, borderColor: preset.accent }, pressed && styles.pressed]}
              >
                <View style={[styles.presetDot, { backgroundColor: preset.accent }]} />
                <Text style={[styles.presetText, { color: preset.text }]}>{preset.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.colorGrid}>
            <View style={styles.colorField}><InputField label="Background" value={backgroundColor} onChangeText={setBackgroundColor} placeholder="#082F49" /></View>
            <View style={styles.colorField}><InputField label="Text" value={textColor} onChangeText={setTextColor} placeholder="#F8FAFC" /></View>
            <View style={styles.colorField}><InputField label="Accent" value={accentColor} onChangeText={setAccentColor} placeholder="#38BDF8" /></View>
          </View>
          <View style={[styles.preview, { backgroundColor, borderColor: accentColor }]}>
            <View style={[styles.previewDot, { backgroundColor: accentColor }]} />
            <Text style={[styles.previewLabel, { color: accentColor }]}>{label || 'COT UPDATE'} •</Text>
            <Text style={[styles.previewMessage, { color: textColor }]} numberOfLines={1}>{message || 'Your moving General COT update will appear here.'}</Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.formTitle, { color: colors.text }]}>Timing & visibility</Text>
          <View style={styles.chips}>
            <Chip label="Draft" selected={status === 'draft'} onPress={() => setStatus('draft')} />
            <Chip label="Published" selected={status === 'published'} onPress={() => setStatus('published')} />
            <Chip label={isEnabled ? 'Enabled' : 'Disabled'} selected={isEnabled} onPress={() => setIsEnabled((value) => !value)} />
          </View>
          <DateTimeField label="Starts" value={startsAt} onChange={setStartsAt} minYear={new Date().getFullYear()} maxYear={new Date().getFullYear() + 3} />
          <DateTimeField label="Ends" value={endsAt} onChange={setEndsAt} minYear={new Date().getFullYear()} maxYear={new Date().getFullYear() + 3} helperText="Optional. Leave empty for no automatic end time." />
          {endsAt ? <Button label="Remove end date" variant="secondary" size="sm" onPress={() => setEndsAt(null)} /> : null}
          <InputField label="Priority" value={priority} onChangeText={setPriority} keyboardType="number-pad" placeholder="0" helperText="Higher numbers win when more than one published strip is active." />
        </View>

        <View style={styles.sheetActions}>
          <Button label="Cancel" variant="secondary" onPress={() => { if (!saving) { setOpen(false); reset(); } }} disabled={saving} />
          <Button label={saving ? 'Saving…' : editing ? 'Save changes' : 'Create update'} onPress={() => void save()} disabled={saving} />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.lg },
  body: { gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noticeText: { flex: 1, fontSize: 11.5, lineHeight: 17, fontWeight: '700' },
  infoCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  infoIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontSize: 13.5, lineHeight: 18, fontWeight: '900' },
  infoCopy: { fontSize: 10.5, lineHeight: 16, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  cardMain: { padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  swatch: { width: 88, height: 58, borderRadius: radius.lg, borderWidth: 1, padding: 9, justifyContent: 'center', gap: 5 },
  swatchDot: { width: 7, height: 7, borderRadius: 99 },
  swatchText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.65 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  cardMeta: { fontSize: 9.5, lineHeight: 14, marginTop: 5 },
  cardActions: { borderTopWidth: StyleSheet.hairlineWidth, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingHorizontal: spacing.sm },
  smallAction: { minHeight: 36, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  smallActionText: { fontSize: 9.5, fontWeight: '900' },
  formSection: { gap: spacing.sm, marginBottom: spacing.lg },
  formTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  presets: { gap: 8, paddingVertical: 2, paddingRight: spacing.md },
  preset: { minHeight: 38, minWidth: 106, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  presetDot: { width: 8, height: 8, borderRadius: 99 },
  presetText: { fontSize: 9.5, fontWeight: '900' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorField: { flex: 1, minWidth: 150 },
  preview: { minHeight: 48, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 7, overflow: 'hidden' },
  previewDot: { width: 7, height: 7, borderRadius: 99 },
  previewLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  previewMessage: { flex: 1, fontSize: 11, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, paddingBottom: spacing.md },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
