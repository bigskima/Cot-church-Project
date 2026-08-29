import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { palette, radius, spacing } from '../design-system/tokens';

interface InputFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  dark?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function InputField({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  dark = false,
  containerStyle,
  style,
  ...props
}: InputFieldProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, dark ? styles.labelDark : styles.labelLight]}>{label}</Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          dark ? styles.inputWrapperDark : styles.inputWrapperLight,
          error ? styles.inputError : undefined,
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          placeholderTextColor={dark ? palette.mutedLight : palette.muted}
          style={[styles.input, dark ? styles.textDark : styles.textLight, style]}
          {...props}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helperText, dark ? styles.helperDark : styles.helperLight]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  dark?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search sermons, scriptures, events...',
  onClear,
  dark = false,
}: SearchBarProps) {
  return (
    <View style={[styles.searchContainer, dark ? styles.searchDark : styles.searchLight]}>
      <Text style={[styles.searchIcon, { color: dark ? palette.mutedLight : palette.muted }]}>
        🔍
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={dark ? palette.mutedLight : palette.muted}
        style={[styles.searchInput, dark ? styles.textDark : styles.textLight]}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
          style={styles.clearButton}
        >
          <Text style={styles.clearIcon}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  labelLight: {
    color: palette.inkSecondary,
  },
  labelDark: {
    color: palette.creamDark,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  inputWrapperLight: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
  },
  inputWrapperDark: {
    backgroundColor: palette.surfaceDarkElevated,
    borderColor: palette.glassBorderDark,
  },
  inputError: {
    borderColor: palette.live,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
  textLight: {
    color: palette.ink,
  },
  textDark: {
    color: palette.white,
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  errorText: {
    fontSize: 12,
    color: palette.live,
    marginTop: 4,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  helperLight: {
    color: palette.muted,
  },
  helperDark: {
    color: palette.mutedLight,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 48,
    borderWidth: 1,
  },
  searchLight: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
  },
  searchDark: {
    backgroundColor: palette.surfaceDarkElevated,
    borderColor: palette.glassBorderDark,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: '#0000001A',
  },
  clearIcon: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.muted,
  },
});
