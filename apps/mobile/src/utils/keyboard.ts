import { Platform, type KeyboardAvoidingViewProps, type ScrollViewProps } from 'react-native';

export const PLATFORM_KEYBOARD_BEHAVIOR: KeyboardAvoidingViewProps['behavior'] = Platform.select({
  ios: 'padding',
  android: 'padding',
  web: 'height',
  default: 'padding',
});

export const PLATFORM_KEYBOARD_DISMISS_MODE: ScrollViewProps['keyboardDismissMode'] = Platform.select({
  ios: 'interactive',
  android: 'on-drag',
  web: 'none',
  default: 'on-drag',
});

export const PLATFORM_KEYBOARD_VERTICAL_OFFSET = Platform.select({
  ios: 0,
  android: 0,
  web: 0,
  default: 0,
});
