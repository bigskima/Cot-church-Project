import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, ScreenHeader } from '@/components';
import { TourAnchor, useAppTour } from '@/features/tour/AppTourProvider';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { COT_MEMBER_GUIDE_URL } from '@/constants/guides';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export default function AppTourSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { context } = useSession();
  const { startTour, active } = useAppTour();
  const scrollRef = React.useRef<ScrollView>(null);
  const [busyKey, setBusyKey] = React.useState('');
  const [error, setError] = React.useState('');
  const expressions = (context?.expressions ?? []).filter((item) => item.status === 'active');

  const start = async (scope: 'general' | 'expression', expressionId?: string) => {
    const key = expressionId ?? scope;
    setBusyKey(key);
    setError('');
    try {
      await startTour(scope, expressionId);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to start the tour.');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 80 }]}>
        <ScreenHeader title="App tour & help" kicker="ACCOUNT" subtitle="Restart a guided walk through the real COT screens at any time." showBack />

        <View style={[styles.infoCard, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
          <View style={[styles.infoIcon, { backgroundColor: colors.card }]}><Icon name="navigate-circle-outline" size={22} color={colors.interactive} /></View>
          <View style={styles.flex}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Your reminder choice never locks you out</Text>
            <Text style={[styles.infoCopy, { color: colors.textSecondary }]}>Even if you chose “Never remind me”, starting a tour here resets that choice for the tour you select.</Text>
          </View>
        </View>

        {error ? <View style={[styles.errorCard, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={16} color={colors.live} /><Text style={[styles.errorText, { color: colors.live }]}>{error}</Text></View> : null}

        <Pressable
          onPress={() => void Linking.openURL(COT_MEMBER_GUIDE_URL)}
          accessibilityRole="link"
          accessibilityLabel="Open the COT App Member User Guide"
          style={({ pressed }) => [styles.guideCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed]}
        >
          <View style={[styles.cardIcon, { backgroundColor: colors.primarySoft }]}><Icon name="book-outline" size={21} color={colors.interactive} /></View>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Read the COT App Member Guide</Text>
            <Text style={[styles.cardCopy, { color: colors.textMuted }]}>Open the complete member guide for General COT, Expressions, Groups, messages, media, prayer, giving, events and everyday participation.</Text>
          </View>
          <Icon name="open-outline" size={18} color={colors.interactive} />
        </Pressable>

        <Text style={[styles.sectionEyebrow, { color: colors.interactive }]}>GENERAL COT</Text>
        <Pressable
          onPress={() => void start('general')}
          disabled={active || !!busyKey}
          accessibilityRole="button"
          style={({ pressed }) => [styles.tourCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed]}
        >
          <View style={[styles.cardIcon, { backgroundColor: colors.primarySoft }]}><Icon name="globe-outline" size={21} color={colors.interactive} /></View>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Tour General COT</Text>
            <Text style={[styles.cardCopy, { color: colors.textMuted }]}>Home, public feed, Reels, messages and your account area.</Text>
          </View>
          <View style={[styles.startPill, { backgroundColor: colors.bgSecondary }]}>
            <Text style={[styles.startText, { color: colors.interactive }]}>{busyKey === 'general' ? 'Opening…' : 'Start'}</Text>
            <Icon name="arrow-forward" size={14} color={colors.interactive} />
          </View>
        </Pressable>

        <TourAnchor targetKey="general.tour.restart" reveal={() => scrollRef.current?.scrollTo({ y: 250, animated: true })}>
          <View style={styles.restartArea}>
            <View style={styles.sectionHeading}>
              <View style={styles.flex}>
                <Text style={[styles.sectionEyebrow, { color: colors.interactive }]}>YOUR EXPRESSIONS</Text>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Tour a private Expression</Text>
                <Text style={[styles.sectionCopy, { color: colors.textMuted }]}>An Expression tour only opens after you already belong to that Expression.</Text>
              </View>
            </View>

            {expressions.length ? (
              <View style={styles.list}>
                {expressions.map((expression) => (
                  <Pressable
                    key={expression.id}
                    onPress={() => void start('expression', expression.id)}
                    disabled={active || !!busyKey}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.expressionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
                  >
                    <View style={[styles.expressionIcon, { backgroundColor: colors.primarySoft }]}><Icon name="people-circle-outline" size={19} color={colors.interactive} /></View>
                    <View style={styles.flex}>
                      <Text style={[styles.expressionName, { color: colors.text }]} numberOfLines={1}>{expression.name}</Text>
                      <Text style={[styles.expressionMeta, { color: colors.textMuted }]} numberOfLines={1}>Home, feed and General discussion</Text>
                    </View>
                    <Text style={[styles.expressionStart, { color: colors.interactive }]}>{busyKey === expression.id ? 'Opening…' : 'Start tour'}</Text>
                    <Icon name="chevron-forward" size={15} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                <Icon name="people-outline" size={26} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Expression tour available yet</Text>
                <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>After you join an Expression, it will appear here and its tour will also be offered when you first open it.</Text>
              </View>
            )}
          </View>
        </TourAnchor>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 780, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  infoCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  infoIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontSize: 13, lineHeight: 17, fontWeight: '900' },
  infoCopy: { fontSize: 10.5, lineHeight: 16, marginTop: 3 },
  errorCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 7 },
  errorText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  sectionEyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1 },
  guideCard: { minHeight: 82, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tourCard: { minHeight: 92, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, lineHeight: 19, fontWeight: '900' },
  cardCopy: { fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  startPill: { minHeight: 36, borderRadius: radius.pill, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  startText: { fontSize: 10.5, fontWeight: '900' },
  restartArea: { gap: spacing.md },
  sectionHeading: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'flex-end' },
  sectionTitle: { fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.4, marginTop: 3 },
  sectionCopy: { fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  list: { gap: spacing.xs },
  expressionCard: { minHeight: 68, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  expressionIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  expressionName: { fontSize: 13, fontWeight: '900' },
  expressionMeta: { fontSize: 9.5, marginTop: 2 },
  expressionStart: { fontSize: 9.5, fontWeight: '900' },
  emptyCard: { minHeight: 160, borderWidth: 1, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: 7 },
  emptyTitle: { fontSize: 15, fontWeight: '900', textAlign: 'center' },
  emptyCopy: { fontSize: 10.5, lineHeight: 16, textAlign: 'center', maxWidth: 430 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
