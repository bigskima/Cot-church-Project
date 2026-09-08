import React from 'react';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/primitives/Icon';
import { radius, shadows } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

const ICON_SIZE = 22;

export default function GeneralMainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 8);
  const barHeight = 64 + bottomInset;

  const renderIcon = (filled: string, outline: string) =>
    ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <View
        style={[
          styles.iconShell,
          {
            backgroundColor: focused ? colors.primarySoft : 'transparent',
            borderColor: focused ? colors.primarySoftStrong : 'transparent',
          },
        ]}
      >
        <Icon name={focused ? filled : outline} size={ICON_SIZE} color={color as string} />
      </View>
    );

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarActiveTintColor: colors.interactive,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarIconStyle: styles.icon,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: colors.glass,
            borderColor: colors.borderSubtle,
            height: barHeight,
            paddingBottom: bottomInset,
          },
        ],
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: renderIcon('home', 'home-outline') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: renderIcon('compass', 'compass-outline') }} />
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Reels',
          tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
            <View style={[styles.reelsHalo, { backgroundColor: colors.bg, borderColor: focused ? colors.primarySoftStrong : colors.borderSubtle }]}>
              <View style={[styles.reelsButton, { backgroundColor: focused ? colors.interactive : colors.cardElevated, borderColor: focused ? colors.interactive : colors.border }]}>
                <Icon name={focused ? 'play' : 'play-outline'} size={21} color={focused ? '#FFFFFF' : (color as string)} />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: renderIcon('people', 'people-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: renderIcon('person', 'person-outline') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '800', fontSize: 9.5, lineHeight: 12, marginTop: 1 },
  item: { minHeight: 54, paddingTop: 5 },
  icon: { marginTop: 0 },
  iconShell: {
    minWidth: 42,
    height: 31,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  reelsHalo: {
    width: 54,
    height: 54,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
    ...shadows.floating,
  },
  reelsButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 9,
    maxWidth: 680,
    alignSelf: 'center',
    borderTopWidth: 0,
    borderWidth: 1,
    borderRadius: radius.xxl,
    overflow: 'visible',
    ...shadows.floating,
  },
});
