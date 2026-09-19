import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, ScreenHeader } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

const platformAdminUrl = process.env.EXPO_PUBLIC_PLATFORM_ADMIN_URL?.trim() || 'https://cot-admin.vercel.app';

export default function PlatformAdministrationHandoff() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [error, setError] = useState('');

  const openAdministration = async () => {
    setError('');
    try {
      await Linking.openURL(platformAdminUrl);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to open Platform Administration.');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]}>
        <ScreenHeader title="Platform Administration" kicker="SEPARATE WEB WORKSPACE" subtitle="Platform operations are not available inside the COT app." showBack />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="open-outline" size={25} color={colors.interactive} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Continue on the administration website</Text>
          <Text style={[styles.copy, { color: colors.textSecondary }]}>Platform administrator invitations, account governance, services and security are handled only in the dedicated web app. Church and Expression ministry work remains here.</Text>
          {error ? <Text style={[styles.error, { color: colors.live }]}>{error}</Text> : null}
          <Button label="Open administration website" icon="open-outline" size="lg" fullWidth onPress={() => void openAdministration()} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.lg },
  card: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  icon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '900', textAlign: 'center' },
  copy: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  error: { fontSize: 12, lineHeight: 18, textAlign: 'center', fontWeight: '700' },
});
