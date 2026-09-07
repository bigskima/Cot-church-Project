import React from 'react';
import { Image, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import { AudioPlayer } from './AudioPlayer';
import { VideoPlayer } from './VideoPlayer';

export type PreviewableMedia = {
  url: string;
  type: 'image' | 'video' | 'audio' | 'document';
  title?: string | null;
  mimeType?: string | null;
  posterUrl?: string | null;
  durationSeconds?: number | null;
};

export interface MediaPreviewModalProps {
  media: PreviewableMedia | null;
  visible: boolean;
  onClose: () => void;
}

/** Context-free previewer: safe to use in public, church, or Expression screens. */
export function MediaPreviewModal({ media, visible, onClose }: MediaPreviewModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  if (!media) return null;

  const openOriginal = () => void Linking.openURL(media.url);
  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.screen, { backgroundColor: '#05070B', paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>{media.title || 'Media preview'}</Text>
            {media.mimeType ? <Text style={styles.mime}>{media.mimeType}</Text> : null}
          </View>
          <Pressable onPress={openOriginal} style={styles.headerButton} accessibilityRole="link" accessibilityLabel="Open original file">
            <Icon name="open-outline" size={21} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={onClose} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Close media preview">
            <Icon name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.content}>
          {media.type === 'image' ? (
            <Image source={{ uri: media.url }} style={styles.image} resizeMode="contain" accessibilityLabel={media.title || 'Full-size image'} />
          ) : media.type === 'video' ? (
            <View style={styles.player}>
              <VideoPlayer title={media.title || 'Video'} sourceUrl={media.url} posterUrl={media.posterUrl || undefined} durationSeconds={media.durationSeconds || undefined} />
            </View>
          ) : media.type === 'audio' ? (
            <View style={[styles.audio, { backgroundColor: colors.card }]}>
              <AudioPlayer title={media.title || 'Audio recording'} sourceUrl={media.url} durationSeconds={media.durationSeconds || undefined} />
            </View>
          ) : (
            <Pressable onPress={openOriginal} style={[styles.document, { backgroundColor: colors.card }]} accessibilityRole="link">
              <Icon name="document-text-outline" size={54} color={colors.interactive} />
              <Text style={[styles.documentTitle, { color: colors.text }]}>{media.title || 'Attached file'}</Text>
              <Text style={[styles.documentHint, { color: colors.textSecondary }]}>Tap to open this file in a compatible app.</Text>
            </Pressable>
          )}
        </View>
        {Platform.OS !== 'web' ? <Text style={styles.footer}>Use the open button to view or share the original file.</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 60, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleWrap: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  mime: { color: '#9CA3AF', fontSize: 10, marginTop: 2 },
  headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  image: { width: '100%', height: '100%' },
  player: { width: '100%', maxWidth: 960 },
  audio: { width: '100%', maxWidth: 680, padding: spacing.md, borderRadius: radius.xl },
  document: { maxWidth: 480, width: '92%', alignItems: 'center', padding: spacing.xxl, borderRadius: radius.xl, gap: spacing.sm },
  documentTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  documentHint: { fontSize: 13, textAlign: 'center' },
  footer: { color: '#9CA3AF', textAlign: 'center', fontSize: 11, padding: spacing.sm },
});
