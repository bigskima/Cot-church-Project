import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Icon } from '@/components';
import { FullIdentityBadge, type PublicIdentityBadge } from '@/components/identity/PublicIdentityBadge';
import { radius, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

type Props = {
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  badges?: PublicIdentityBadge[];
  followers?: number | null;
  following?: number | null;
  onFollowers?: () => void;
  onFollowing?: () => void;
  actions?: React.ReactNode;
  contextLabel?: string | null;
};

/**
 * Reusable social profile hero for the signed-in profile and public member view.
 * It deliberately owns the banner as the first visual surface: no explanatory
 * card is placed above it.
 */
export function SocialProfileHero({
  displayName,
  username,
  avatarUrl,
  bannerUrl,
  bio,
  badges = [],
  followers,
  following,
  onFollowers,
  onFollowing,
  actions,
  contextLabel,
}: Props) {
  const { colors } = useTheme();

  const stat = (value: number | null | undefined, label: string, onPress?: () => void) => (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.stat, pressed && onPress ? styles.pressed : null]}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${value ?? 0} ${label}`}
    >
      <Text style={[styles.statNumber, { color: colors.text }]}>{(value ?? 0).toLocaleString()}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, borderBottomColor: colors.borderSubtle }]}>
      <View style={[styles.banner, { backgroundColor: colors.primarySoft }]}>
        {bannerUrl ? (
          <Image source={{ uri: bannerUrl }} style={styles.bannerImage} resizeMode="cover" accessibilityLabel={`${displayName} banner`} />
        ) : (
          <View style={styles.bannerFallback}>
            <Icon name="image-outline" size={22} color={colors.interactive} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.avatarActionRow}>
          <View style={[styles.avatarShell, { backgroundColor: colors.bg, borderColor: colors.bg }]}>
            <Avatar url={avatarUrl ?? undefined} name={displayName} size="xl" />
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>

        <View style={styles.identity}>
          <View style={styles.nameLine}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{displayName}</Text>
            {badges[0] ? <FullIdentityBadge badge={badges[0]} compact /> : null}
          </View>
          {username ? <Text style={[styles.handle, { color: colors.textMuted }]}>@{username}</Text> : null}
          {contextLabel ? <Text style={[styles.context, { color: colors.textSecondary }]} numberOfLines={1}>{contextLabel}</Text> : null}
          {bio ? <Text style={[styles.bio, { color: colors.text }]}>{bio}</Text> : null}

          {badges.length > 1 ? (
            <View style={styles.badges}>
              {badges.slice(1).map((badge) => (
                <FullIdentityBadge key={badge.id || badge.code || badge.label} badge={badge} compact />
              ))}
            </View>
          ) : null}

          {followers != null || following != null ? (
            <View style={styles.stats}>
              {stat(following, 'Following', onFollowing)}
              {stat(followers, 'Followers', onFollowers)}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  banner: {
    width: '100%',
    aspectRatio: 3 / 1,
    overflow: 'hidden',
  },
  bannerImage: { width: '100%', height: '100%' },
  bannerFallback: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-start', padding: spacing.md },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  avatarActionRow: {
    minHeight: 58,
    marginTop: -42,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  avatarShell: {
    borderWidth: 4,
    borderRadius: 999,
    padding: 2,
  },
  actions: {
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  identity: { marginTop: spacing.sm },
  nameLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  name: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.5, flexShrink: 1 },
  handle: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  context: { fontSize: 11, lineHeight: 15, marginTop: 4, fontWeight: '700' },
  bio: { fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: 4, minHeight: 28 },
  statNumber: { fontSize: 14, fontWeight: '900' },
  statLabel: { fontSize: 12.5, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
