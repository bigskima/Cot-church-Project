import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';
import { Button } from '../Button';
import { Icon } from '../primitives/Icon';

export type ProgressiveFlowStep = {
  key: string;
  label: string;
  hint?: string;
  icon?: string;
};

type Props = {
  steps: ProgressiveFlowStep[];
  currentStep: number;
  onStepChange?: (index: number) => void;
  onBack?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  canContinue?: boolean;
  busy?: boolean;
  completeLabel?: string;
  nextLabel?: string;
  children: React.ReactNode;
};

const noop = () => undefined;

export function ProgressiveFlow({
  steps,
  currentStep,
  onStepChange,
  onBack,
  onNext,
  onComplete,
  canContinue = true,
  busy = false,
  completeLabel = 'Save',
  nextLabel = 'Continue',
  children,
}: Props) {
  const { colors } = useTheme();
  const active = steps[currentStep] ?? steps[0];
  const isLast = currentStep >= steps.length - 1;
  const backAction = onBack ?? noop;
  const continueAction = (isLast ? onComplete : onNext) ?? noop;

  return (
    <View style={styles.root}>
      <View style={styles.progressHeader}>
        <View style={styles.progressMeta}>
          <Text style={[styles.kicker, { color: colors.interactive }]}>STEP {Math.min(currentStep + 1, steps.length)} OF {steps.length}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{active?.label}</Text>
          {active?.hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{active.hint}</Text> : null}
        </View>
        <View style={styles.track}>
          {steps.map((step, index) => {
            const complete = index < currentStep;
            const selected = index === currentStep;
            const reachable = Boolean(onStepChange) && index <= currentStep;
            return (
              <Pressable
                key={step.key}
                onPress={() => reachable ? onStepChange?.(index) : undefined}
                disabled={!reachable}
                accessibilityRole={reachable ? 'button' : undefined}
                accessibilityLabel={`${step.label}${selected ? ', current step' : complete ? ', completed' : ''}`}
                style={styles.trackItem}
              >
                <View style={[
                  styles.trackDot,
                  {
                    backgroundColor: complete || selected ? colors.interactive : colors.bgSecondary,
                    borderColor: complete || selected ? colors.interactive : colors.borderSubtle,
                  },
                ]}>
                  {complete ? <Icon name="checkmark" size={11} color="#FFFFFF" /> : step.icon ? <Icon name={step.icon as any} size={11} color={selected ? '#FFFFFF' : colors.textMuted} /> : <Text style={[styles.dotNumber, { color: selected ? '#FFFFFF' : colors.textMuted }]}>{index + 1}</Text>}
                </View>
                <Text numberOfLines={1} style={[styles.trackLabel, { color: selected ? colors.text : colors.textMuted }]}>{step.label}</Text>
                {index < steps.length - 1 ? <View style={[styles.connector, { backgroundColor: index < currentStep ? colors.interactive : colors.borderSubtle }]} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.content}>{children}</View>

      <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
        <Button
          label={currentStep === 0 ? 'Cancel' : 'Back'}
          variant="outline"
          size="md"
          onPress={backAction}
          disabled={busy}
        />
        <Button
          label={isLast ? completeLabel : nextLabel}
          size="md"
          onPress={continueAction}
          loading={isLast && busy}
          disabled={!canContinue || busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  progressHeader: { gap: spacing.md },
  progressMeta: { gap: 2 },
  kicker: { fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.4 },
  hint: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  track: { flexDirection: 'row', alignItems: 'flex-start' },
  trackItem: { flex: 1, minWidth: 0, alignItems: 'center', position: 'relative', gap: 5 },
  trackDot: { width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  dotNumber: { fontSize: 9.5, fontWeight: '900' },
  trackLabel: { fontSize: 8.5, lineHeight: 11, fontWeight: '800', textAlign: 'center', paddingHorizontal: 2 },
  connector: { position: 'absolute', height: 2, left: '58%', right: '-42%', top: 13, zIndex: 1 },
  content: { gap: spacing.md },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
});
