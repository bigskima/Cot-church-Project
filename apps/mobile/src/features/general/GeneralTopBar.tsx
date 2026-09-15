import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, BrandMark, Icon } from '@/components';
import { TourAnchor } from '@/features/tour/AppTourProvider';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

type Props = {
  organizationName?: string;
  authenticated?: boolean;
  avatarUrl?: string | null;
  displayName?: string;
  canManage?: boolean;
};

function HeaderButton({ icon, label, onPress, accent = false }: { icon: string; label: string; onPress: () => void; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: accent ? colors.primarySoft : colors.bgSecondary, borderColor: accent ? colors.primarySoftStrong : colors.borderSubtle },
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon as any} size={19} color={accent ? colors.interactive : colors.text} />
    </Pressable>
  );
}

export function GeneralTopBar({ organizationName, authenticated, avatarUrl, displayName, canManage }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const wide = width >= 720;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.xs }]}>
      <TourAnchor targetKey="general.topbar">
        <View style={[styles.bar, { backgroundColor: colors.glass, borderColor: colors.borderSubtle }, shadows.sm]}>
          <Pressable
            onPress={() => authenticated ? router.push('/expressions') : undefined}
            disabled={!authenticated}
            accessibilityRole="button"
            accessibilityLabel={authenticated ? 'General COT. Open My Expressions' : 'General COT'}
            style={({ pressed }) => [styles.identity, pressed && authenticated ? styles.pressed : null]}
          >
            <View style={[styles.brand, { backgroundColor: colors.cardElevated, borderColor: colors.borderSubtle }]}>
              <BrandMark variant="header" size={28} />
            </View>
            <View style={styles.identityCopy}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>General COT</Text>
                <View style={[styles.scopePill, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="globe-outline" size={11} color={colors.interactive} />
                  <Text style={[styles.scopePillText, { color: colors.interactive }]}>PUBLIC</Text>
                </View>
              </View>
              <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>{organizationName || 'City of Transformation'}</Text>
            </View>
          </Pressable>

          {wide ? (
            <Pressable
              onPress={() => router.push('/general/explore')}
              accessibilityRole="search"
              style={({ pressed }) => [styles.search, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
            >
              <Icon name="search-outline" size={17} color={colors.textMuted} />
              <Text style={[styles.searchText, { color: colors.textMuted }]}>Search sermons, people, events and posts</Text>
              <View style={[styles.searchHint, { backgroundColor: colors.card }]}><Text style={[styles.searchHintText, { color: colors.textMuted }]}>Discover</Text></View>
            </Pressable>
          ) : null}

          <View style={styles.actions}>
            {!wide ? <HeaderButton icon="search-outline" label="Search General COT" onPress={() => router.push('/general/explore')} /> : null}
            {authenticated ? <HeaderButton icon="notifications-outline" label="Notifications" onPress={() => router.push('/general/notifications')} /> : null}
            {authenticated && canManage && wide ? <HeaderButton icon="shield-checkmark-outline" label="Leadership tools" onPress={() => router.push('/general/leadership')} accent /> : null}
            {authenticated && wide ? <HeaderButton icon="ellipsis-horizontal" label="General COT tools and settings" onPress={() => router.push('/general/tools')} /> : null}
            {authenticated && wide ? (
              <Pressable onPress={() => router.push('/general/profile')} accessibilityRole="button" accessibilityLabel="Open your profile" style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
                <Avatar url={avatarUrl} name={displayName || 'COT member'} size="sm" />
              </Pressable>
            ) : !authenticated ? (
              <HeaderButton icon="person-outline" label="Sign in" onPress={() => router.push('/(auth)/login' as any)} accent />
            ) : null}
          </View>
        </View>
      </TourAnchor>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  bar: { width: '100%', maxWidth: 1040, alignSelf: 'center', minHeight: 62, borderWidth: 1, borderRadius: radius.xxl, paddingHorizontal: spacing.sm, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  identity: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  brand: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  identityCopy: { minWidth: 0, maxWidth: 250, flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 16, lineHeight: 20, fontWeight: '900', letterSpacing: -0.42, flexShrink: 1 },
  meta: { fontSize: 10.5, lineHeight: 14, fontWeight: '600', marginTop: 1 },
  scopePill: { minHeight: 20, borderRadius: radius.pill, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 3 },
  scopePillText: { fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.55 },
  search: { flex: 1, maxWidth: 430, minHeight: 42, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: 'auto' },
  searchText: { flex: 1, fontSize: 11.5, fontWeight: '600' },
  searchHint: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  searchHintText: { fontSize: 9, fontWeight: '800' },
  actions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconButton: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarButton: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.975 }] },
});
