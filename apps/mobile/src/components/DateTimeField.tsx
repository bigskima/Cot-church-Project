import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet, Button, Icon } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatDateOnly(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function DateTimeField({
  label,
  value,
  onChange,
  includeTime = true,
  placeholder = 'Choose date',
  minYear,
  maxYear,
  helperText,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  includeTime?: boolean;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  helperText?: string;
}) {
  const { colors } = useTheme();
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? now);

  useEffect(() => {
    if (open) setDraft(value ?? now);
  }, [open, value]);

  const firstYear = minYear ?? now.getFullYear() - (includeTime ? 0 : 100);
  const lastYear = maxYear ?? now.getFullYear() + (includeTime ? 10 : 0);
  const years = useMemo(() => Array.from({ length: Math.max(1, lastYear - firstYear + 1) }, (_, index) => firstYear + index), [firstYear, lastYear]);
  const days = Array.from({ length: daysInMonth(draft.getFullYear(), draft.getMonth()) }, (_, index) => index + 1);
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const setPart = (part: 'year' | 'month' | 'day' | 'hour' | 'minute', next: number) => {
    const current = new Date(draft);
    if (part === 'year') {
      const day = Math.min(current.getDate(), daysInMonth(next, current.getMonth()));
      current.setFullYear(next, current.getMonth(), day);
    }
    if (part === 'month') {
      const day = Math.min(current.getDate(), daysInMonth(current.getFullYear(), next));
      current.setMonth(next, day);
    }
    if (part === 'day') current.setDate(next);
    if (part === 'hour') current.setHours(next);
    if (part === 'minute') current.setMinutes(next, 0, 0);
    setDraft(current);
  };

  const labelText = value
    ? value.toLocaleString(undefined, includeTime
      ? { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { year: 'numeric', month: 'long', day: 'numeric' })
    : placeholder;

  const pickerRow = (title: string, items: number[], selected: number, render: (item: number) => string, choose: (item: number) => void) => (
    <View style={styles.pickerGroup}>
      <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
        {items.map((item) => {
          const active = item === selected;
          return (
            <Pressable key={item} onPress={() => choose(item)} style={[styles.choice, { backgroundColor: active ? colors.primarySoft : colors.bgSecondary, borderColor: active ? colors.interactive : colors.borderSubtle }]}>
              <Text style={[styles.choiceText, { color: active ? colors.interactive : colors.textSecondary }]}>{render(item)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label.toUpperCase()}</Text>
      <Pressable onPress={() => setOpen(true)} style={[styles.field, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
        <Icon name="calendar-outline" size={18} color={colors.interactive} />
        <Text style={[styles.value, { color: value ? colors.text : colors.textMuted }]}>{labelText}</Text>
        <Icon name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>
      {helperText ? <Text style={[styles.helper, { color: colors.textMuted }]}>{helperText}</Text> : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={includeTime ? `Choose ${label.toLowerCase()}` : `Choose ${label.toLowerCase()}`} subtitle="Tap a value instead of typing a date." maxHeightPercent={90}>
        <View style={styles.sheetContent}>
          <View style={[styles.preview, { backgroundColor: colors.primarySoft, borderColor: colors.interactive }]}>
            <Icon name="calendar" size={20} color={colors.interactive} />
            <Text style={[styles.previewText, { color: colors.text }]}>{draft.toLocaleString(undefined, includeTime ? { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
          </View>
          {pickerRow('Year', years, draft.getFullYear(), String, (item) => setPart('year', item))}
          {pickerRow('Month', months.map((_, index) => index), draft.getMonth(), (item) => months[item], (item) => setPart('month', item))}
          {pickerRow('Day', days, draft.getDate(), String, (item) => setPart('day', item))}
          {includeTime ? (
            <>
              {pickerRow('Hour', hours, draft.getHours(), (item) => pad(item), (item) => setPart('hour', item))}
              {pickerRow('Minute', minutes, Math.floor(draft.getMinutes() / 5) * 5, (item) => pad(item), (item) => setPart('minute', item))}
            </>
          ) : null}
          <Button label="Use this date" onPress={() => { onChange(draft); setOpen(false); }} size="lg" fullWidth />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  field: { minHeight: 48, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  value: { flex: 1, fontSize: 13, fontWeight: '600' },
  helper: { fontSize: 10.5, lineHeight: 15 },
  sheetContent: { gap: spacing.md },
  preview: { minHeight: 58, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  pickerGroup: { gap: 6 },
  pickerLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  pickerRow: { gap: 7, paddingRight: spacing.md },
  choice: { minWidth: 48, minHeight: 38, borderWidth: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11 },
  choiceText: { fontSize: 11.5, fontWeight: '800' },
});
