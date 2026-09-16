import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/primitives/Icon';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { subscribeActionFeedback, type ActionFeedback } from '@/services/action-feedback';
import { useTheme } from '@/state/theme';

export function ActionFeedbackProvider({ children }: React.PropsWithChildren) {
  const { colors } = useTheme();
  const [feedback, setFeedback] = React.useState<ActionFeedback | null>(null);
  const [retrying, setRetrying] = React.useState(false);

  React.useEffect(() => subscribeActionFeedback(setFeedback), []);

  React.useEffect(() => {
    if (!feedback || feedback.kind !== 'success') return;
    const timer = setTimeout(() => setFeedback((current) => current?.id === feedback.id ? null : current), 1900);
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

  return (
    <>
      {children}
      <Modal visible={Boolean(feedback)} transparent animationType="fade" onRequestClose={() => setFeedback(null)}>
        <View style={styles.overlay}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: feedback?.kind === 'success' ? colors.success : colors.live }, shadows.floating]}>
            <View style={[styles.iconWrap, { backgroundColor: feedback?.kind === 'success' ? colors.successSoft : colors.liveSoft }]}>
              <Icon name={feedback?.kind === 'success' ? 'checkmark-circle' : 'alert-circle'} size={28} color={feedback?.kind === 'success' ? colors.success : colors.live} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{feedback?.title}</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{feedback?.message}</Text>
            {feedback?.kind === 'error' ? (
              <View style={styles.actions}>
                {feedback.retry ? (
                  <Pressable onPress={() => void retry()} disabled={retrying} style={[styles.primary, { backgroundColor: colors.interactive }]} accessibilityRole="button">
                    <Icon name="refresh-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.primaryText}>{retrying ? 'Trying…' : 'Try again'}</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setFeedback(null)} style={[styles.secondary, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]} accessibilityRole="button">
                  <Text style={[styles.secondaryText, { color: colors.text }]}>Close</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center' },
  iconWrap: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '900', textAlign: 'center' },
  message: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: spacing.xs },
  actions: { width: '100%', marginTop: spacing.lg, gap: spacing.sm },
  primary: { minHeight: 46, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: spacing.md },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  secondary: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  secondaryText: { fontSize: 13, fontWeight: '800' },
});
