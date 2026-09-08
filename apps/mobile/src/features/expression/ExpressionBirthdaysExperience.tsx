import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { Avatar, Badge, EmptyState, Icon, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { ExpressionPeopleHeader } from '@/components/expression/ExpressionPeopleHeader';
import { radius, shadows, spacing } from '@/design-system/tokens';

type BirthdayEntry = {
  profile_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  birthday_month: number;
  birthday_day: number;
  next_birthday: string;
  days_until: number;
};

function dateLabel(entry: BirthdayEntry) {
  if (entry.days_until === 0) return 'Today';
  if (entry.days_until === 1) return 'Tomorrow';
  const date = new Date(`${entry.next_birthday}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export function ExpressionBirthdaysExperience({ embedded = false }: { embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;

  const resource = useResource<BirthdayEntry[]>(`expression:birthdays:${expression?.id ?? 'none'}`, (signal) => {
    if (mode !== 'authenticated' || !expression?.id) return Promise.resolve([]);
    return api.request<BirthdayEntry[]>('expression-birthdays?daysAhead=120', { signal });
  });

  if (mode !== 'authenticated' || !expression?.id) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Birthdays" kicker="EXPRESSION" subtitle="A private birthday calendar for your community." showBack />
        <View style={styles.body}>
          <EmptyState title="Join an Expression first" message="Birthday reminders are private to members of the same Expression." iconName="gift-outline" />
        </View>
      </View>
    );
  }

  const entries = resource.data ?? [];
  const today = entries.filter((entry) => entry.days_until === 0);
  const upcoming = entries.filter((entry) => entry.days_until > 0);
  const soon = upcoming.filter((entry) => entry.days_until <= 14);
  const later = upcoming.filter((entry) => entry.days_until > 14);

  const birthdayCard = (entry: BirthdayEntry, emphasized = false) => (
    <View
      key={entry.profile_id}
      style={[
        styles.card,
        {
          backgroundColor: emphasized ? colors.primarySoft : colors.card,
          borderColor: emphasized ? colors.interactive : colors.borderSubtle,
        },
        shadows.sm,
      ]}
    >
      <Avatar url={entry.avatar_url} name={entry.display_name} size="md" />
      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{entry.display_name}</Text>
          {entry.days_until === 0 ? <Badge label="TODAY" variant="primary" /> : null}
          {entry.days_until === 1 ? <Badge label="TOMORROW" variant="active" /> : null}
        </View>
        {entry.username ? <Text style={[styles.username, { color: colors.textMuted }]}>@{entry.username}</Text> : null}
        <View style={styles.dateRow}>
          <Icon name="gift-outline" size={14} color={colors.interactive} />
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>{dateLabel(entry)}</Text>
          {entry.days_until > 1 ? <Text style={[styles.daysText, { color: colors.textMuted }]}>· in {entry.days_until} days</Text> : null}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {embedded ? (
        <ExpressionPeopleHeader
          expressionId={expression.id}
          expressionName={expression.name}
          active="birthdays"
          title="Birthdays"
          subtitle="Celebrate the people in this Expression without exposing anyone’s birth year."
          icon="gift-outline"
        />
      ) : null}

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
        contentContainerStyle={{ paddingTop: embedded ? spacing.sm : insets.top + spacing.sm, paddingBottom: embedded ? insets.bottom + spacing.xl : insets.bottom + 120 }}
      >
        {!embedded ? (
          <ScreenHeader title="Birthdays" subtitle={`Upcoming birthdays shared inside ${expression.name}. Birth years are never shown.`} showBack />
        ) : null}

        <View style={styles.body}>
          <View style={[styles.privacyCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}> 
            <View style={[styles.privacyIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="shield-checkmark-outline" size={17} color={colors.interactive} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.privacyTitle, { color: colors.text }]}>Shared by members</Text>
              <Text style={[styles.privacyText, { color: colors.textSecondary }]}>Only active members of this Expression can see this calendar. Each person controls birthday visibility from Account Settings.</Text>
            </View>
          </View>

          {resource.loading && !resource.data ? (
            <Skeleton height={76} count={5} />
          ) : resource.error && !resource.data ? (
            <ResourceError message={resource.error} retry={resource.refresh} />
          ) : entries.length ? (
            <>
              {today.length ? (
                <View style={styles.section}>
                  <SectionHeader title="Celebrating today" badge={today.length} subtitle="Make today feel special" />
                  {today.map((entry) => birthdayCard(entry, true))}
                </View>
              ) : null}

              {soon.length ? (
                <View style={styles.section}>
                  <SectionHeader title="Coming soon" badge={soon.length} subtitle="Next 14 days" />
                  {soon.map((entry) => birthdayCard(entry, entry.days_until <= 1))}
                </View>
              ) : null}

              <View style={styles.section}>
                <SectionHeader title="Later" badge={later.length} subtitle="Within the next 120 days" />
                {later.length ? later.map((entry) => birthdayCard(entry)) : <Text style={[styles.emptyLine, { color: colors.textMuted }]}>No other shared birthdays in the next 120 days.</Text>}
              </View>
            </>
          ) : (
            <EmptyState title="No shared birthdays yet" message="Members who add a birthday and allow Expression visibility will appear here without exposing their birth year." iconName="gift-outline" />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export default function ExpressionBirthdaysRouteExperience() {
  return <ExpressionBirthdaysExperience />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  privacyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  privacyIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  privacyTitle: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  privacyText: { fontSize: 11, lineHeight: 17, marginTop: 2 },
  section: { gap: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  cardBody: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { flex: 1, fontSize: 14, fontWeight: '800' },
  username: { fontSize: 11 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dateText: { fontSize: 12, fontWeight: '700' },
  daysText: { fontSize: 11 },
  emptyLine: { fontSize: 12, lineHeight: 18 },
});
