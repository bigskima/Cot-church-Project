import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Icon } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export type MinistryImageUseCase =
  | 'event_banner'
  | 'announcement_banner'
  | 'home_banner'
  | 'form_banner'
  | 'sermon_artwork'
  | 'library_cover';

type GeneratedImage = {
  publicUrl: string;
  storagePath: string;
  providerCode?: string;
  model?: string;
};

export function MinistryImageGenerator({
  organizationId,
  useCase,
  title,
  description,
  currentImageUrl,
  onGenerated,
  branchId,
  compact = false,
}: {
  organizationId: string;
  useCase: MinistryImageUseCase;
  title: string;
  description?: string;
  currentImageUrl?: string | null;
  onGenerated: (url: string) => void;
  branchId?: string | null;
  compact?: boolean;
}) {
  const { api } = useSession();
  const { colors } = useTheme();
  const [direction, setDirection] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!organizationId || !title.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.request<GeneratedImage>('noop?service=engagement-hub', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({
          action: 'ministry_image_generate',
          organizationId,
          branchId: branchId || null,
          useCase,
          title: title.trim(),
          description: String(description || '').trim(),
          direction: direction.trim(),
        }),
      });
      onGenerated(result.publicUrl);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to generate artwork right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, compact && styles.compact, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Icon name="sparkles-outline" size={18} color={colors.interactive} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text }]}>AI artwork</Text>
          <Text style={[styles.help, { color: colors.textMuted }]}>
            {currentImageUrl ? 'Generate a different visual.' : 'Generate a visual from this content.'}
          </Text>
        </View>
        <Button
          label={currentImageUrl ? 'Regenerate' : 'Generate'}
          size="sm"
          variant="outline"
          loading={busy}
          disabled={!title.trim()}
          onPress={() => void generate()}
          icon={<Icon name="sparkles-outline" size={15} color={colors.interactive} />}
        />
      </View>
      <TextInput
        value={direction}
        onChangeText={setDirection}
        placeholder="Optional visual direction"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
        maxLength={1200}
      />
      {error ? <Text style={[styles.error, { color: colors.live }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: 8 },
  compact: { padding: 9 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 11.5, fontWeight: '900' },
  help: { fontSize: 9.5, lineHeight: 13, marginTop: 1 },
  input: { minHeight: 40, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 10, fontSize: 11.5 },
  error: { fontSize: 9.5, lineHeight: 14, fontWeight: '700' },
});
