import React, { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';
import { downloadFile } from '@/utils/download-file';
import { Icon } from '../primitives/Icon';
import { AdaptiveMediaImage } from './AdaptiveMediaImage';
import { AudioPlayer } from './AudioPlayer';
import { VideoPlayer } from './VideoPlayer';

export type PreviewableMedia = {
  url: string;
  type: 'image' | 'video' | 'audio' | 'document';
  title?: string | null;
  mimeType?: string | null;
  posterUrl?: string | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  aspectRatio?: number | null;
};

export interface MediaPreviewModalProps {
  media: PreviewableMedia | null;
  visible: boolean;
  onClose: () => void;
}

function mediaRatio(media: PreviewableMedia) {
  if (typeof media.aspectRatio === 'number' && Number.isFinite(media.aspectRatio) && media.aspectRatio > 0) return media.aspectRatio;
  if (
    typeof media.width === 'number' &&
    typeof media.height === 'number' &&
    media.width > 0 &&
    media.height > 0
  ) return media.width / media.height;
  return undefined;
}

/**
 * Context-free media preview. The preview chrome stays intentionally quiet:
 * type + actions only. Geometry comes from the uploaded file rather than a
 * presentation-time rectangle.
 */
export function MediaPreviewModal({ media, visible, onClose }: MediaPreviewModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  if (!media) return null;

  const openOriginal = () => void Linking.openURL(media.url);
  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadFile(media.url, media.title || undefined);
    } catch (value) {
      setDownloadError(value instanceof Error ? value.message : 'Unable to download this file.');
    } finally {
      setDownloading(false);
    }
  };

  const typeLabel = media.type === 'document' ? 'FILE' : media.type.toUpperCase();
  const ratio = mediaRatio(media);

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.typePill}>
            <Text style={styles.typeText}>{typeLabel}</Text>
          </View>
          <View style={styles.spacer} />
          <Pressable onPress={() => void download()} disabled={downloading} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Download file">
            <Icon name={downloading ? 'hourglass-outline' : 'download-outline'} size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={openOriginal} style={styles.headerButton} accessibilityRole="link" accessibilityLabel="Open original file">
            <Icon name="open-outline" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={onClose} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Close media preview">
            <Icon name="close" size={23} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.content}>
          {media.type === 'image' ? (
            <View style={styles.visual}>
              <AdaptiveMediaImage
                url={media.url}
                alt={media.title || 'Image'}
                widthHint={media.width}
                heightHint={media.height}
                aspectRatioHint={ratio}
                resizeMode="contain"
                style={styles.image}
                backgroundColor="#05070B"
              />
            </View>
          ) : media.type === 'video' ? (
            <View style={styles.visual}>
              <VideoPlayer
                title="Video"
                sourceUrl={media.url}
                posterUrl={media.posterUrl || undefined}
                durationSeconds={media.durationSeconds || undefined}
                aspectRatio={ratio}
                style={styles.player}
              />
            </View>
          ) : media.type === 'audio' ? (
            <View style={[styles.audio, { backgroundColor: colors.card }]}>
              <AudioPlayer title="Audio" sourceUrl={media.url} durationSeconds={media.durationSeconds || undefined} />
            </View>
          ) : (
            <View style={[styles.document, { backgroundColor: colors.card }]}>
              <Icon name="document-text-outline" size={48} color={colors.interactive} />
              <View style={styles.documentActions}>
                <Pressable onPress={() => void download()} disabled={downloading} style={[styles.documentAction, { backgroundColor: colors.interactive }]} accessibilityRole="button">
                  <Icon name="download-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.documentActionPrimary}>{downloading ? 'Saving…' : 'Save'}</Text>
                </Pressable>
                <Pressable onPress={openOriginal} style={[styles.documentAction, { borderColor: colors.borderSubtle }]} accessibilityRole="link">
                  <Icon name="open-outline" size={17} color={colors.interactive} />
                  <Text style={[styles.documentActionSecondary, { color: colors.text }]}>Open</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {downloadError ? <Text style={styles.error}>{downloadError}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#05070B' },
  header: { minHeight: 58, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 7 },
  spacer: { flex: 1 },
  typePill: { minHeight: 30, borderRadius: radius.pill, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  typeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xs, overflow: 'hidden' },
  visual: { width: '100%', maxWidth: 1080, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', borderRadius: radius.sm },
  player: { width: '100%' },
  audio: { width: '100%', maxWidth: 680, padding: spacing.sm, borderRadius: radius.xl },
  document: { maxWidth: 360, width: '88%', alignItems: 'center', padding: spacing.xl, borderRadius: radius.xl, gap: spacing.md },
  documentActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  documentAction: { minHeight: 42, borderRadius: radius.pill, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 7 },
  documentActionPrimary: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  documentActionSecondary: { fontSize: 12, fontWeight: '800' },
  error: { color: '#FCA5A5', textAlign: 'center', fontSize: 11, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
});
