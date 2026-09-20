import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/primitives/Icon';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { subscribeActionFeedback, type ActionFeedback } from '@/services/action-feedback';
import { useTheme } from '@/state/theme';

export function ActionFeedbackProvider({ children }: React.PropsWithChildren) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [feedback, setFeedback] = React.useState<ActionFeedback | null>(null);
  const [retrying, setRetrying] = React.useState(false);

  React.useEffect(() => subscribeActionFeedback(setFeedback), []);

  React.useEffect(() => {
    if (!feedback || feedback.kind !== 'success') return;
    const timer = setTimeout(
      () => setFeedback((current) => current?.id === feedback.id ? null : current),
      feedback.details?.length ? 5200 : 3600,
    );
    return () => clearTimeout(timer);
  }, [feedback]);

  const retry = async () => {
    if (!feedback?.retry || retrying) return;
    const action = feedback.retry;
    setRetrying(true);
    setFeedback(null);
    try {
      await action();
    } catch {
      // The retried request emits its own fresh failure feedback if it still fails.
    } finally {
      setRetrying(false);
    }
  };

  const success = feedback?.kind === 'success';

  return (
    <>
      {children}
      <Modal visible={Boolean(feedback)} transparent animationType="fade" onRequestClose={() => setFeedback(null)}>
        <View style={[styles.overlay, { paddingTop: Math.max(insets.top, spacing.md), paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: success ? colors.success : colors.live }, shadows.floating]}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.iconWrap, { backgroundColor: success ? colors.successSoft : colors.liveSoft }]}>
              <Icon name={success ? 'checkmark-circle' : 'alert-circle'} size={30} color={success ? colors.success : colors.live} />
            </View>
            <Text style={[styles.stateLabel, { color: success ? colors.success : colors.live }]}>
              {success ? 'SUCCESS' : 'NOT COMPLETED'}
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>{feedback?.title}</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{feedback?.message}</Text>

            {feedback?.details?.length ? (
              <View style={[styles.detailBox, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.detailHeading, { color: colors.text }]}>What happened</Text>
                {feedback.details.map((detail, index) => (
                  <View key={`${feedback.id}:${index}`} style={styles.detailRow}>
                    <View style={[styles.detailDot, { backgroundColor: success ? colors.success : colors.live }]} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>{detail}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            </ScrollView>
            <View style={[styles.actions, { borderTopColor: colors.borderSubtle }]}>
              {!success && feedback?.retry ? (
                <Pressable onPress={() => void retry()} disabled={retrying} style={[styles.primary, { backgroundColor: colors.interactive }]} accessibilityRole="button">
                  <Icon name="refresh-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.primaryText}>{retrying ? 'Trying…' : 'Try again'}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setFeedback(null)} style={[styles.secondary, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]} accessibilityRole="button">
                <Text style={[styles.secondaryText, { color: colors.text }]}>{success ? 'Done' : 'Close'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.56)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  card: { width: '100%', maxWidth: 460, maxHeight: '90%', borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  scroll: { width: '100%', flexShrink: 1 },
  scrollContent: { padding: spacing.xl, alignItems: 'center' },
  iconWrap: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  stateLabel: { fontSize: 9.5, lineHeight: 13, fontWeight: '900', letterSpacing: 1.15, marginBottom: spacing.xs },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '900', textAlign: 'center' },
  message: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: spacing.xs },
  detailBox: { width: '100%', borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg, gap: 8 },
  detailHeading: { fontSize: 12.5, fontWeight: '900', marginBottom: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  detailText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
  actions: { width: '100%', padding: spacing.md, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  primary: { minHeight: 46, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: spacing.md },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  secondary: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  secondaryText: { fontSize: 13, fontWeight: '800' },
});
