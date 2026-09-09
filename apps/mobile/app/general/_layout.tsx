import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { ActivityIndicator, Platform, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/primitives/Icon';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

const TAB_ICON_SIZE = 23;
const hidden = { href: null, tabBarButton: () => null, tabBarItemStyle: { display: 'none' } } as const;

export default function GeneralLayout() {
  const { colors } = useTheme();
  const { mode, accessReady, context, leaveExpression } = useSession();
  const insets = useSafeAreaInsets();
  const [leaving, setLeaving] = useState(false);
  const [boundaryError, setBoundaryError] = useState('');

  useEffect(() => {
    if (mode !== 'authenticated' || !accessReady || !context?.expression?.id || leaving) return;
    let cancelled = false;
    setLeaving(true);
    setBoundaryError('');
    void leaveExpression()
      .catch((value) => {
        if (!cancelled) setBoundaryError(value instanceof Error ? value.message : 'Unable to open General COT.');
      })
      .finally(() => { if (!cancelled) setLeaving(false); });
    return () => { cancelled = true; };
  }, [accessReady, context?.expression?.id, leaveExpression, leaving, mode]);

  if (mode === 'restoring' || (mode === 'authenticated' && !accessReady) || context?.expression?.id) {
    return (
      <View style={[styles.boundaryScreen, { backgroundColor: colors.bg }]}>
        <View style={[styles.boundaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          {boundaryError ? (
            <>
              <Icon name="alert-circle-outline" size={26} color={colors.live} />
              <Text style={[styles.boundaryTitle, { color: colors.text }]}>General COT is unavailable</Text>
              <Text style={[styles.boundaryCopy, { color: colors.textSecondary }]}>{boundaryError}</Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.interactive} />
              <Text style={[styles.boundaryTitle, { color: colors.text }]}>Opening General COT</Text>
              <Text style={[styles.boundaryCopy, { color: colors.textSecondary }]}>Clearing the private Expression context before the church-wide experience is rendered.</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 8);
  const barHeight = 66 + bottomInset;
  const screenOptions = {
    headerShown: false,
    lazy: true,
    tabBarActiveTintColor: colors.interactive,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarLabelStyle: styles.label,
    tabBarHideOnKeyboard: true,
    tabBarStyle: [styles.tabBar, { backgroundColor: colors.glass, borderColor: colors.borderSubtle, height: barHeight, paddingBottom: bottomInset }] as any,
    tabBarItemStyle: styles.item,
    tabBarIconStyle: styles.icon,
    sceneStyle: { backgroundColor: colors.bg } as any,
  };

  const renderIcon = (filled: string, outline: string) => ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <View style={[styles.iconShell, { backgroundColor: focused ? colors.primarySoft : 'transparent', borderColor: focused ? colors.primarySoftStrong : 'transparent' }]}>
      <Icon name={focused ? filled : outline} size={TAB_ICON_SIZE} color={color as string} />
    </View>
  );

  return (
    <Tabs screenOptions={screenOptions} backBehavior="history">
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarAccessibilityLabel: 'General COT Home', tabBarIcon: renderIcon('home', 'home-outline') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarAccessibilityLabel: 'Explore General COT', tabBarIcon: renderIcon('compass', 'compass-outline') }} />
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Reels',
          tabBarAccessibilityLabel: 'General COT Reels',
          tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
            <View style={[styles.reelsHalo, { backgroundColor: colors.bg, borderColor: focused ? colors.primarySoftStrong : colors.borderSubtle }]}>
              <View style={[styles.reelsButton, { backgroundColor: focused ? colors.interactive : colors.cardElevated, borderColor: focused ? colors.interactive : colors.border }]}>
                <Icon name={focused ? 'play' : 'play-outline'} size={22} color={focused ? '#FFFFFF' : (color as string)} />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="community" options={hidden as any} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarAccessibilityLabel: 'COT Chat', tabBarIcon: renderIcon('chatbubbles', 'chatbubbles-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'You', tabBarAccessibilityLabel: 'Your General COT profile', tabBarIcon: renderIcon('person', 'person-outline') }} />

      <Tabs.Screen name="watch" options={hidden as any} />
      <Tabs.Screen name="live" options={hidden as any} />
      <Tabs.Screen name="sermon" options={hidden as any} />
      <Tabs.Screen name="series" options={hidden as any} />
      <Tabs.Screen name="event" options={hidden as any} />
      <Tabs.Screen name="post" options={hidden as any} />
      <Tabs.Screen name="comments" options={hidden as any} />
      <Tabs.Screen name="giving" options={hidden as any} />
      <Tabs.Screen name="prayer" options={hidden as any} />
      <Tabs.Screen name="church-story" options={hidden as any} />
      <Tabs.Screen name="settings" options={hidden as any} />
      <Tabs.Screen name="notifications" options={hidden as any} />
      <Tabs.Screen name="notification-settings" options={hidden as any} />
      <Tabs.Screen name="saved" options={hidden as any} />
      <Tabs.Screen name="tools" options={hidden as any} />
      <Tabs.Screen name="leadership" options={hidden as any} />
      <Tabs.Screen name="studio" options={hidden as any} />
      <Tabs.Screen name="assistant" options={hidden as any} />
      <Tabs.Screen name="expression" options={hidden as any} />
      <Tabs.Screen name="member" options={hidden as any} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  boundaryScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  boundaryCard: { width: '100%', maxWidth: 430, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  boundaryTitle: { fontSize: 20, lineHeight: 25, fontWeight: '800', textAlign: 'center' },
  boundaryCopy: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  label: { fontWeight: '700', fontSize: 9.5, marginTop: 2, lineHeight: 12, letterSpacing: -0.1 },
  item: { minHeight: 56, paddingTop: 5 },
  icon: { marginTop: 0 },
  iconShell: { minWidth: 42, height: 32, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  reelsHalo: { width: 56, height: 56, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: -15, ...shadows.floating },
  reelsButton: { width: 46, height: 46, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: { position: 'absolute', left: 12, right: 12, bottom: 9, maxWidth: 720, alignSelf: 'center', borderTopWidth: 0, borderWidth: 1, borderRadius: radius.xxl, overflow: 'visible', ...shadows.floating },
});
