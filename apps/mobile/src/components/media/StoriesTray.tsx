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

export interface StoryItem {
  id: string;
  title: string;
  imageUrl?: string;
  isLive?: boolean;
  hasUnseen?: boolean;
  onPress: () => void;
}

export interface StoriesTrayProps {
  stories: StoryItem[];
  style?: StyleProp<ViewStyle>;
}

export function StoriesTray({ stories, style }: StoriesTrayProps) {
  const { colors } = useTheme();

  if (!stories || stories.length === 0) return null;

  return (
    <View style={[styles.container, { borderBottomColor: colors.borderSubtle }, style]}>
      <FlatList
        horizontal
        data={stories}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={item.onPress}
            style={({ pressed }) => [styles.storyItem, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Story: ${item.title}`}
          >
            <View style={styles.avatarWrap}>
              {item.isLive ? (
                <LinearGradient
                  colors={['#EF4444', '#EC4899', '#8B5CF6']}
                  style={styles.gradientRing}
                >
                  <View style={[styles.innerCircle, { backgroundColor: colors.bg }]}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.avatarImg} />
                    ) : (
                      <Icon name="radio" size={24} color="#EF4444" />
                    )}
                  </View>
                </LinearGradient>
              ) : item.hasUnseen ? (
                <LinearGradient
                  colors={['#1D9BF0', '#3B82F6', '#8B5CF6']}
                  style={styles.gradientRing}
                >
                  <View style={[styles.innerCircle, { backgroundColor: colors.bg }]}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.avatarImg} />
                    ) : (
                      <Icon name="play-circle" size={24} color={colors.interactive} />
                    )}
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.standardRing, { borderColor: colors.border }]}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.avatarImg} />
                  ) : (
                    <Icon name="play" size={20} color={colors.textMuted} />
                  )}
                </View>
              )}

              {item.isLive && (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>

            <Text
              numberOfLines={1}
              style={[
                styles.storyTitle,
                { color: item.isLive ? '#EF4444' : colors.text },
              ]}
            >
              {item.title}
            </Text>
          </Pressable>
        )}
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
  storyItem: {
    alignItems: 'center',
    width: 68,
    gap: 4,
  },
  avatarWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standardRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  innerCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  liveBadge: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.xs,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  storyTitle: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
