import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Icon } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { putSignedUpload, type UploadFile } from '@/services/uploads';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export type DailyVisual = {
  id?: string;
  visual_date?: string;
  content_kind?: 'bible' | 'quote' | 'devotional';
  image_url?: string | null;
  storage_path?: string | null;
  image_source?: 'ai' | 'upload' | 'inherited';
  provider_code?: string | null;
  prompt?: string | null;
  status?: 'queued' | 'generating' | 'ready' | 'failed';
  last_error?: string | null;
  generated_at?: string | null;
};

export type ImageProviderReadiness = {
  code: string;
  name: string;
  configured: boolean;
  model: string;
  reason?: string;
};

type UploadIntent = {
  signedUploadUrl: string;
  storagePath: string;
  publicUrl: string;
};

type Props = {
  date: string;
  kind: 'bible' | 'quote' | 'devotional';
  organizationId: string;
  visual?: DailyVisual | null;
  provider?: ImageProviderReadiness | null;
  onChanged: () => void;
  allowBibleInheritance?: boolean;
  seriesId?: string;
};

const LABELS = {
  bible: 'Daily Bible visual',
  quote: 'Daily Quote visual',
  devotional: 'Daily Devotional visual',
} as const;

export function DailyVisualManagerCard({
  date,
  kind,
  organizationId,
  visual,
  provider,
  onChanged,
  allowBibleInheritance = false,
  seriesId,
}: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const post = async (action: string, extra: Record<string, unknown> = {}) => {
    return api.request<DailyVisual>('noop?service=engagement-hub', {
      method: 'POST',
      context: 'public',
      body: JSON.stringify({ action, organizationId, date, kind, ...(seriesId ? { seriesId } : {}), ...extra }),
    });
  };

  const generate = async () => {
    if (busy) return;
    setBusy('generate');
    setError('');
    try {
      await post('visual_generate');
      onChanged();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to generate this image.');
    } finally {
      setBusy('');
    }
  };

  const chooseUpload = async () => {
    if (busy) return;
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo-library access to choose a Daily visual.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 7],
      quality: 0.92,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const mimeType = asset.mimeType?.toLowerCase() || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      setError('Choose a JPG, PNG or WebP image.');
      return;
    }

    const file: UploadFile = {
      uri: asset.uri,
      name: asset.fileName || ('cot-' + kind + '-' + date + '.jpg'),
      mimeType,
      size: asset.fileSize,
      file: (asset as any).file,
    };

    setBusy('upload');
    try {
      const intent = await api.request<UploadIntent>('noop?service=engagement-hub', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({ action: 'visual_upload_intent', organizationId, date, kind, mimeType, ...(seriesId ? { seriesId } : {}) }),
      });
      await putSignedUpload(intent.signedUploadUrl, file);
      await post('visual_save_upload', { storagePath: intent.storagePath });
      onChanged();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to upload this image.');
    } finally {
      setBusy('');
    }
  };

  const inherit = async () => {
    if (busy) return;
    setBusy('inherit');
    setError('');
    try {
      await post('visual_inherit');
      onChanged();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to use the Daily Bible image.');
    } finally {
      setBusy('');
    }
  };

  const clear = async () => {
    if (busy) return;
    setBusy('clear');
    setError('');
    try {
      await post('visual_clear');
      onChanged();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to remove this image.');
    } finally {
      setBusy('');
    }
  };

  const ready = visual?.status === 'ready' && Boolean(visual.image_url);
  const sourceLabel = visual?.image_source === 'upload'
    ? 'Uploaded'
    : visual?.image_source === 'inherited'
      ? 'Using Daily Bible image'
      : visual?.image_source === 'ai'
        ? 'AI generated'
        : 'No image yet';

  return (
    <View style={[styles.card, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Icon name={kind === 'bible' ? 'book-outline' : kind === 'quote' ? 'chatbubble-ellipses-outline' : 'sunny-outline'} size={18} color={colors.interactive} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text }]}>{LABELS[kind]}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{sourceLabel}{visual?.provider_code ? ' · ' + visual.provider_code : ''}</Text>
        </View>
      </View>

      {ready ? (
        <View style={styles.previewFrame}>
          <Image source={{ uri: visual!.image_url! }} style={styles.preview} resizeMode="cover" />
          <View style={styles.previewTag}><Text style={styles.previewTagText}>16:7 HOME + DETAIL</Text></View>
        </View>
      ) : (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <Icon name="image-outline" size={25} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {visual?.status === 'failed' ? 'Generation failed. Upload an image or retry.' : 'Text-only fallback remains available until an image is ready.'}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <Button
          label={ready && visual?.image_source === 'ai' ? 'Regenerate' : 'Generate AI'}
          size="sm"
          variant="outline"
          loading={busy === 'generate'}
          disabled={Boolean(busy) || provider?.configured === false}
          onPress={() => void generate()}
          icon={<Icon name="sparkles-outline" size={15} color={colors.interactive} />}
        />
        <Button
          label={ready ? 'Replace upload' : 'Upload image'}
          size="sm"
          variant="outline"
          loading={busy === 'upload'}
          disabled={Boolean(busy)}
          onPress={() => void chooseUpload()}
          icon={<Icon name="image-outline" size={15} color={colors.interactive} />}
        />
        {allowBibleInheritance ? (
          <Button
            label="Use Bible visual"
            size="sm"
            variant="outline"
            loading={busy === 'inherit'}
            disabled={Boolean(busy)}
            onPress={() => void inherit()}
          />
        ) : null}
        {ready || visual?.status === 'failed' ? (
          <Button label="Remove" size="sm" variant="ghost" loading={busy === 'clear'} disabled={Boolean(busy)} onPress={() => void clear()} />
        ) : null}
      </View>

      {provider ? (
        <View style={styles.providerRow}>
          <View style={[styles.providerDot, { backgroundColor: provider.configured ? colors.success : colors.textMuted }]} />
          <Text style={[styles.providerText, { color: colors.textMuted }]}>
            {provider.configured
              ? provider.name + (provider.model ? ' · ' + provider.model : '')
              : provider.reason || 'AI image provider is not configured. Upload remains available.'}
          </Text>
        </View>
      ) : null}

      {visual?.status === 'failed' && visual.last_error ? <Text style={[styles.error, { color: colors.live }]}>{visual.last_error}</Text> : null}
      {error ? <Text style={[styles.error, { color: colors.live }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 12.5, fontWeight: '900' },
  meta: { fontSize: 9.5, marginTop: 2 },
  previewFrame: { width: '100%', aspectRatio: 16 / 7, borderRadius: radius.lg, overflow: 'hidden' },
  preview: { width: '100%', height: '100%' },
  previewTag: { position: 'absolute', left: 8, bottom: 8, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(3,10,20,.72)' },
  previewTagText: { color: '#fff', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.7 },
  empty: { minHeight: 82, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', padding: spacing.sm, gap: 5 },
  emptyText: { fontSize: 9.5, lineHeight: 14, textAlign: 'center', maxWidth: 380 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  providerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  providerDot: { width: 7, height: 7, borderRadius: 4, marginTop: 4 },
  providerText: { flex: 1, fontSize: 8.5, lineHeight: 13 },
  error: { fontSize: 9.5, lineHeight: 14, fontWeight: '700' },
});
