import React, { useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';
import { downloadFile } from '@/utils/download-file';
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

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.screen, { backgroundColor: '#05070B', paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>{media.title || 'Media preview'}</Text>
            {media.mimeType ? <Text style={styles.mime}>{media.mimeType}</Text> : null}
          </View>
          <Pressable onPress={() => void download()} disabled={downloading} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Download file">
            <Icon name={downloading ? 'hourglass-outline' : 'download-outline'} size={21} color="#FFFFFF" />
          </Pressable>
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
            <View style={[styles.document, { backgroundColor: colors.card }]}>
              <Icon name="document-text-outline" size={54} color={colors.interactive} />
              <Text style={[styles.documentTitle, { color: colors.text }]}>{media.title || 'Attached file'}</Text>
              <Text style={[styles.documentHint, { color: colors.textSecondary }]}>Open it in a compatible app or save a local copy.</Text>
              <View style={styles.documentActions}>
                <Pressable onPress={() => void download()} disabled={downloading} style={[styles.documentAction, { backgroundColor: colors.interactive }]} accessibilityRole="button">
                  <Icon name="download-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.documentActionPrimary}>{downloading ? 'Downloading…' : 'Download'}</Text>
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
        <Text style={styles.footer}>{Platform.OS === 'web' ? 'Use Download to save the original file.' : 'Download saves the file locally and opens the system save/share options.'}</Text>
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
  documentActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  documentAction: { minHeight: 42, borderRadius: radius.pill, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 7 },
  documentActionPrimary: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  documentActionSecondary: { fontSize: 12, fontWeight: '800' },
  error: { color: '#FCA5A5', textAlign: 'center', fontSize: 11, paddingHorizontal: spacing.md, paddingBottom: 4 },
  footer: { color: '#9CA3AF', textAlign: 'center', fontSize: 11, padding: spacing.sm },
});