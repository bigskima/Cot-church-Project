import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { Badge } from './Badge';
import { Button } from './Button';
import { Icon } from './primitives/Icon';
import type { ChurchOrganization } from '@/types/content';

export interface ChurchPickerModalProps {
  visible: boolean;
  onClose: () => void;
  churches: ChurchOrganization[];
  selectedChurchId?: string;
  onSelectChurch: (church: ChurchOrganization) => void;
}

export function ChurchPickerModal({
  visible,
  onClose,
  churches,
  selectedChurchId,
  onSelectChurch,
}: ChurchPickerModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.lg]}>
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>Choose church</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Choose the church whose public content you want to explore.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Icon name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: spacing.lg }}>
            {churches.length > 0 ? (
              churches.map((church) => {
                const isSelected = selectedChurchId === church.id;
                return (
                  <Pressable
                    key={church.id}
                    onPress={() => {
                      onSelectChurch(church);
                      onClose();
                    }}
                    style={({ pressed }) => [
                      styles.churchTile,
                      {
                        backgroundColor: isSelected ? colors.primarySoft : colors.bgSecondary,
                        borderColor: isSelected ? colors.interactive : colors.borderSubtle,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.churchIcon, { backgroundColor: colors.cardElevated }]}>
                      <Icon
                        name="business-outline"
                        size={20}
                        color={isSelected ? colors.interactive : colors.textSecondary}
                      />
                    </View>
                    <View style={styles.churchInfo}>
                      <Text style={[styles.churchName, { color: colors.text }]}>{church.name}</Text>
                      <Text style={[styles.churchSlug, { color: colors.textMuted }]}>
                        /{church.slug} {church.timezone ? `· ${church.timezone}` : ''}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Badge label="ACTIVE" variant="primary" />
                    ) : (
                      <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                    )}
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No other organizations available.
                </Text>
              </View>
            )}
          </ScrollView>

          <Button
            label="Done"
            onPress={onClose}
            variant="outline"
            size="md"
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(6, 20, 38, 0.65)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    marginTop: spacing.xs,
  },
  churchTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.992 }],
  },
  churchIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  churchInfo: {
    flex: 1,
  },
  churchName: {
    fontSize: 15,
    fontWeight: '800',
  },
  churchSlug: {
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
