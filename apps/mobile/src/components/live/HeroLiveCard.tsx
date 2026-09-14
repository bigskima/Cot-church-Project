import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { LiveStream } from '@/types/content';
import { radius, spacing, shadows } from '@/design-system/tokens';
import { Badge } from '../Badge';
import { Icon } from '../primitives/Icon';

export interface HeroLiveCardProps {
  stream: LiveStream;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

function heroPresentation(status: LiveStream['status']) {
  switch (status) {
    case 'live': return { label: 'LIVE NOW', variant: 'live' as const, icon: 'play' as const, cta: 'Watch live', pulse: true };
    case 'scheduled': return { label: 'UPCOMING', variant: 'primary' as const, icon: 'calendar-outline' as const, cta: 'View schedule', pulse: false };
    case 'provisioning': return { label: 'PREPARING', variant: 'warning' as const, icon: 'cloud-upload-outline' as const, cta: 'View details', pulse: false };
    case 'ready': return { label: 'READY', variant: 'active' as const, icon: 'radio-outline' as const, cta: 'View details', pulse: false };
    case 'processing': return { label: 'REPLAY PROCESSING', variant: 'warning' as const, icon: 'hourglass-outline' as const, cta: 'View status', pulse: false };
    case 'replay_ready': return { label: 'REPLAY READY', variant: 'primary' as const, icon: 'play-circle-outline' as const, cta: 'Watch replay', pulse: false };
    case 'ended': return { label: 'ENDED', variant: 'neutral' as const, icon: 'time-outline' as const, cta: 'View details', pulse: false };
    case 'failed': return { label: 'UNAVAILABLE', variant: 'neutral' as const, icon: 'alert-circle-outline' as const, cta: 'View status', pulse: false };
    default: return { label: status.replace(/_/g, ' ').toUpperCase(), variant: 'neutral' as const, icon: 'radio-outline' as const, cta: 'View details', pulse: false };
  }
}

export function HeroLiveCard({ stream, onPress, style }: HeroLiveCardProps) {
  const isLive = stream.status === 'live';
  const presentation = heroPresentation(stream.status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, isLive ? shadows.live : shadows.sm, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={`Live stream: ${stream.title}`}
    >
      <ImageBackground source={stream.thumbnail_url ? { uri: stream.thumbnail_url } : undefined} style={styles.background} imageStyle={styles.image}>
        <LinearGradient colors={isLive ? ['rgba(3,7,14,0.04)', 'rgba(3,7,14,0.40)', 'rgba(3,7,14,0.94)'] : ['rgba(3,7,14,0.08)', 'rgba(3,7,14,0.46)', 'rgba(3,7,14,0.94)']} locations={[0, 0.5, 1]} style={styles.gradient}>
          <View style={styles.topRow}>
            <Badge label={presentation.label} variant={presentation.variant} pulse={presentation.pulse} size="md" />
            {stream.visibility ? <View style={styles.visibilityBadge}><Icon name={stream.visibility === 'public' ? 'globe-outline' : 'lock-closed-outline'} size={11} color="#FFFFFF" /><Text style={styles.visibilityText}>{stream.visibility === 'public' ? 'Public' : 'Expression'}</Text></View> : null}
          </View>

          <View style={styles.bottomContent}>
            <Text style={styles.kicker}>{isLive ? 'HAPPENING NOW' : 'COT LIVE'}</Text>
            <Text numberOfLines={2} style={styles.title}>{stream.title}</Text>
            {stream.description ? <Text numberOfLines={2} style={styles.description}>{stream.description}</Text> : null}
            <View style={styles.ctaRow}>
              <View style={[styles.ctaButton, { backgroundColor: isLive ? '#F04452' : '#FFFFFF' }]}>
                <Icon name={presentation.icon} size={15} color={isLive ? '#FFFFFF' : '#07111F'} />
                <Text style={[styles.ctaText, { color: isLive ? '#FFFFFF' : '#07111F' }]}>{presentation.cta}</Text>
                <Icon name="arrow-forward" size={14} color={isLive ? '#FFFFFF' : '#07111F'} />
              </View>
              {stream.viewer_count !== undefined && isLive ? <View style={styles.viewerBadge}><View style={styles.liveDot} /><Text style={styles.viewerText}>{stream.viewer_count} watching</Text></View> : null}
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.xxl, overflow: 'hidden', backgroundColor: '#050B14', minHeight: 230 },
  background: { minHeight: 230, justifyContent: 'flex-end', backgroundColor: '#050B14' },
  image: { borderRadius: radius.xxl },
  gradient: { minHeight: 230, padding: spacing.lg, justifyContent: 'space-between', borderRadius: radius.xxl },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  visibilityBadge: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(5,11,20,0.52)', paddingHorizontal: 9, borderRadius: radius.pill },
  visibilityText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' },
  bottomContent: { gap: 5, marginTop: spacing.xl, maxWidth: 720 },
  kicker: { color: 'rgba(255,255,255,0.72)', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.15 },
  title: { color: '#FFFFFF', fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.65 },
  description: { color: 'rgba(255,255,255,0.76)', fontSize: 12, lineHeight: 18, maxWidth: 620 },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
  ctaButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radius.pill },
  ctaText: { fontSize: 11.5, fontWeight: '900' },
  viewerBadge: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(5,11,20,0.5)', paddingHorizontal: 10, borderRadius: radius.pill },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F04452' },
  viewerText: { color: 'rgba(255,255,255,0.82)', fontSize: 10.5, fontWeight: '700' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.992 }] },
});
