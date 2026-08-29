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
  containerStyle?: any;
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
    <View style={[styles.container, containerStyle] as any}>
      {label && (
        <Text style={[styles.label, dark ? styles.labelDark : styles.labelLight] as any}>{label}</Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          dark ? styles.inputWrapperDark : styles.inputWrapperLight,
          error ? styles.inputError : undefined,
        ] as any}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          placeholderTextColor={dark ? '#A68A75' : '#8C6549'}
          style={[styles.input, dark ? styles.textDark : styles.textLight, style] as any}
          {...props}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helperText, dark ? styles.helperDark : styles.helperLight] as any}>
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
  placeholder = 'Search...',
  onClear,
  dark = false,
}: SearchBarProps) {
  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View
      style={[
        styles.searchContainer,
        dark ? styles.searchContainerDark : styles.searchContainerLight,
      ] as any}
    >
      <Text style={styles.searchIcon}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={dark ? '#A68A75' : '#8C6549'}
        style={[styles.searchInput, dark ? styles.textDark : styles.textLight] as any}
      />
      {value.length > 0 && (
        <Pressable onPress={handleClear} style={styles.clearButton as any}>
          <Text style={styles.clearIcon}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  labelLight: {
    color: '#26140A',
  },
  labelDark: {
    color: '#E6CCB2',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputWrapperLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8D5C4',
  },
  inputWrapperDark: {
    backgroundColor: '#1C1009',
    borderColor: '#452A1A',
  },
  inputError: {
    borderColor: palette.live,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 10,
  },
  textLight: {
    color: '#26140A',
  },
  textDark: {
    color: '#FFFDF9',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.live,
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  helperLight: {
    color: '#8C6549',
  },
  helperDark: {
    color: '#A68A75',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
  },
  searchContainerLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8D5C4',
  },
  searchContainerDark: {
    backgroundColor: '#22140C',
    borderColor: '#452A1A',
  },
  searchIcon: {
    fontSize: 18,
    color: '#F59E0B',
    marginRight: spacing.sm,
    fontWeight: '900',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    padding: 4,
  },
  clearIcon: {
    fontSize: 12,
    color: '#8C6549',
    fontWeight: '900',
  },
});
