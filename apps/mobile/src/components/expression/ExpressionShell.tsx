import React, { useMemo, useState, type PropsWithChildren } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

type Props = PropsWithChildren<{
  expressionId: string;
}>;

type NavItem = {
  key: string;
  label: string;
  icon: string;
  onPress: () => void;
  active?: boolean;
};

function NavButton({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => {
        item.onPress();
        onNavigate?.();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.navItem,
        {
          backgroundColor: item.active ? colors.primarySoft : 'transparent',
          borderColor: item.active ? colors.primarySoftStrong : 'transparent',
        },
        pressed ? styles.pressed : null,
      ]}
    >
      {item.active ? <View style={[styles.activeRail, { backgroundColor: colors.interactive }]} /> : null}
      <View
        style={[
          styles.navIcon,
          { backgroundColor: item.active ? colors.cardElevated : colors.bgSecondary },
        ]}
      >
        <Icon
          name={item.icon as any}
          size={18}
          color={item.active ? colors.interactive : colors.textSecondary}
        />
      </View>
      <Text
        style={[
          styles.navLabel,
          { color: item.active ? colors.text : colors.textSecondary },
        ]}
      >
        {item.label}
      </Text>
      {item.active ? <View style={[styles.activeDot, { backgroundColor: colors.interactive }]} /> : null}
    </Pressable>
  );
}

function ExpressionNavigation({
  expressionId,
  onNavigate,
}: {
  expressionId: string;
  onNavigate?: () => void;
}) {
  const { colors } = useTheme();
  const { context } = useSession();
  const pathname = usePathname();
  const management = useExpressionManagementAccess();
  const expression = context?.expressions?.find((item) => item.id === expressionId)
    ?? (context?.expression?.id === expressionId
      ? { id: expressionId, name: context.expression.name, code: undefined }
      : undefined);

  const basePath = `/expressions/${expressionId}`;
  const overviewItems = useMemo<NavItem[]>(
    () => [
      {
        key: 'home',
        label: 'Home',
        icon: 'home-outline',
        active: pathname === basePath || pathname === `${basePath}/`,
        onPress: () => router.replace(basePath as any),
      },
      {
        key: 'announcements',
        label: 'Announcements',
        icon: 'megaphone-outline',
        active: pathname === `${basePath}/announcements`,
        onPress: () => router.push(`${basePath}/announcements` as any),
      },
    ],
    [basePath, pathname],
  );

  const communityItems = useMemo<NavItem[]>(
    () => [
      {
        key: 'feed',
        label: 'Feed',
        icon: 'chatbubbles-outline',
        active: pathname === `${basePath}/feed`,
        onPress: () => router.push(`${basePath}/feed` as any),
      },
      {
        key: 'prayer',
        label: 'Prayer',
        icon: 'heart-outline',
        active: pathname === `${basePath}/prayer`,
        onPress: () => router.push(`${basePath}/prayer` as any),
      },
      {
        key: 'events',
        label: 'Events',
        icon: 'calendar-outline',
        active: pathname === `${basePath}/events`,
        onPress: () => router.push(`${basePath}/events` as any),
      },
      {
        key: 'birthdays',
        label: 'Birthdays',
        icon: 'gift-outline',
        active: pathname === `${basePath}/birthdays`,
        onPress: () => router.push(`${basePath}/birthdays` as any),
      },
    ],
    [basePath, pathname],
  );


  const mediaItems = useMemo<NavItem[]>(
    () => [
      {
        key: 'live',
        label: 'Live',
        icon: 'radio-outline',
        active: pathname === `${basePath}/live` || pathname.startsWith(`${basePath}/live/`),
        onPress: () => router.push(`${basePath}/live` as any),
      },
      {
        key: 'sermons',
        label: 'Sermons',
        icon: 'mic-outline',
        active: pathname === `${basePath}/sermons` || pathname.startsWith(`${basePath}/sermons/`),
        onPress: () => router.push(`${basePath}/sermons` as any),
      },
      {
        key: 'videos',
        label: 'Videos',
        icon: 'videocam-outline',
        active: pathname === `${basePath}/videos` || pathname.startsWith(`${basePath}/videos/`),
        onPress: () => router.push(`${basePath}/videos` as any),
      },
      {
        key: 'reels',
        label: 'Reels',
        icon: 'flash-outline',
        active: pathname === `${basePath}/reels`,
        onPress: () => router.push(`${basePath}/reels` as any),
      },
    ],
    [basePath, pathname],
  );


  const peopleItems = useMemo<NavItem[]>(
    () => [
      {
        key: 'groups',
        label: 'Groups',
        icon: 'people-circle-outline',
        active: pathname === `${basePath}/groups` || pathname.startsWith(`${basePath}/groups/`),
        onPress: () => router.push(`${basePath}/groups` as any),
      },
      {
        key: 'members',
        label: 'Members',
        icon: 'people-outline',
        active: pathname === `${basePath}/members`,
        onPress: () => router.push(`${basePath}/members` as any),
      },
      {
        key: 'leadership',
        label: 'Leadership',
        icon: 'ribbon-outline',
        active: pathname === `${basePath}/leadership`,
        onPress: () => router.push(`${basePath}/leadership` as any),
      },
    ],
    [basePath, pathname],
  );


  const managementItems = useMemo<NavItem[]>(
    () => {
      const manageBase = `${basePath}/manage`;
      return [
        {
          key: 'manage',
          label: 'Tools',
          icon: 'settings-outline',
          active: pathname === manageBase,
          onPress: () => router.push(manageBase as any),
          enabled: management.canManageAny,
        },
        {
          key: 'manage-studio',
          label: 'Content Studio',
          icon: 'color-wand-outline',
          active: pathname === `${manageBase}/studio` || pathname === `${manageBase}/reel` || pathname === `${manageBase}/video`,
          onPress: () => router.push(`${manageBase}/studio` as any),
          enabled: management.canUseContentStudio,
        },
        {
          key: 'manage-live',
          label: 'Live Studio',
          icon: 'radio-outline',
          active: pathname === `${manageBase}/live`,
          onPress: () => router.push(`${manageBase}/live` as any),
          enabled: management.canManageLive,
        },
        {
          key: 'manage-sermons',
          label: 'Manage Sermons',
          icon: 'book-outline',
          active: pathname === `${manageBase}/sermons`,
          onPress: () => router.push(`${manageBase}/sermons` as any),
          enabled: management.canManageSermons,
        },
        {
          key: 'manage-events',
          label: 'Manage Events',
          icon: 'calendar-outline',
          active: pathname === `${manageBase}/events`,
          onPress: () => router.push(`${manageBase}/events` as any),
          enabled: management.canManageEvents,
        },
        {
          key: 'manage-leadership',
          label: 'Manage Leadership',
          icon: 'people-circle-outline',
          active: pathname === `${manageBase}/leadership`,
          onPress: () => router.push(`${manageBase}/leadership` as any),
          enabled: management.canManageLeadership,
        },
        {
          key: 'manage-invite-codes',
          label: 'Invite Codes',
          icon: 'key-outline',
          active: pathname === `${manageBase}/invite-codes`,
          onPress: () => router.push(`${manageBase}/invite-codes` as any),
          enabled: management.canManageInviteCodes,
        },
        {
          key: 'manage-access',
          label: 'Team Access & Ownership',
          icon: 'shield-checkmark-outline',
          active: pathname === `${manageBase}/access`,
          onPress: () => router.push(`${manageBase}/access` as any),
          enabled: management.canManageAccess,
        },
        {
          key: 'manage-settings',
          label: 'Expression Settings',
          icon: 'settings-outline',
          active: pathname === `${manageBase}/settings`,
          onPress: () => router.push(`${manageBase}/settings` as any),
          enabled: management.canManageSettings,
        },
        {
          key: 'manage-giving',
          label: 'Giving Setup',
          icon: 'gift-outline',
          active: pathname === `${manageBase}/giving`,
          onPress: () => router.push(`${manageBase}/giving` as any),
          enabled: management.canManageGiving,
        },
        {
          key: 'manage-finance',
          label: 'Giving Reports',
          icon: 'analytics-outline',
          active: pathname === `${manageBase}/finance`,
          onPress: () => router.push(`${manageBase}/finance` as any),
          enabled: management.canReadGivingFinance,
        },
      ]
        .filter((item) => item.enabled)
        .map(({ enabled: _enabled, ...item }) => item as NavItem);
    },
    [
      basePath,
      management.canManageAccess,
      management.canManageAny,
      management.canManageEvents,
      management.canManageGiving,
      management.canManageInviteCodes,
      management.canManageLeadership,
      management.canManageSettings,
      management.canManageLive,
      management.canManageSermons,
      management.canReadGivingFinance,
      management.canUseContentStudio,
      pathname,
    ],
  );

  return (
    <View style={styles.navRoot}>
      <View style={[styles.identityCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View pointerEvents="none" style={[styles.identityGlow, { backgroundColor: colors.primarySoft }]} />
        <View style={[styles.identityMark, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
          <Icon name="people" size={23} color={colors.interactive} />
        </View>
        <View style={styles.identityCopy}>
          <Text style={[styles.identityEyebrow, { color: colors.interactive }]}>YOUR EXPRESSION</Text>
          <Text style={[styles.identityName, { color: colors.text }]} numberOfLines={2}>
            {expression?.name ?? 'Expression'}
          </Text>
          <Text style={[styles.identityMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {expression?.code || 'Private community'}
          </Text>
        </View>
        <View style={[styles.privatePill, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <Icon name="lock-closed" size={10} color={colors.textMuted} />
          <Text style={[styles.privatePillText, { color: colors.textMuted }]}>PRIVATE</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.navScrollContent}
      >
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>OVERVIEW</Text>
        {overviewItems.map((item) => (
          <NavButton key={item.key} item={item} onNavigate={onNavigate} />
        ))}

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>COMMUNITY</Text>
        {communityItems.map((item) => (
          <NavButton key={item.key} item={item} onNavigate={onNavigate} />
        ))}

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>MEDIA & LIVE</Text>
        {mediaItems.map((item) => (
          <NavButton key={item.key} item={item} onNavigate={onNavigate} />
        ))}

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>GROUPS & PEOPLE</Text>
        {peopleItems.map((item) => (
          <NavButton key={item.key} item={item} onNavigate={onNavigate} />
        ))}

        {management.ready && managementItems.length ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>MANAGE EXPRESSION</Text>
            {managementItems.map((item) => (
              <NavButton key={item.key} item={item} onNavigate={onNavigate} />
            ))}
          </>
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>SPACE</Text>
        <NavButton
          onNavigate={onNavigate}
          item={{
            key: 'switch',
            label: 'My Expressions',
            icon: 'grid-outline',
            onPress: () => router.push('/expressions'),
          }}
        />

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>COT</Text>
        <NavButton
          onNavigate={onNavigate}
          item={{
            key: 'general',
            label: 'Return to General COT',
            icon: 'globe-outline',
            onPress: () => router.replace('/general'),
          }}
        />
      </ScrollView>
    </View>
  );
}

export function ExpressionShell({ expressionId, children }: Props) {
  const { colors } = useTheme();
  const { context } = useSession();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const wide = width >= 900;
  const expressionName =
    context?.expressions?.find((item) => item.id === expressionId)?.name
    ?? context?.expression?.name
    ?? 'Expression';

  if (wide) {
    return (
      <View style={[styles.desktopRoot, { backgroundColor: colors.bg }]}>
        <View
          style={[
            styles.desktopSidebar,
            {
              paddingTop: Math.max(insets.top, spacing.md),
              backgroundColor: colors.bgSecondary,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <ExpressionNavigation expressionId={expressionId} />
        </View>
        <View style={styles.desktopContent}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.mobileRoot, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.mobileHeader,
          {
            paddingTop: insets.top + spacing.xs,
            backgroundColor: colors.glass,
            borderColor: colors.borderSubtle,
          },
          shadows.sm,
        ]}
      >
        <Pressable
          onPress={() => setDrawerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open Expression navigation"
          style={({ pressed }) => [
            styles.headerButton,
            { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
            pressed ? styles.pressed : null,
          ]}
        >
          <Icon name="menu" size={21} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerEyebrow, { color: colors.interactive }]}>EXPRESSION</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {expressionName}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/expressions')}
          accessibilityRole="button"
          accessibilityLabel="Switch Expression"
          style={({ pressed }) => [
            styles.headerButton,
            { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
            pressed ? styles.pressed : null,
          ]}
        >
          <Icon name="swap-horizontal-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.mobileContent}>{children}</View>

      <Modal
        visible={drawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setDrawerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close Expression navigation"
          />
          <View
            style={[
              styles.drawer,
              {
                paddingTop: Math.max(insets.top + spacing.sm, spacing.lg),
                paddingBottom: Math.max(insets.bottom, spacing.md),
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderSubtle,
              },
              shadows.floating,
            ]}
          >
            <View style={styles.drawerHeader}>
              <View>
                <Text style={[styles.drawerEyebrow, { color: colors.interactive }]}>CITY OF TRANSFORMATION</Text>
                <Text style={[styles.drawerTitle, { color: colors.text }]}>Expression menu</Text>
              </View>
              <Pressable
                onPress={() => setDrawerOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close Expression navigation"
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: colors.bg, borderColor: colors.borderSubtle },
                  pressed ? styles.pressed : null,
                ]}
              >
                <Icon name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <ExpressionNavigation
              expressionId={expressionId}
              onNavigate={() => setDrawerOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopSidebar: {
    width: 292,
    borderRightWidth: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  desktopContent: {
    flex: 1,
    minWidth: 0,
  },
  mobileRoot: {
    flex: 1,
  },
  mobileHeader: {
    minHeight: 62,
    marginHorizontal: spacing.sm,
    marginTop: Platform.OS === 'web' ? spacing.xs : 0,
    paddingHorizontal: spacing.sm,
    paddingBottom: 8,
    borderWidth: 1,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    zIndex: 10,
  },
  mobileContent: {
    flex: 1,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingBottom: 1,
  },
  headerEyebrow: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  headerTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 1,
  },
  navRoot: {
    flex: 1,
  },
  identityCard: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  identityGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    right: -65,
    top: -90,
    opacity: 0.9,
  },
  identityMark: {
    width: 48,
    height: 48,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  identityEyebrow: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  identityName: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  identityMeta: {
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
  },
  privatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  privatePillText: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  navScrollContent: {
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  navItem: {
    position: 'relative',
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 3,
    overflow: 'hidden',
  },
  activeRail: {
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    width: 3,
    borderRadius: radius.pill,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 3,
  },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '750' as any,
    letterSpacing: -0.12,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  drawer: {
    width: '88%',
    maxWidth: 390,
    height: '100%',
    borderRightWidth: 1,
    paddingHorizontal: spacing.md,
  },
  drawerHeader: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  drawerEyebrow: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  drawerTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: -0.45,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
