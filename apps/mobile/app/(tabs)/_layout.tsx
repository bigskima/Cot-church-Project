import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/state/theme';
import { Icon } from '@/components/primitives/Icon';

// Minimum accessible touch target (Android recommended 48dp)
const TOUCH_TARGET = 48;
const TAB_ICON_SIZE = 24;

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const barHeight = TOUCH_TARGET + 6 + Math.max(insets.bottom, 8);

  const screenOptions = {
    headerShown: false,
    lazy: true,
    tabBarActiveTintColor: colors.interactive,
    tabBarInactiveTintColor: isDark ? '#64748B' : '#94A3B8',
    tabBarLabelStyle: styles.label,
    tabBarHideOnKeyboard: true,
    tabBarStyle: [
      styles.tabBar,
      {
        backgroundColor: colors.card,
        borderTopColor: colors.border,
        height: barHeight,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 8,
      },
    ] as any,
    tabBarItemStyle: styles.item,
    tabBarIconStyle: styles.icon,
    sceneStyle: { backgroundColor: colors.bg } as any,
  };

  const renderIcon = (filled: string, outline: string) =>
    ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <Icon
        name={focused ? filled : outline}
        size={TAB_ICON_SIZE}
        color={color as string}
      />
    );

  return (
    <Tabs
      screenOptions={screenOptions}
      backBehavior="history"
      initialRouteName="home"
    >
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
          title: 'Discover',
          tabBarAccessibilityLabel: 'Discover',
          tabBarIcon: renderIcon('compass', 'compass-outline'),
        }}
      />
      <Tabs.Screen
        name="watch"
        options={{
          title: 'Watch',
          tabBarAccessibilityLabel: 'Watch',
          tabBarIcon: renderIcon('play-circle', 'play-circle-outline'),
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
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile',
          tabBarIcon: renderIcon('person', 'person-outline'),
        }}
      />
      {/* Internal stack screens nested within tab groups. They are not direct
          tab children and never surface as bottom-tab items. The `live` group
          is a direct child and is kept routable but hidden from the tab bar. */}
      <Tabs.Screen name="live" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: '600',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  item: {
    minHeight: 48,
    paddingVertical: 2,
  },
  icon: {
    marginTop: 2,
  },
  tabBar: {
    borderTopWidth: 1,
    maxWidth: Platform.OS === 'web' ? 860 : undefined,
    width: '100%',
    alignSelf: 'center',
  },
});
