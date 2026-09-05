import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { Icon } from './primitives/Icon';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeightPercent?: number;
  style?: StyleProp<ViewStyle>;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightPercent = 88,
  style,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.scrim }]}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.cardElevated,
              borderColor: colors.borderSubtle,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              maxHeight: `${maxHeightPercent}%`,
            },
            style,
          ]}
        >
          <View style={[styles.handleBar, { backgroundColor: colors.borderStrong }]} />

          {(title || subtitle) ? (
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
                {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: colors.bgSecondary },
                  pressed && { backgroundColor: colors.pressed },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Icon name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.contentContainer}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: { flex: 1 },
  sheetContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 720 : undefined,
    alignSelf: 'center',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
    ...shadows.floating,
  },
  handleBar: {
    width: 42,
    height: 5,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { ...typography.h2 },
  subtitle: {
    ...typography.bodySmall,
    marginTop: 3,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
});
