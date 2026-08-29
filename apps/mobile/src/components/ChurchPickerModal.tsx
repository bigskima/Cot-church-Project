import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, radius, shadows, spacing } from '../design-system/tokens';
import { Badge } from './Badge';
import { Button } from './Button';
import type { ChurchOrganization } from '../types/content';

interface ChurchPickerModalProps {
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
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop as any} onPress={onClose} />
        <View style={[styles.sheet, shadows.lg] as any}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Discover Churches</Text>
              <Text style={styles.subtitle}>Select a church sanctuary or expression to browse.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn as any}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: spacing.xl }}>
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
                      isSelected ? styles.churchTileSelected : null,
                      pressed ? styles.pressed : null,
                    ] as any}
                  >
                    <View style={styles.churchIcon}>
                      <Text style={styles.churchIconText}>🏛️</Text>
                    </View>
                    <View style={styles.churchInfo}>
                      <Text style={styles.churchName}>{church.name}</Text>
                      <Text style={styles.churchSlug}>/{church.slug} · {church.timezone || 'UTC'}</Text>
                    </View>
                    {isSelected ? (
                      <Badge label="ACTIVE" variant="gold" />
                    ) : (
                      <Text style={styles.chevron}>›</Text>
                    )}
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Global Central Sanctuary active.</Text>
              </View>
            )}
          </ScrollView>

          <Button
            label="Done"
            onPress={onClose}
            variant="outline"
            size="md"
            style={{ marginTop: spacing.md } as any}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20, 12, 7, 0.75)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: '#E8D5C4',
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
    fontSize: 20,
    fontWeight: '900',
    color: '#26140A',
  },
  subtitle: {
    fontSize: 13,
    color: '#8C6549',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#8C6549',
  },
  list: {
    marginTop: spacing.sm,
  },
  churchTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8EDE2',
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  churchTileSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  pressed: {
    opacity: 0.85,
  },
  churchIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  churchIconText: {
    fontSize: 20,
  },
  churchInfo: {
    flex: 1,
  },
  churchName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#26140A',
  },
  churchSlug: {
    fontSize: 12,
    color: '#8C6549',
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#C4AFA0',
    fontWeight: '700',
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8C6549',
    fontSize: 14,
  },
});
