import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';
import { newSermonBlock, type SermonRichBlock } from './sermon-rich-content';

type Props = {
  blocks: SermonRichBlock[];
  onChange: (blocks: SermonRichBlock[]) => void;
  disabled?: boolean;
};

export function SermonRichEditor({ blocks, onChange, disabled = false }: Props) {
  const { colors } = useTheme();

  const update = (id: string, patch: Partial<SermonRichBlock>) => {
    onChange(blocks.map((block) => block.id === id ? { ...block, ...patch } : block));
  };

  const remove = (id: string) => {
    const next = blocks.filter((block) => block.id !== id);
    onChange(next.length ? next : [newSermonBlock()]);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };

  const add = (type: SermonRichBlock['type']) => onChange([...blocks, newSermonBlock(type)]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>SERMON BODY</Text>
          <Text style={[styles.helper, { color: colors.textMuted }]}>Write in reading blocks. Normal blocks are body text; Bold highlight blocks are for topics, key statements and important points.</Text>
        </View>
      </View>

      {blocks.map((block, index) => {
        const highlighted = block.type === 'highlight';
        return (
          <View key={block.id} style={[styles.blockCard, { backgroundColor: colors.card, borderColor: highlighted ? colors.interactive : colors.borderSubtle }]}>
            <View style={styles.blockToolbar}>
              <View style={[styles.segment, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                <Pressable
                  disabled={disabled}
                  onPress={() => update(block.id, { type: 'paragraph' })}
                  style={[styles.segmentButton, !highlighted && { backgroundColor: colors.cardElevated }]}
                >
                  <Text style={[styles.segmentText, { color: !highlighted ? colors.text : colors.textMuted }]}>Normal</Text>
                </Pressable>
                <Pressable
                  disabled={disabled}
                  onPress={() => update(block.id, { type: 'highlight' })}
                  style={[styles.segmentButton, highlighted && { backgroundColor: colors.primarySoft }]}
                >
                  <Text style={[styles.segmentText, styles.boldText, { color: highlighted ? colors.interactive : colors.textMuted }]}>B Bold</Text>
                </Pressable>
              </View>

              <View style={styles.iconActions}>
                <Pressable disabled={disabled || index === 0} onPress={() => move(index, -1)} hitSlop={8} style={styles.iconButton}>
                  <Icon name="arrow-up" size={16} color={index === 0 ? colors.textMuted : colors.textSecondary} />
                </Pressable>
                <Pressable disabled={disabled || index === blocks.length - 1} onPress={() => move(index, 1)} hitSlop={8} style={styles.iconButton}>
                  <Icon name="arrow-down" size={16} color={index === blocks.length - 1 ? colors.textMuted : colors.textSecondary} />
                </Pressable>
                <Pressable disabled={disabled} onPress={() => remove(block.id)} hitSlop={8} style={styles.iconButton}>
                  <Icon name="trash-outline" size={16} color={colors.live} />
                </Pressable>
              </View>
            </View>

            <TextInput
              editable={!disabled}
              value={block.text}
              onChangeText={(text) => update(block.id, { text })}
              multiline
              textAlignVertical="top"
              placeholder={highlighted ? 'Important point, topic or statement…' : 'Continue the sermon…'}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                highlighted && styles.highlightInput,
                { color: colors.text, backgroundColor: highlighted ? colors.primarySoft : colors.bgSecondary, borderColor: colors.borderSubtle },
              ]}
            />
          </View>
        );
      })}

      <View style={styles.addRow}>
        <Pressable disabled={disabled} onPress={() => add('paragraph')} style={[styles.addButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <Icon name="add" size={16} color={colors.interactive} />
          <Text style={[styles.addText, { color: colors.text }]}>Paragraph</Text>
        </Pressable>
        <Pressable disabled={disabled} onPress={() => add('highlight')} style={[styles.addButton, { backgroundColor: colors.primarySoft, borderColor: colors.interactive }]}>
          <Text style={[styles.boldGlyph, { color: colors.interactive }]}>B</Text>
          <Text style={[styles.addText, { color: colors.interactive }]}>Bold highlight</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  flex: { flex: 1 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  helper: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  blockCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.sm },
  blockToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.pill, overflow: 'hidden', padding: 2 },
  segmentButton: { minHeight: 29, paddingHorizontal: 10, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 10, fontWeight: '700' },
  boldText: { fontWeight: '900' },
  iconActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 92, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, lineHeight: 21 },
  highlightInput: { minHeight: 68, fontWeight: '800', fontSize: 15, lineHeight: 22 },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  addButton: { minHeight: 38, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: spacing.md },
  addText: { fontSize: 11, fontWeight: '800' },
  boldGlyph: { fontSize: 15, fontWeight: '900' },
});
