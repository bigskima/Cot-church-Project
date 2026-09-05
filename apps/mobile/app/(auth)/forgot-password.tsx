import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, Button, Icon, InputField } from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { api } = useSession();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const sendRecovery = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Enter the email address used for your COT account.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.request('password-recovery', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setSubmitted(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to start password recovery. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <BrandMark variant="auth" size={64} style={styles.logo} />

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          {submitted ? (
            <View style={styles.successWrap}>
              <View style={[styles.iconWrap, { backgroundColor: colors.successSoft }]}>
                <Icon name="mail-open-outline" size={28} color={colors.success} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Check your email</Text>
              <Text style={[styles.copy, { color: colors.textSecondary }]}>
                If an account exists for that address, a secure password-reset message has been sent. Follow the link in that email to continue.
              </Text>
              <Button label="Back to sign in" onPress={() => router.replace('/(auth)/login')} size="lg" fullWidth />
              <Pressable onPress={() => { setSubmitted(false); setEmail(''); }} hitSlop={8}>
                <Text style={[styles.link, { color: colors.interactive }]}>Use a different email</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.heading}>
                <Text style={[styles.title, { color: colors.text }]}>Reset your password</Text>
                <Text style={[styles.copy, { color: colors.textSecondary }]}>
                  Enter your account email. We’ll send the secure recovery instructions configured for COT.
                </Text>
              </View>

              {error ? (
                <View style={[styles.errorBanner, { backgroundColor: colors.liveSoft }]}>
                  <Icon name="alert-circle-outline" size={17} color={colors.live} />
                  <Text style={[styles.errorText, { color: colors.live }]}>{error}</Text>
                </View>
              ) : null}

              <InputField
                label="Email address"
                value={email}
                onChangeText={(value) => { setEmail(value); if (error) setError(''); }}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="name@example.com"
              />

              <Button label="Send recovery email" onPress={() => void sendRecovery()} loading={submitting} size="lg" fullWidth />
              <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backLink}>
                <Icon name="arrow-back-outline" size={15} color={colors.interactive} />
                <Text style={[styles.link, { color: colors.interactive }]}>Back to sign in</Text>
              </Pressable>
            </>
          )}
        </View>

        <Pressable onPress={() => router.replace('/(tabs)/home')} hitSlop={8} style={styles.publicLink}>
          <Text style={[styles.publicLinkText, { color: colors.textSecondary }]}>Continue exploring public COT</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 460, alignSelf: 'center', paddingHorizontal: spacing.lg },
  logo: { alignSelf: 'center', marginBottom: spacing.lg },
  card: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.lg },
  heading: { gap: spacing.xs },
  title: { ...typography.h1, textAlign: 'center' },
  copy: { ...typography.bodySmall, lineHeight: 20, textAlign: 'center' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  backLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingVertical: spacing.xs },
  link: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  successWrap: { alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 60, height: 60, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  publicLink: { alignSelf: 'center', padding: spacing.md, marginTop: spacing.sm },
  publicLinkText: { fontSize: 12, fontWeight: '600' },
});
