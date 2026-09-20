import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  InputField,
  ResourceError,
  ScreenHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type CategoryRow = {
  id: string;
  category: string;
  label: string;
  aliases: string[];
  description: string;
  display_order: number;
  is_active: boolean;
};

type Draft = {
  label: string;
  aliases: string;
  description: string;
  displayOrder: string;
  isActive: boolean;
};

function draftFromRow(row: CategoryRow): Draft {
  return {
    label: row.label,
    aliases: (row.aliases ?? []).join(', '),
    description: row.description ?? '',
    displayOrder: String(row.display_order ?? 0),
    isActive: row.is_active,
  };
}

function humanizeKey(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function VideoCategorySettingsExperience() {
  const { auth, context, accessReady, hasOrganizationCapability } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const accessToken = auth?.session.accessToken ?? null;
  const allowed = accessReady && hasOrganizationCapability('organization.leadership.manage');
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const resource = useResource<CategoryRow[]>(
    `leadership:video-categories:${organizationId || 'none'}`,
    async () => {
      if (!organizationId || !allowed) return [];
      const supabase = await getRuntimeSupabase(accessToken);
      const result = await supabase
        .from('video_category_options')
        .select('id, category, label, aliases, description, display_order, is_active')
        .eq('organization_id', organizationId)
        .order('display_order', { ascending: true })
        .order('label', { ascending: true });
      if (result.error) throw new Error(result.error.message);
      return (Array.isArray(result.data) ? result.data : []) as CategoryRow[];
    },
  );

  const rows = resource.data ?? [];
  const visibleRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) => [
      row.category,
      row.label,
      row.description,
      ...(row.aliases ?? []),
    ].some((value) => String(value ?? '').toLowerCase().includes(search)));
  }, [rows, query]);

  const getDraft = (row: CategoryRow) => drafts[row.id] ?? draftFromRow(row);
  const patchDraft = (row: CategoryRow, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [row.id]: { ...(current[row.id] ?? draftFromRow(row)), ...patch },
    }));
    setSuccess('');
    setError('');
  };

  const save = async (row: CategoryRow) => {
    const draft = getDraft(row);
    const label = draft.label.trim();
    const displayOrder = Number(draft.displayOrder);
    if (!label) return setError('Category label cannot be empty.');
    if (!Number.isInteger(displayOrder)) return setError('Display order must be a whole number.');

    setSavingId(row.id);
    setError('');
    setSuccess('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const aliases = [...new Set(draft.aliases.split(',').map((item) => item.trim()).filter(Boolean))];
      const result = await supabase
        .from('video_category_options')
        .update({
          label,
          aliases,
          description: draft.description.trim(),
          display_order: displayOrder,
          is_active: draft.isActive,
        })
        .eq('id', row.id)
        .eq('organization_id', organizationId);
      if (result.error) throw new Error(result.error.message);
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setSuccess(`${label} updated.`);
      resource.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update this category.');
    } finally {
      setSavingId(null);
    }
  };

  if (!accessReady) {
    return <View style={styles.pad}><Skeleton height={120} count={3} borderRadius={radius.xl} /></View>;
  }

  if (!allowed) {
    return (
      <View style={styles.pad}>
        <EmptyState
          title="Category controls are restricted"
          message="Church leadership permission is required to change Watch category labels, order, or visibility."
          iconName="lock-closed-outline"
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Watch categories"
          kicker="MEDIA SETTINGS"
          subtitle="Rename, search, reorder or hide the categories people see in Watch."
          showBack
        />

        <View style={[styles.infoCard, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
          <Icon name="options-outline" size={21} color={colors.interactive} />
          <View style={styles.flex}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Watch category settings</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Changes to names, search terms, order and visibility appear in Watch after you save them.</Text>
          </View>
        </View>

        <InputField label="Find category" value={query} onChangeText={setQuery} placeholder="Search label, key or alias…" autoCapitalize="none" />

        {success ? <View style={[styles.message, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={17} color={colors.success} /><Text style={[styles.messageText, { color: colors.success }]}>{success}</Text></View> : null}
        {error ? <View style={[styles.message, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={17} color={colors.live} /><Text style={[styles.messageText, { color: colors.live }]}>{error}</Text></View> : null}

        {resource.loading && !resource.data ? (
          <Skeleton height={260} count={3} borderRadius={radius.xl} />
        ) : resource.error && !resource.data ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : visibleRows.length ? (
          <View style={styles.stack}>
            {visibleRows.map((row) => {
              const draft = getDraft(row);
              const dirty = Boolean(drafts[row.id]);
              return (
                <View key={row.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                  <View style={styles.cardTop}>
                    <View style={[styles.iconBox, { backgroundColor: draft.isActive ? colors.primarySoft : colors.bgSecondary }]}>
                      <Icon name="pricetag-outline" size={19} color={draft.isActive ? colors.interactive : colors.textMuted} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.keyLabel, { color: colors.textMuted }]}>CATEGORY</Text>
                      <Text style={[styles.keyValue, { color: colors.text }]}>{humanizeKey(row.category)}</Text>
                    </View>
                    <Badge label={draft.isActive ? 'VISIBLE' : 'HIDDEN'} variant={draft.isActive ? 'active' : 'neutral'} />
                  </View>

                  <InputField label="Display label" value={draft.label} onChangeText={(value) => patchDraft(row, { label: value })} placeholder="Category label" />
                  <InputField label="Search aliases" value={draft.aliases} onChangeText={(value) => patchDraft(row, { aliases: value })} placeholder="message, preaching, teaching" helperText="Comma-separated words people may search for." />
                  <InputField label="Description" value={draft.description} onChangeText={(value) => patchDraft(row, { description: value })} placeholder="Optional guidance for this media category" multiline numberOfLines={3} />
                  <InputField label="Display order" value={draft.displayOrder} onChangeText={(value) => patchDraft(row, { displayOrder: value.replace(/[^0-9-]/g, '') })} keyboardType="number-pad" placeholder="0" />

                  <Pressable
                    onPress={() => patchDraft(row, { isActive: !draft.isActive })}
                    style={({ pressed }) => [styles.visibilityRow, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${draft.isActive ? 'Hide' : 'Show'} ${draft.label}`}
                  >
                    <Icon name={draft.isActive ? 'eye-outline' : 'eye-off-outline'} size={18} color={draft.isActive ? colors.interactive : colors.textMuted} />
                    <View style={styles.flex}>
                      <Text style={[styles.visibilityTitle, { color: colors.text }]}>{draft.isActive ? 'Shown in Watch discovery' : 'Hidden from Watch discovery'}</Text>
                      <Text style={[styles.visibilityHint, { color: colors.textMuted }]}>Existing videos stay unchanged. Hiding a category only removes it from Watch discovery and future publishing choices.</Text>
                    </View>
                  </Pressable>

                  <Button label={dirty ? 'Save category' : 'Saved'} onPress={() => void save(row)} loading={savingId === row.id} disabled={!dirty || savingId !== null} fullWidth />
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState title="No categories found" message={query ? 'Try a different search.' : 'Category options will appear here when they are available.'} iconName="pricetags-outline" />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: spacing.md, paddingBottom: 100, gap: spacing.md },
  pad: { flex: 1, padding: spacing.md },
  infoCard: { flexDirection: 'row', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, alignItems: 'flex-start' },
  infoTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  infoText: { marginTop: 2, fontSize: 12, lineHeight: 18 },
  stack: { gap: spacing.md },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBox: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  keyLabel: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.7 },
  keyValue: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  visibilityTitle: { fontSize: 12.5, lineHeight: 17, fontWeight: '800' },
  visibilityHint: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  message: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  messageText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  pressed: { opacity: 0.88 },
});
