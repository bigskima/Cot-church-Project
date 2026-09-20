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
import { PLATFORM_KEYBOARD_BEHAVIOR, PLATFORM_KEYBOARD_DISMISS_MODE, PLATFORM_KEYBOARD_VERTICAL_OFFSET } from '@/utils/keyboard';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { Icon } from './primitives/Icon';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeightPercent?: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}


export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightPercent = 88,
  compact = false,
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
          behavior={PLATFORM_KEYBOARD_BEHAVIOR}
          keyboardVerticalOffset={PLATFORM_KEYBOARD_VERTICAL_OFFSET}
          style={[
            styles.sheetContainer,
            compact && styles.compactSheet,
            {
              backgroundColor: colors.cardElevated,
              borderColor: colors.borderSubtle,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              maxHeight: `${maxHeightPercent}%`,
            },
            style,
          ]}
        >
          <View pointerEvents="none" style={[styles.sheetGlow, { backgroundColor: colors.primarySoft }]} />
          <View pointerEvents="none" style={[styles.handleBar, { backgroundColor: colors.borderStrong }]} />

          {(title || subtitle) ? (
            <View style={[styles.header, compact && styles.compactHeader, { borderBottomColor: colors.borderSubtle }]}>
              <View style={styles.headerCopy}>
                {title ? <Text style={[styles.title, compact && styles.compactTitle, { color: colors.text }]}>{title}</Text> : null}
                {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text> : null}
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
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
            keyboardShouldPersistTaps="always"
            keyboardDismissMode={PLATFORM_KEYBOARD_DISMISS_MODE}
            nestedScrollEnabled
            contentContainerStyle={[styles.contentContainer, compact && styles.compactContent]}
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
  compactSheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  sheetGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    right: -68,
    top: -96,
    opacity: 0.65,
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compactHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xs },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.35 },
  compactTitle: { fontSize: 16, lineHeight: 20 },
  subtitle: {
    ...typography.bodySmall,
    marginTop: 3,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  compactContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
});
