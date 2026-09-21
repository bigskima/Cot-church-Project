import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type BibleToday = {
  reference: string;
  version_id: string;
  theme: string;
  passage: { text: string; abbreviation?: string; verses?: Array<{ verse?: number; text?: string }> };
};

type DailyQuote = {
  id?: string;
  body: string;
  sourceReference?: string | null;
  theme?: string | null;
  source: 'automatic' | 'ministry' | 'provisioned';
  status?: 'published' | 'hidden';
  isOverride?: boolean;
};

type HomeBanner = {
  id: string;
  title: string;
  subtitle?: string | null;
  image_url?: string | null;
  destination_type: 'none' | 'route' | 'external' | 'event' | 'announcement' | 'form';
  destination_value?: string | null;
};

type SpotlightItem = {
  key: string;
  kind: 'banner' | 'quote' | 'scripture' | 'devotional';
  eyebrow: string;
  title: string;
  body: string;
  meta?: string;
  imageUrl?: string | null;
  banner?: HomeBanner;
  onPress: () => void;
};

export function GeneralHomeSpotlightCarousel() {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { api, context } = useSession();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const cardWidth = Math.min(Math.max(width - spacing.md * 2, 300), 900);

  const bible = useResource<BibleToday | null>(
    'home:spotlight:bible:' + organizationId,
    (signal) => organizationId
      ? api.request<BibleToday>('noop?service=bible&action=today&organizationId=' + encodeURIComponent(organizationId), { signal, context: 'public' }).catch(() => null)
      : Promise.resolve(null),
  );
  const banners = useResource<{ banners: HomeBanner[]; dailyQuote?: DailyQuote | null }>(
    'home:spotlight:banners:' + organizationId,
    (signal) => organizationId
      ? api.request<{ banners: HomeBanner[]; dailyQuote?: DailyQuote | null }>('noop?service=engagement-hub&action=home&organizationId=' + encodeURIComponent(organizationId), { signal, context: 'public' })
      : Promise.resolve({ banners: [], dailyQuote: null }),
  );

  const openBanner = (banner: HomeBanner) => {
    const value = banner.destination_value?.trim() ?? '';
    if (!value || banner.destination_type === 'none') return;
    if (banner.destination_type === 'external') { void Linking.openURL(value); return; }
    if (banner.destination_type === 'route') { router.push(value as any); return; }
    if (banner.destination_type === 'event') { router.push('/general/event/' + value as any); return; }
    if (banner.destination_type === 'announcement') { router.push('/general/announcements' as any); return; }
    if (banner.destination_type === 'form') { router.push('/general/forms/' + value as any); }
  };

  const items = useMemo<SpotlightItem[]>(() => {
    const result: SpotlightItem[] = [];
    const today = bible.data;
    const dailyQuote = banners.data?.dailyQuote ?? null;

    if (dailyQuote?.body) {
      result.push({
        key: 'quote:' + (dailyQuote.id || dailyQuote.sourceReference || 'today'),
        kind: 'quote',
        eyebrow: 'DAILY QUOTE',
        title: 'Thought for today',
        body: dailyQuote.body,
        meta: dailyQuote.sourceReference ? 'INSPIRED BY ' + dailyQuote.sourceReference : 'BIBLE-INSPIRED',
        onPress: () => dailyQuote.sourceReference
          ? router.push({ pathname: '/general/bible', params: { reference: dailyQuote.sourceReference } } as any)
          : router.push('/general/bible' as any),
      });
    }

    if (today) {
      result.push({
        key: 'scripture:' + today.reference,
        kind: 'scripture',
        eyebrow: 'DAILY BIBLE',
        title: today.reference,
        body: today.passage.text,
        meta: today.theme ? today.theme.toUpperCase() : 'SCRIPTURE',
        onPress: () => router.push({ pathname: '/general/bible', params: { reference: today.reference } } as any),
      });
    }

    result.push({
      key: 'devotional',
      kind: 'devotional',
      eyebrow: 'DAILY DEVOTIONAL',
      title: 'Read · reflect · pray',
      body: 'Open today’s devotional and continue your daily rhythm with COT.',
      meta: 'TODAY',
      onPress: () => router.push('/general/devotional' as any),
    });

    for (const banner of banners.data?.banners ?? []) {
      result.push({
        key: 'banner:' + banner.id,
        kind: 'banner',
        eyebrow: 'COT OFFICIAL',
        title: banner.title,
        body: banner.subtitle || '',
        imageUrl: banner.image_url,
        banner,
        onPress: () => openBanner(banner),
      });
    }
    return result;
  }, [banners.data?.banners, bible.data]);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % items.length;
        scrollRef.current?.scrollTo({ x: next * cardWidth, animated: true });
        return next;
      });
    }, 6500);
    return () => clearInterval(timer);
  }, [cardWidth, items.length]);

  if ((bible.loading && !bible.data) && (banners.loading && !banners.data)) {
    return <Skeleton height={190} borderRadius={radius.xl} />;
  }
  if (!items.length) return null;

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth}
        decelerationRate="fast"
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / cardWidth))}
        contentContainerStyle={styles.track}
      >
        {items.map((item) => (
          <View key={item.key} style={{ width: cardWidth }}>
            <Pressable
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                shadows.md,
                pressed && styles.pressed,
              ]}
            >
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" /> : null}
              <View style={[styles.overlay, item.imageUrl ? styles.overlayOnImage : null]}>
                <View style={styles.topRow}>
                  <View style={[styles.icon, { backgroundColor: item.imageUrl ? 'rgba(5,15,28,.72)' : colors.primarySoft }]}>
                    <Icon
                      name={item.kind === 'quote' ? 'chatbubble-ellipses-outline' : item.kind === 'scripture' ? 'book-outline' : item.kind === 'devotional' ? 'sunny-outline' : 'megaphone-outline'}
                      size={18}
                      color={item.imageUrl ? '#FFFFFF' : colors.interactive}
                    />
                  </View>
                  <Text style={[styles.eyebrow, { color: item.imageUrl ? '#9ed8ff' : colors.interactive }]}>{item.eyebrow}</Text>
                  <View style={styles.flex} />
                  {item.meta ? <Text style={[styles.meta, { color: item.imageUrl ? 'rgba(255,255,255,.78)' : colors.textMuted }]}>{item.meta}</Text> : null}
                </View>
                <View style={styles.copy}>
                  <Text numberOfLines={2} style={[styles.title, { color: item.imageUrl ? '#FFFFFF' : colors.text }]}>{item.title}</Text>
                  {item.body ? <Text numberOfLines={3} style={[styles.body, { color: item.imageUrl ? 'rgba(255,255,255,.88)' : colors.textSecondary }]}>{item.body}</Text> : null}
                </View>
                <View style={[styles.open, { backgroundColor: item.imageUrl ? 'rgba(255,255,255,.94)' : colors.bgSecondary }]}>
                  <Icon name="arrow-forward" size={18} color={colors.interactive} />
                </View>
              </View>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      {items.length > 1 ? (
        <View style={styles.dots}>
          {items.map((item, itemIndex) => (
            <Pressable
              key={item.key}
              onPress={() => {
                setIndex(itemIndex);
                scrollRef.current?.scrollTo({ x: itemIndex * cardWidth, animated: true });
              }}
              style={[styles.dot, { backgroundColor: itemIndex === index ? colors.interactive : colors.border }]}
              accessibilityLabel={'Show highlight ' + (itemIndex + 1)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  track: { alignItems: 'stretch' },
  card: { marginHorizontal: 0, minHeight: 190, aspectRatio: 2.15, borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  image: { ...StyleSheet.absoluteFill as any, width: '100%', height: '100%' },
  overlay: { flex: 1, padding: spacing.md, justifyContent: 'space-between' },
  overlayOnImage: { backgroundColor: 'rgba(2,10,20,.42)' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  icon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1 },
  meta: { fontSize: 8.5, fontWeight: '800', maxWidth: 140 },
  copy: { maxWidth: '83%', gap: 5 },
  title: { fontSize: 21, lineHeight: 25, fontWeight: '900', letterSpacing: -0.45 },
  body: { fontSize: 11.5, lineHeight: 17, fontWeight: '600' },
  open: { position: 'absolute', right: 14, bottom: 14, width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, minHeight: 8 },
  dot: { width: 7, height: 7, borderRadius: 999 },
  flex: { flex: 1 },
  pressed: { opacity: .92, transform: [{ scale: .995 }] },
});
