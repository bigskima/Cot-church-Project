import React from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, spacing, typography } from '@/design-system/tokens';
import { Icon } from './primitives/Icon';

export interface InputFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  dark?: boolean;
}

export function InputField({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  containerStyle,
  style,
  ...props
}: InputFieldProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: error ? colors.live : colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.inputBg,
            borderColor: error ? colors.live : colors.inputBorder,
          },
        ]}
      >
        {leftIcon ? <View pointerEvents="none" style={styles.iconLeft}>{leftIcon}</View> : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.interactive}
          cursorColor={Platform.OS === 'android' ? colors.interactive : undefined}
          underlineColorAndroid="transparent"
          style={[styles.input, { color: colors.text }, style]}
          {...props}
        />
        {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
      </View>
      {error ? (
        <View style={styles.supportRow}>
          <Icon name="alert-circle-outline" size={13} color={colors.live} />
          <Text style={[styles.errorText, { color: colors.live }]}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: colors.textMuted }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search sermons, events, people and topics',
  onClear,
  onSubmitEditing,
  autoFocus = false,
  style,
}: SearchBarProps) {
  const { colors } = useTheme();

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View
      style={[
        styles.searchContainer,
        {
          backgroundColor: colors.card,
          borderColor: colors.borderSubtle,
        },
        style,
      ]}
    >
      <View pointerEvents="none" style={[styles.searchIconWrap, { backgroundColor: colors.bgSecondary }]}>
        <Icon name="search" size={17} color={colors.textMuted} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.interactive}
        cursorColor={Platform.OS === 'android' ? colors.interactive : undefined}
        underlineColorAndroid="transparent"
        style={[styles.searchInput, { color: colors.text }]}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={handleClear}
          hitSlop={8}
          style={({ pressed }) => [
            styles.clearButton,
            { backgroundColor: colors.bgSecondary },
            pressed && { backgroundColor: colors.pressed },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Icon name="close" size={14} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  label: {
    ...typography.caption,
    fontWeight: '700',
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 50,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 12,
  },
  iconLeft: { marginRight: spacing.sm },
  iconRight: { marginLeft: spacing.sm },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  errorText: { fontSize: 12, flex: 1 },
  helperText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    minHeight: 48,
    borderWidth: 1,
  },
  searchIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    paddingVertical: 10,
  },
  clearButton: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
});
