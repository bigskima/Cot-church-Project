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
      <Icon name="chevron-forward" size={14} color={colors.textMuted} />
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
        key: 'chat',
        label: 'Chat',
        icon: 'chatbubble-ellipses-outline',
        active: pathname === `${basePath}/chat`,
        onPress: () => router.push(`${basePath}/chat` as any),
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
      <View style={[styles.identityCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
        <View style={[styles.identityMark, { backgroundColor: colors.primarySoft }]}>
          <Icon name="people" size={22} color={colors.interactive} />
        </View>
        <View style={styles.identityCopy}>
          <Text style={[styles.identityName, { color: colors.text }]} numberOfLines={2}>
            {expression?.name ?? 'Expression'}
          </Text>
          <Text style={[styles.identityMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {expression?.code || 'Private COT community'}
          </Text>
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
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {expressionName}
          </Text>
          <View style={styles.headerMetaRow}>
            <Icon name="people-outline" size={12} color={colors.interactive} />
            <Text style={[styles.headerMeta, { color: colors.textSecondary }]}>Expression</Text>
          </View>
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
              <Text style={[styles.drawerEyebrow, { color: colors.textMuted }]}>COT EXPRESSION</Text>
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
    width: 280,
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
    minHeight: 68,
    marginHorizontal: spacing.sm,
    marginTop: Platform.OS === 'web' ? spacing.xs : 0,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.xxl,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    zIndex: 10,
  },
  mobileContent: {
    flex: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingBottom: 2,
  },
  headerTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerMeta: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  navRoot: {
    flex: 1,
  },
  identityCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  identityMark: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  identityMeta: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
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
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
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
    fontWeight: '700',
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
    width: '84%',
    maxWidth: 360,
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
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
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
