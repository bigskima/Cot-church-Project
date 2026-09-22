import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  | 'library_cover'
  | 'expression_banner';

export type MinistryImageStyle = 'auto' | 'photographic' | 'illustrated' | 'minimal' | 'cinematic';
export type MinistryImageMood = 'auto' | 'warm' | 'reflective' | 'energetic' | 'elegant';

export type MinistryImageContext = {
  subtitle?: string;
  date?: string;
  eventType?: string;
  location?: string;
  scripture?: string;
  excerpt?: string;
  theme?: string;
  purpose?: string;
  category?: string;
  speaker?: string;
  author?: string;
};

type GeneratedImage = {
  publicUrl: string;
  storagePath: string;
  providerCode?: string;
  model?: string;
};

const STYLE_OPTIONS: Array<{ value: MinistryImageStyle; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'photographic', label: 'Photographic' },
  { value: 'illustrated', label: 'Illustrated' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'cinematic', label: 'Cinematic' },
];

const MOOD_OPTIONS: Array<{ value: MinistryImageMood; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'warm', label: 'Warm' },
  { value: 'reflective', label: 'Reflective' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'elegant', label: 'Elegant' },
];

const STYLE_CYCLE: MinistryImageStyle[] = ['photographic', 'illustrated', 'minimal', 'cinematic'];

export function MinistryImageGenerator({
  organizationId,
  useCase,
  title,
  description,
  context,
  currentImageUrl,
  onGenerated,
  onUploadInstead,
  branchId,
  compact = false,
}: {
  organizationId: string;
  useCase: MinistryImageUseCase;
  title: string;
  description?: string;
  context?: MinistryImageContext;
  currentImageUrl?: string | null;
  onGenerated: (url: string) => void;
  onUploadInstead?: () => void;
  branchId?: string | null;
  compact?: boolean;
}) {
  const { api } = useSession();
  const { colors } = useTheme();
  const [style, setStyle] = useState<MinistryImageStyle>('auto');
  const [mood, setMood] = useState<MinistryImageMood>('auto');
  const [direction, setDirection] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [candidate, setCandidate] = useState<GeneratedImage | null>(null);
  const [applied, setApplied] = useState(false);

  const aspectRatio = useMemo(() => {
    if (useCase === 'library_cover') return 2 / 3;
    if (useCase === 'home_banner' || useCase === 'form_banner') return 16 / 7;
    return 16 / 9;
  }, [useCase]);

  const generate = async (styleOverride: MinistryImageStyle = style, moodOverride: MinistryImageMood = mood) => {
    if (!organizationId || !title.trim() || busy) return;
    setBusy(true);
    setError('');
    setApplied(false);
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
          context: context || {},
          style: styleOverride,
          mood: moodOverride,
          direction: direction.trim(),
        }),
      });
      setCandidate(result);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to generate artwork right now.');
    } finally {
      setBusy(false);
    }
  };

  const tryDifferentStyle = async () => {
    const currentIndex = STYLE_CYCLE.indexOf(style);
    const nextStyle = STYLE_CYCLE[(currentIndex + 1 + STYLE_CYCLE.length) % STYLE_CYCLE.length] ?? 'cinematic';
    setStyle(nextStyle);
    await generate(nextStyle, mood);
  };

  const useCandidate = () => {
    if (!candidate?.publicUrl) return;
    onGenerated(candidate.publicUrl);
    setApplied(true);
  };

  const uploadInstead = () => {
    setCandidate(null);
    setApplied(false);
    setError('');
    onUploadInstead?.();
  };

  return (
    <View style={[styles.card, compact && styles.compact, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Icon name="sparkles-outline" size={18} color={colors.interactive} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text }]}>Generate artwork</Text>
          <Text style={[styles.help, { color: colors.textMuted }]}>
            COT builds the artwork direction automatically from this content. No prompt writing is required.
          </Text>
        </View>
        <Button
          label={candidate ? 'Generate another' : 'Generate'}
          size="sm"
          variant="outline"
          loading={busy}
          disabled={!title.trim()}
          onPress={() => void generate()}
          icon={<Icon name="sparkles-outline" size={15} color={colors.interactive} />}
        />
      </View>

      <View style={styles.controlBlock}>
        <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>STYLE</Text>
        <View style={styles.pills}>
          {STYLE_OPTIONS.map((option) => {
            const selected = style === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setStyle(option.value)}
                style={[styles.pill, { borderColor: selected ? colors.interactive : colors.borderSubtle, backgroundColor: selected ? colors.primarySoft : colors.card }]}
              >
                <Text style={[styles.pillText, { color: selected ? colors.interactive : colors.textSecondary }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.controlBlock}>
        <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>MOOD</Text>
        <View style={styles.pills}>
          {MOOD_OPTIONS.map((option) => {
            const selected = mood === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setMood(option.value)}
                style={[styles.pill, { borderColor: selected ? colors.interactive : colors.borderSubtle, backgroundColor: selected ? colors.primarySoft : colors.card }]}
              >
                <Text style={[styles.pillText, { color: selected ? colors.interactive : colors.textSecondary }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable onPress={() => setAdvancedOpen((value) => !value)} style={styles.advancedToggle}>
        <View style={styles.advancedCopy}>
          <Text style={[styles.advancedTitle, { color: colors.text }]}>Advanced direction</Text>
          <Text style={[styles.advancedHint, { color: colors.textMuted }]}>Optional — only use this when you want to steer the scene.</Text>
        </View>
        <Icon name={advancedOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </Pressable>

      {advancedOpen ? (
        <TextInput
          value={direction}
          onChangeText={setDirection}
          placeholder="Example: night worship atmosphere, show more volunteers, make it more minimal"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
          multiline
          maxLength={1200}
        />
      ) : null}

      {candidate?.publicUrl ? (
        <View style={styles.resultBlock}>
          <View style={[styles.previewFrame, { aspectRatio, backgroundColor: colors.card }]}>
            <Image source={{ uri: candidate.publicUrl }} style={styles.preview} resizeMode="cover" />
            <View style={styles.previewBadge}><Text style={styles.previewBadgeText}>AI PREVIEW</Text></View>
          </View>
          <View style={styles.resultActions}>
            <Button label={applied ? 'Using this' : 'Use this'} size="sm" disabled={applied || busy} onPress={useCandidate} />
            <Button label="Generate another" size="sm" variant="outline" loading={busy} disabled={busy} onPress={() => void generate()} />
            <Button label="Try different style" size="sm" variant="outline" disabled={busy} onPress={() => void tryDifferentStyle()} />
            <Button label="Upload instead" size="sm" variant="ghost" disabled={busy} onPress={uploadInstead} />
          </View>
          <Text style={[styles.resultMeta, { color: colors.textMuted }]}>
            Background artwork only · COT keeps real titles and copy as interface text.
          </Text>
        </View>
      ) : currentImageUrl ? (
        <Text style={[styles.currentHint, { color: colors.textMuted }]}>An image is already attached. Generate only if you want an alternative.</Text>
      ) : null}

      {error ? <Text style={[styles.error, { color: colors.live }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: 10 },
  compact: { padding: 9 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 11.5, fontWeight: '900' },
  help: { fontSize: 9.5, lineHeight: 13, marginTop: 1 },
  controlBlock: { gap: 5 },
  controlLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { minHeight: 30, borderWidth: 1, borderRadius: 15, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 9.5, fontWeight: '800' },
  advancedToggle: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8 },
  advancedCopy: { flex: 1 },
  advancedTitle: { fontSize: 10.5, fontWeight: '900' },
  advancedHint: { fontSize: 8.7, lineHeight: 12, marginTop: 1 },
  input: { minHeight: 76, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 9, fontSize: 11.5, textAlignVertical: 'top' },
  resultBlock: { gap: 8 },
  previewFrame: { width: '100%', borderRadius: radius.lg, overflow: 'hidden' },
  preview: { width: '100%', height: '100%' },
  previewBadge: { position: 'absolute', left: 8, bottom: 8, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(3,10,20,.72)' },
  previewBadgeText: { color: '#fff', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.7 },
  resultActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  resultMeta: { fontSize: 8.7, lineHeight: 12 },
  currentHint: { fontSize: 8.7, lineHeight: 12 },
  error: { fontSize: 9.5, lineHeight: 14, fontWeight: '700' },
});
