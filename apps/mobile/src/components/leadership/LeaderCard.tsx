import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import type { Leader } from '@/types/content';
import type { LeadershipProfile } from '@church/types';
import { radius, spacing, shadows } from '@/design-system/tokens';
import { Avatar } from '../primitives/Avatar';
import { MediaPreviewModal } from '../media/MediaPreviewModal';

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
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.borderSubtle,
        },
        shadows.md,
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable disabled={!avatarUrl} onPress={() => setPreviewOpen(true)} accessibilityRole={avatarUrl ? 'button' : undefined} accessibilityLabel={avatarUrl ? `View full photo of ${name}` : undefined}>
          <Avatar url={avatarUrl} name={name} size="lg" />
          {avatarUrl ? <View style={[styles.previewMark, { backgroundColor: colors.card }]}><Text style={[styles.previewMarkText, { color: colors.interactive }]}>↗</Text></View> : null}
        </Pressable>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
          <Text style={[styles.role, { color: colors.interactive }]}>{role}</Text>
        </View>
      </View>
      {variant !== 'compact' && bio ? (
        <Text style={[styles.bio, { color: colors.textSecondary }]}>{bio}</Text>
      ) : null}
    </View>
    <MediaPreviewModal media={avatarUrl ? { url: avatarUrl, type: 'image', title: name } : null} visible={previewOpen} onClose={() => setPreviewOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
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
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  role: {
    fontSize: 12,
    fontWeight: '700',
  },
  bio: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  previewMark: { position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewMarkText: { fontSize: 12, fontWeight: '900' },
});
