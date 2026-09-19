import React, { useEffect, useState } from 'react';
import { Tabs, usePathname } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/primitives/Icon';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

const TAB_ICON_SIZE = 22;
const hidden = { href: null } as const;
// Reels is intentionally excluded: immersive playback owns the full screen and
// supplies its own Back/Create controls instead of the primary bottom bar.
const PRIMARY_GENERAL_PATHS = new Set(['/general', '/general/explore', '/general/chat', '/general/profile']);
const PRIMARY_TAB_NAMES = ['index', 'explore', 'reels', 'chat', 'profile'] as const;

function PrimaryGeneralTabBar({ state, descriptors, navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'web' ? 9 : 7);
  const routes = state.routes.filter((route: any) => PRIMARY_TAB_NAMES.includes(route.name));

  return (
    <View style={[styles.tabBar, { backgroundColor: colors.glass, borderColor: colors.borderSubtle, minHeight: 64 + bottomInset, paddingBottom: bottomInset }, shadows.floating]}>
      {routes.map((route: any) => {
        const routeIndex = state.routes.findIndex((candidate: any) => candidate.key === route.key);
        const focused = state.index === routeIndex;
        const options = descriptors[route.key]?.options ?? {};
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
        const color = focused ? colors.interactive : colors.textMuted;
        const icon = options.tabBarIcon?.({ focused, color, size: TAB_ICON_SIZE });
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={({ pressed }) => [styles.customTabItem, pressed && styles.pressedTab]}
          >
            {icon}
            <Text style={[styles.label, { color: focused ? colors.text : colors.textMuted }]} numberOfLines={1}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function GeneralLayout() {
  const { colors } = useTheme();
  const { mode, accessReady, context, leaveExpression } = useSession();
  const pathname = usePathname();
  const [leaving, setLeaving] = useState(false);
  const [boundaryError, setBoundaryError] = useState('');

  // Opening General COT always resolves access first by Clearing the private Expression context.
  useEffect(() => {
    if (mode !== 'authenticated' || !accessReady || !context?.expression?.id || leaving) return;
    let cancelled = false;
    setLeaving(true);
    setBoundaryError('');
    void leaveExpression()
      .catch((value) => { if (!cancelled) setBoundaryError(value instanceof Error ? value.message : 'Unable to open General COT.'); })
      .finally(() => { if (!cancelled) setLeaving(false); });
    return () => { cancelled = true; };
  }, [accessReady, context?.expression?.id, leaveExpression, leaving, mode]);

  if (mode === 'restoring' || (mode === 'authenticated' && !accessReady) || context?.expression?.id) {
    return (
      <View style={[styles.boundaryScreen, { backgroundColor: colors.bg }]}>
        <View style={[styles.boundaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          {boundaryError ? (
            <><Icon name="alert-circle-outline" size={27} color={colors.live} /><Text style={[styles.boundaryTitle, { color: colors.text }]}>General COT is unavailable</Text><Text style={[styles.boundaryCopy, { color: colors.textSecondary }]}>{boundaryError}</Text></>
          ) : (
            <><ActivityIndicator size="large" color={colors.interactive} /><Text style={[styles.boundaryTitle, { color: colors.text }]}>Taking you to General COT</Text><Text style={[styles.boundaryCopy, { color: colors.textSecondary }]}>Getting your church-wide home, media and messages ready.</Text></>
          )}
        </View>
      </View>
    );
  }

  const normalizedPath = pathname.replace(/\/+$/, '') || '/general';
  const showPrimaryNavigation = PRIMARY_GENERAL_PATHS.has(normalizedPath);
  const screenOptions = {
    headerShown: false,
    lazy: true,
    tabBarActiveTintColor: colors.text,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarLabelStyle: styles.label,
    tabBarHideOnKeyboard: true,
    tabBarItemStyle: styles.item,
    tabBarIconStyle: styles.icon,
    sceneStyle: { backgroundColor: colors.bg } as any,
  };

  const renderIcon = (filled: string, outline: string, accent = false) => ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <View style={styles.iconStack}>
      <View style={[styles.iconShell, { backgroundColor: focused ? (accent ? colors.text : colors.primarySoft) : 'transparent' }]}>
        <Icon name={focused ? filled : outline} size={TAB_ICON_SIZE} color={focused && accent ? colors.bg : focused ? colors.interactive : color as string} />
      </View>
      <View style={[styles.activeDot, { backgroundColor: focused ? colors.interactive : 'transparent' }]} />
    </View>
  );

  return (
    <Tabs screenOptions={screenOptions} backBehavior="history" tabBar={showPrimaryNavigation ? (props) => <PrimaryGeneralTabBar {...props} /> : () => null}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarAccessibilityLabel: 'General COT Home', tabBarIcon: renderIcon('home', 'home-outline') }} />
      <Tabs.Screen name="explore" options={{ title: 'Discover', tabBarAccessibilityLabel: 'Discover General COT', tabBarIcon: renderIcon('compass', 'compass-outline') }} />
      <Tabs.Screen name="reels" options={{ title: 'Reels', tabBarAccessibilityLabel: 'General COT Reels', tabBarIcon: renderIcon('play', 'play-outline', true) }} />
      <Tabs.Screen name="community" options={hidden as any} />
      <Tabs.Screen name="chat" options={{ title: 'Messages', tabBarAccessibilityLabel: 'COT messages', tabBarIcon: renderIcon('chatbubbles', 'chatbubbles-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'You', tabBarAccessibilityLabel: 'Your General COT profile', tabBarIcon: renderIcon('person', 'person-outline') }} />

      <Tabs.Screen name="announcements" options={hidden as any} />
      <Tabs.Screen name="participate" options={hidden as any} />
      <Tabs.Screen name="sermons" options={hidden as any} />
      <Tabs.Screen name="watch/index" options={hidden as any} />
      <Tabs.Screen name="watch/[id]" options={hidden as any} />
      <Tabs.Screen name="live/index" options={hidden as any} />
      <Tabs.Screen name="live/[id]" options={hidden as any} />
      <Tabs.Screen name="sermon/[id]" options={hidden as any} />
      <Tabs.Screen name="series/[id]" options={hidden as any} />
      <Tabs.Screen name="events" options={hidden as any} />
      <Tabs.Screen name="event/[id]" options={hidden as any} />
      <Tabs.Screen name="post/[id]" options={hidden as any} />
      <Tabs.Screen name="comments/[contentId]" options={hidden as any} />
      <Tabs.Screen name="giving" options={hidden as any} />
      <Tabs.Screen name="prayer" options={hidden as any} />
      <Tabs.Screen name="church-story" options={hidden as any} />
      <Tabs.Screen name="settings" options={hidden as any} />
      <Tabs.Screen name="tour" options={hidden as any} />
      <Tabs.Screen name="notifications" options={hidden as any} />
      <Tabs.Screen name="notification-settings" options={hidden as any} />
      <Tabs.Screen name="saved" options={hidden as any} />
      <Tabs.Screen name="groups/index" options={hidden as any} />
      <Tabs.Screen name="groups/[groupId]" options={hidden as any} />
      <Tabs.Screen name="groups/[groupId]/chat" options={hidden as any} />
      <Tabs.Screen name="groups/[groupId]/giving" options={hidden as any} />
      <Tabs.Screen name="tools" options={hidden as any} />
      <Tabs.Screen name="leadership" options={hidden as any} />
      <Tabs.Screen name="leadership/index" options={hidden as any} />
      <Tabs.Screen name="leadership/media-studio" options={hidden as any} />
      <Tabs.Screen name="leadership/pastoral-triage" options={hidden as any} />
      <Tabs.Screen name="leadership/church-leadership" options={hidden as any} />
      <Tabs.Screen name="leadership/announcements-manage" options={hidden as any} />
      <Tabs.Screen name="leadership/urgent-updates" options={hidden as any} />
      <Tabs.Screen name="leadership/home-updates-manage" options={hidden as any} />
      <Tabs.Screen name="leadership/feed-ranking" options={hidden as any} />
      <Tabs.Screen name="leadership/watch-categories" options={hidden as any} />
      <Tabs.Screen name="leadership/giving-manage" options={hidden as any} />
      <Tabs.Screen name="leadership/giving-finance" options={hidden as any} />
      <Tabs.Screen name="leadership/sermons-manage" options={hidden as any} />
      <Tabs.Screen name="leadership/events-manage" options={hidden as any} />
      <Tabs.Screen name="leadership/expressions-manage" options={hidden as any} />
      <Tabs.Screen name="leadership/roles-access" options={hidden as any} />
      <Tabs.Screen name="leadership/platform-admin/index" options={hidden as any} />
      <Tabs.Screen name="leadership/platform-admin/[module]" options={hidden as any} />
      <Tabs.Screen name="studio/index" options={hidden as any} />
      <Tabs.Screen name="studio/reel" options={hidden as any} />
      <Tabs.Screen name="studio/video" options={hidden as any} />
      <Tabs.Screen name="assistant" options={hidden as any} />
      <Tabs.Screen name="expression/[id]" options={hidden as any} />
      <Tabs.Screen name="member/[username]" options={hidden as any} />
      <Tabs.Screen name="member-connections" options={hidden as any} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  boundaryScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  boundaryCard: { width: '100%', maxWidth: 430, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  boundaryTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', textAlign: 'center', letterSpacing: -0.35 },
  boundaryCopy: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  label: { fontWeight: '800', fontSize: 9.5, marginTop: 0, lineHeight: 12, letterSpacing: -0.08 },
  item: { minHeight: 58, paddingTop: 5 },
  icon: { marginTop: 0 },
  iconStack: { height: 36, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconShell: { minWidth: 42, height: 31, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  activeDot: { width: 4, height: 4, borderRadius: 2 },
  tabBar: { position: 'absolute', left: 14, right: 14, bottom: 10, maxWidth: 620, alignSelf: 'center', borderWidth: 1, borderRadius: 28, overflow: 'hidden', paddingHorizontal: 4, paddingTop: 5, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around' },
  customTabItem: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  pressedTab: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});