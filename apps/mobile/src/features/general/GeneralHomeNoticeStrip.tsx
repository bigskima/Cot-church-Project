import React from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';

export type GeneralHomeNotice = {
  id: string;
  organization_id: string;
  label: string;
  message: string;
  status: 'draft' | 'published';
  is_enabled: boolean;
  starts_at: string;
  ends_at?: string | null;
  background_color: string;
  text_color: string;
  accent_color: string;
  link_label?: string | null;
  link_path?: string | null;
  priority: number;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function estimateTextWidth(notice: GeneralHomeNotice) {
  const characters = `${notice.message}${notice.link_label ? ` ${notice.link_label}` : ''}`.length;
  return Math.max(300, characters * 7.8 + 80);
}

export function GeneralHomeNoticeStrip() {
  const { width } = useWindowDimensions();
  const { api, context } = useSession();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const [dismissedId, setDismissedId] = React.useState<string | null>(null);
  const [trackWidth, setTrackWidth] = React.useState(Math.max(240, width - spacing.xs * 2));
  const translateX = React.useRef(new Animated.Value(0)).current;
  const stripWidth = Math.max(1, Math.min(width - spacing.xs * 2, 1280));

  const resource = useResource<GeneralHomeNotice | null>(
    `general-home-notice:${organizationId || 'auto'}`,
    (signal) => api.request<GeneralHomeNotice | null>(
      `general-home-notices?${organizationId ? `organizationId=${encodeURIComponent(organizationId)}&` : ''}fresh=${Date.now()}`,
      { signal, context: 'public' },
    ),
  );

  const notice = resource.data ?? null;
  React.useEffect(() => {
    if (!notice) return;
    setDismissedId((current) => current === notice.id ? current : null);
  }, [notice?.id]);

  React.useEffect(() => {
    if (!notice || dismissedId === notice.id || trackWidth <= 0) return;
    const textWidth = estimateTextWidth(notice);
    const entryReach = Math.max(72, Math.min(trackWidth * 0.2, 220));
    const exitReach = Math.max(96, Math.min(trackWidth * 0.28, 280));
    const startX = trackWidth + entryReach;
    const endX = -(textWidth + exitReach);
    const travelDistance = startX - endX;

    translateX.stopAnimation();
    translateX.setValue(startX);
    const duration = Math.max(14_000, travelDistance * 22);
    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: endX,
        duration,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [dismissedId, notice?.id, notice?.message, notice?.link_label, trackWidth, translateX]);

  if (!notice || dismissedId === notice.id) return null;
  const endsAt = notice.ends_at ? Date.parse(notice.ends_at) : null;
  if (endsAt && Number.isFinite(endsAt) && endsAt <= Date.now()) return null;

  const openTarget = () => {
    if (!notice.link_path) return;
    router.push(notice.link_path as any);
  };

  return (
    <View
      style={[
        styles.shell,
        { width: stripWidth, backgroundColor: notice.background_color, borderColor: `${notice.accent_color}55` },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${notice.label}. ${notice.message}`}
    >
      <View style={styles.leading}>
        <View style={[styles.pulse, { backgroundColor: notice.accent_color }]} />
        <Text style={[styles.label, { color: notice.accent_color }]} numberOfLines={1}>{notice.label}</Text>
        <Text style={[styles.dot, { color: notice.accent_color }]}>•</Text>
      </View>

      <View
        style={styles.track}
        onLayout={(event) => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
      >
        <Animated.View style={[styles.moving, { transform: [{ translateX }] }]}>
          <Pressable
            disabled={!notice.link_path}
            onPress={openTarget}
            style={({ pressed }) => [styles.messagePressable, pressed && notice.link_path ? styles.pressed : null]}
            accessibilityRole={notice.link_path ? 'link' : 'text'}
          >
            <Text style={[styles.message, { color: notice.text_color }]} numberOfLines={1}>
              {notice.message}
              {notice.link_label ? `   ${notice.link_label} →` : ''}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      <Pressable
        onPress={() => setDismissedId(notice.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Hide this update"
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Icon name="close" size={16} color={notice.text_color} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    maxWidth: 1280,
    alignSelf: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  leading: {
    minHeight: 44,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 2,
  },
  pulse: { width: 7, height: 7, borderRadius: 99 },
  label: { fontSize: 9.5, lineHeight: 12, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase', maxWidth: 130 },
  dot: { fontSize: 12, fontWeight: '900' },
  track: { flex: 1, minWidth: 0, height: 44, justifyContent: 'center', overflow: 'hidden' },
  moving: { position: 'absolute', left: 0, flexDirection: 'row', alignItems: 'center' },
  messagePressable: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  message: { fontSize: 11.5, lineHeight: 16, fontWeight: '800', letterSpacing: 0.1 },
  close: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  pressed: { opacity: 0.65 },
});
