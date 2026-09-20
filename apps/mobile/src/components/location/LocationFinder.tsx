import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '@/components/primitives/Icon';
import { radius, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export type VerifiedLocationResult = {
  id: string;
  label: string;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude: number;
  longitude: number;
  mapUrl: string;
  provider: string;
  verified: true;
};

export function LocationFinder({
  expressionId,
  initialLabel = '',
  onSelect,
  onManualFallback,
}: {
  expressionId?: string | null;
  initialLabel?: string;
  onSelect: (location: VerifiedLocationResult) => void;
  onManualFallback: () => void;
}) {
  const { api } = useSession();
  const { colors } = useTheme();
  const [query, setQuery] = useState(initialLabel);
  const [results, setResults] = useState<VerifiedLocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialLabel && !query) setQuery(initialLabel);
  }, [initialLabel]);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 3) {
      setResults([]);
      setError('');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ view: 'location-search', q: value });
        if (expressionId) params.set('expressionId', expressionId);
        const data = await api.request<VerifiedLocationResult[]>(`church-story?${params.toString()}`, {
          context: 'current',
          feedback: false,
        });
        if (!cancelled) setResults(data);
      } catch (value) {
        if (!cancelled) {
          setResults([]);
          setError(value instanceof Error ? value.message : 'Location search is unavailable right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 380);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, expressionId, query]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Find and verify location</Text>
      <View style={[styles.search, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
        <Icon name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Start typing the church or street address"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }]}
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel="Search for a verified location"
        />
        {loading ? <ActivityIndicator size="small" color={colors.interactive} /> : null}
      </View>

      {results.length ? (
        <View style={[styles.results, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          {results.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                setQuery(item.label);
                setResults([]);
                onSelect(item);
              }}
              style={({ pressed }) => [styles.result, { borderBottomColor: colors.borderSubtle }, pressed ? styles.pressed : null]}
              accessibilityRole="button"
              accessibilityLabel={`Use ${item.label}`}
            >
              <View style={[styles.pin, { backgroundColor: colors.primarySoft }]}>
                <Icon name="location-outline" size={16} color={colors.interactive} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={2}>{item.label}</Text>
                <Text style={[styles.verified, { color: colors.success }]}>Verified map location</Text>
              </View>
              <Icon name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? <Text style={[styles.error, { color: colors.live }]}>{error}</Text> : null}

      <Pressable onPress={onManualFallback} style={styles.manual} accessibilityRole="button">
        <Icon name="create-outline" size={14} color={colors.interactive} />
        <Text style={[styles.manualText, { color: colors.interactive }]}>Location not listed? Enter it manually</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  search: { minHeight: 50, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 12 },
  results: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  result: { minHeight: 60, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.8 },
  pin: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  resultTitle: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  verified: { fontSize: 9.5, lineHeight: 13, fontWeight: '800', marginTop: 2 },
  error: { fontSize: 10.5, lineHeight: 15 },
  manual: { minHeight: 34, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  manualText: { fontSize: 10.5, fontWeight: '800' },
});
