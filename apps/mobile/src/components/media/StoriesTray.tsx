import React from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import type { LiveStream } from '@/types/content';

export interface StoryItem {
  id: string;
  title: string;
  imageUrl?: string;
  isLive?: boolean;
  hasUnseen?: boolean;
  onPress: () => void;
}

export interface StoriesTrayProps {
  stories?: StoryItem[];
  liveStream?: LiveStream | null;
  onOpenLive?: (id: string) => void;
  onOpenStory?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function StoriesTray({
  stories: customStories,
  liveStream,
  onOpenLive,
  onOpenStory,
  style,
}: StoriesTrayProps) {
  const { colors } = useTheme();

  // Generate composite stories list
  const defaultItems: StoryItem[] = [];

  if (liveStream) {
    defaultItems.push({
      id: liveStream.id,
      title: 'LIVE NOW',
      imageUrl: liveStream.thumbnail_url,
      isLive: true,
      hasUnseen: true,
      onPress: () => onOpenLive?.(liveStream.id),
    });
  }

  const sampleHighlights = [
    { id: 'h1', title: 'Sunday Word', isLive: false, hasUnseen: true },
    { id: 'h2', title: 'Worship Highlights', isLive: false, hasUnseen: true },
    { id: 'h3', title: 'Prayer Focus', isLive: false, hasUnseen: false },
    { id: 'h4', title: 'Testimonies', isLive: false, hasUnseen: false },
  ];

  sampleHighlights.forEach((h) => {
    defaultItems.push({
      id: h.id,
      title: h.title,
      isLive: false,
      hasUnseen: h.hasUnseen,
      onPress: () => onOpenStory?.(h.id),
    });
  });

  const stories = customStories && customStories.length > 0 ? customStories : defaultItems;

  return (
    <View style={[styles.container, { borderBottomColor: colors.borderSubtle }, style]}>
      <FlatList
        horizontal
        data={stories}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          return (
            <Pressable
              onPress={item.onPress}
              style={styles.storyBubble}
              accessibilityRole="button"
              accessibilityLabel={`Story highlight: ${item.title}`}
            >
              {/* Story Gradient Ring */}
              {item.isLive ? (
                <View style={[styles.liveRing, { borderColor: colors.live }]}>
                  <View style={[styles.innerCircle, { backgroundColor: colors.card }]}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.image} />
                    ) : (
                      <Icon name="radio" size={24} color={colors.live} />
                    )}
                  </View>
                  <View style={[styles.livePill, { backgroundColor: colors.live }]}>
                    <Text style={styles.livePillText}>LIVE</Text>
                  </View>
                </View>
              ) : (
                <LinearGradient
                  colors={
                    item.hasUnseen
                      ? ['#F59E0B', '#EC4899', '#8B5CF6']
                      : [colors.border, colors.border]
                  }
                  style={styles.gradientRing}
                >
                  <View style={[styles.innerCircle, { backgroundColor: colors.card }]}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.image} />
                    ) : (
                      <Icon name="sparkles" size={22} color={colors.interactive} />
                    )}
                  </View>
                </LinearGradient>
              )}

              <Text
                style={[
                  styles.storyTitle,
                  { color: item.isLive ? colors.live : colors.text },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  storyBubble: {
    alignItems: 'center',
    width: 68,
    gap: 4,
  },
  gradientRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    padding: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  innerCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  livePill: {
    position: 'absolute',
    bottom: -4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  livePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  storyTitle: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
