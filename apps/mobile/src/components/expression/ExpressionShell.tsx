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
  const expression = context?.expressions?.find((item) => item.id === expressionId)
    ?? (context?.expression?.id === expressionId
      ? { id: expressionId, name: context.expression.name, code: undefined }
      : undefined);

  const items = useMemo<NavItem[]>(
    () => [
      {
        key: 'home',
        label: 'Home',
        icon: 'home-outline',
        active: pathname === `/expressions/${expressionId}` || pathname === `/expressions/${expressionId}/`,
        onPress: () => router.replace(`/expressions/${expressionId}` as any),
      },
    ],
    [expressionId, pathname],
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
        {items.map((item) => (
          <NavButton key={item.key} item={item} onNavigate={onNavigate} />
        ))}

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
    ...StyleSheet.absoluteFillObject,
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
