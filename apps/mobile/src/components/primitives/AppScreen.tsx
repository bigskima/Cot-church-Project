import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/state/theme';

export interface AppScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  safeAreaTop?: boolean;
  safeAreaBottom?: boolean;
  maxWidth?: number;
  keyboardAvoiding?: boolean;
  refreshControl?: React.ReactElement<any>;
}

export function AppScreen({
  children,
  scrollable = false,
  style,
  contentContainerStyle,
  safeAreaTop = false,
  safeAreaBottom = false,
  maxWidth = 860,
  keyboardAvoiding = false,
  refreshControl,
}: AppScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: safeAreaTop ? insets.top : 0,
    paddingBottom: safeAreaBottom ? insets.bottom : 0,
  };

  const responsiveWrapperStyle: ViewStyle = {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? maxWidth : undefined,
    alignSelf: 'center',
  };

  const content = scrollable ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        styles.scrollContent,
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
  );

  if (keyboardAvoiding) {
    return (
      <View style={[containerStyle, style]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={responsiveWrapperStyle}
        >
          {content}
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      <View style={responsiveWrapperStyle}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
});
