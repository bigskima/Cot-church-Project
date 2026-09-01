import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import type { Leader } from '@/types/content';
import type { LeadershipProfile } from '@church/types';
import { radius, spacing, shadows } from '@/design-system/tokens';
import { Avatar } from '../primitives/Avatar';

export interface LeaderCardProps {
  leader: Leader | LeadershipProfile | { id: string; name?: string; display_name?: string; role_title?: string; title?: string; biography?: string; bio?: string; short_bio?: string; full_bio?: string; avatar_url?: string | null; portrait_url?: string | null; is_founder?: boolean };
  variant?: 'standard' | 'compact' | 'founder';
  style?: StyleProp<ViewStyle>;
  dark?: boolean; // backwards compatibility
}

export function LeaderCard({
  leader,
  variant = 'standard',
  style,
}: LeaderCardProps) {
  const { colors } = useTheme();

  const name = ('display_name' in leader && leader.display_name ? leader.display_name : ('name' in leader ? leader.name : 'Leader')) || 'Leader';
  const role = ('role_title' in leader && leader.role_title ? leader.role_title : ('title' in leader ? leader.title : 'Minister')) || 'Minister';
  const bio = ('short_bio' in leader && leader.short_bio ? leader.short_bio : ('biography' in leader ? leader.biography : ('bio' in leader ? leader.bio : ''))) || '';
  const avatarUrl = ('portrait_url' in leader && leader.portrait_url ? leader.portrait_url : ('avatar_url' in leader ? leader.avatar_url : null));

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        shadows.sm,
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <Avatar url={avatarUrl} name={name} size="lg" />
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
          <Text style={[styles.role, { color: colors.interactive }]}>{role}</Text>
        </View>
      </View>
      {variant !== 'compact' && bio ? (
        <Text style={[styles.bio, { color: colors.textSecondary }]}>{bio}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  role: {
    fontSize: 13,
    fontWeight: '600',
  },
  bio: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
});
