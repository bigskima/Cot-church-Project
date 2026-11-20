import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { toUserFacingErrorMessage } from '@/api';
import { radius, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { BottomSheet } from '../BottomSheet';
import { Button } from '../Button';
import { InputField } from '../Input';
import { Icon } from '../primitives/Icon';

export type ContentReportContext = 'public' | 'current';

export type ContentReportTarget = {
  contentId?: string;
  commentId?: string;
  label?: string;
  context: ContentReportContext;
};

export interface ContentReportSheetProps {
  target: ContentReportTarget | null;
  onClose: () => void;
}

const reasons = [
  'Spam or misleading',
  'Harassment or abuse',
  'Hateful conduct',
  'Sexual or inappropriate content',
  'Violence or dangerous behavior',
  'Privacy or personal information',
  'Impersonation or fraud',
  'Other',
];

export function ContentReportSheet({ target, onClose }: ContentReportSheetProps) {
  const { api } = useSession();
  const { colors } = useTheme();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);

  useEffect(() => {
    setReason('');
    setDetails('');
    setSubmitting(false);
    setError('');
    setSubmitted(false);
    setAlreadyReported(false);
  }, [target?.contentId, target?.commentId]);

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const submit = async () => {
    if (!target || !reason || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.request<{ alreadyReported?: boolean }>('engagement', {
        method: 'POST',
        context: target.context,
        body: JSON.stringify({
          action: 'report',
          ...(target.contentId ? { contentId: target.contentId } : {}),
          ...(target.commentId ? { commentId: target.commentId } : {}),
          reason,
          details: details.trim(),
        }),
      });
      setAlreadyReported(Boolean(result.alreadyReported));
      setSubmitted(true);
    } catch (value) {
      setError(toUserFacingErrorMessage(value, 'We couldn’t submit this report. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      visible={Boolean(target)}
      onClose={close}
      title={submitted ? 'Report received' : 'Report content'}
      subtitle={target?.label || 'Choose the reason that best describes the problem.'}
      maxHeightPercent={86}
    >
      {submitted ? (
        <View style={styles.successWrap}>
          <View style={[styles.successIcon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="shield-checkmark-outline" size={28} color={colors.interactive} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>
            {alreadyReported ? 'This is already in review' : 'Thanks for reporting this'}
          </Text>
          <Text style={[styles.successCopy, { color: colors.textSecondary }]}>
            {alreadyReported
              ? 'You already have an open report for this target. We kept the existing report instead of creating a duplicate.'
              : 'The report is now in the moderation queue. Reporting does not automatically remove content before it is reviewed.'}
          </Text>
          <Button label="Done" onPress={close} fullWidth />
        </View>
      ) : (
        <View style={styles.form}>
          <View style={[styles.notice, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Icon name="shield-outline" size={18} color={colors.interactive} />
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
              Reports are private. The person who posted this will not see who submitted the report.
            </Text>
          </View>

          <View style={styles.reasonGrid}>
            {reasons.map((item) => {
              const selected = item === reason;
              return (
                <Pressable
                  key={item}
                  onPress={() => {
                    setReason(item);
                    setError('');
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.reasonChip,
                    {
                      backgroundColor: selected ? colors.primarySoft : colors.card,
                      borderColor: selected ? colors.interactive : colors.borderSubtle,
                    },
                    pressed && { opacity: 0.86 },
                  ]}
                >
                  <Icon
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={selected ? colors.interactive : colors.textMuted}
                  />
                  <Text style={[styles.reasonText, { color: selected ? colors.interactive : colors.text }]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>

          <InputField
            label="Extra details (optional)"
            value={details}
            onChangeText={setDetails}
            placeholder="Add anything that would help the moderation team understand the issue"
            maxLength={1000}
            multiline
            style={styles.detailsInput}
            helperText={`${details.length}/1000`}
          />

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.liveSoft }]}>
              <Icon name="alert-circle-outline" size={16} color={colors.live} />
              <Text style={[styles.errorText, { color: colors.live }]}>{error}</Text>
            </View>
          ) : null}

          <Button
            label="Submit report"
            onPress={() => void submit()}
            loading={submitting}
            disabled={!reason}
            fullWidth
          />
          <Button label="Cancel" onPress={close} variant="ghost" disabled={submitting} fullWidth />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reasonChip: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  reasonText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  detailsInput: { minHeight: 92, textAlignVertical: 'top' },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17 },
  successWrap: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  successIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800', textAlign: 'center' },
  successCopy: { maxWidth: 520, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: spacing.sm },
});
