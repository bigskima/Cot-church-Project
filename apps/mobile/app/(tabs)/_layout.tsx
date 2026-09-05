import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/state/theme';
import { Icon } from '@/components/primitives/Icon';
import { radius, shadows } from '@/design-system/tokens';

const TAB_ICON_SIZE = 23;

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 8);
  const barHeight = 62 + bottomInset;

  const screenOptions = {
    headerShown: false,
    lazy: true,
    tabBarActiveTintColor: colors.interactive,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarLabelStyle: styles.label,
    tabBarHideOnKeyboard: true,
    tabBarStyle: [
      styles.tabBar,
      {
        backgroundColor: colors.glass,
        borderColor: colors.borderSubtle,
        height: barHeight,
        paddingBottom: bottomInset,
      },
    ] as any,
    tabBarItemStyle: styles.item,
    tabBarIconStyle: styles.icon,
    sceneStyle: { backgroundColor: colors.bg } as any,
  };

  const renderIcon = (filled: string, outline: string) =>
    ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <View
        style={[
          styles.iconShell,
          focused && { backgroundColor: colors.primarySoft },
        ]}
      >
        <Icon name={focused ? filled : outline} size={TAB_ICON_SIZE} color={color as string} />
      </View>
    );

  return (
    <Tabs screenOptions={screenOptions} backBehavior="history">
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: renderIcon('home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Explore',
          tabBarAccessibilityLabel: 'Explore',
          tabBarIcon: renderIcon('compass', 'compass-outline'),
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Reels',
          tabBarAccessibilityLabel: 'Reels',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.reelsButton,
                {
                  backgroundColor: focused ? colors.interactive : colors.cardElevated,
                  borderColor: focused ? colors.interactive : colors.border,
                },
              ]}
            >
              <Icon name={focused ? 'play' : 'play-outline'} size={22} color={focused ? '#FFFFFF' : (color as string)} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarAccessibilityLabel: 'Community',
          tabBarIcon: renderIcon('people', 'people-outline'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarAccessibilityLabel: 'Your profile',
          tabBarIcon: renderIcon('person', 'person-outline'),
        }}
      />
      <Tabs.Screen name="live" options={{ href: null }} />
      <Tabs.Screen name="watch" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: '700',
    fontSize: 10,
    marginTop: 1,
    lineHeight: 13,
  },
  item: {
    minHeight: 54,
    paddingTop: 5,
  },
  icon: { marginTop: 0 },
  iconShell: {
    minWidth: 38,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  reelsButton: {
    width: 46,
    height: 46,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
    ...shadows.floating,
  },
  tabBar: {
    position: Platform.OS === 'web' ? 'absolute' : 'absolute',
    left: Platform.OS === 'web' ? '50%' : 10,
    right: Platform.OS === 'web' ? undefined : 10,
    bottom: Platform.OS === 'web' ? 10 : 8,
    width: Platform.OS === 'web' ? 'min(720px, calc(100% - 24px))' as any : undefined,
    transform: Platform.OS === 'web' ? [{ translateX: '-50%' as any }] : undefined,
    borderTopWidth: 0,
    borderWidth: 1,
    borderRadius: radius.xxl,
    overflow: 'visible',
    ...shadows.floating,
  },
});
