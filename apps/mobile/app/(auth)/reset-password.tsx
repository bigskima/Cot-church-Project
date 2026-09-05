import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, Button, Icon, InputField } from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

function tokenFromUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const queryToken = parsed.searchParams.get('access_token') || parsed.searchParams.get('token');
    if (queryToken) return queryToken;
    const hash = parsed.hash.replace(/^#/, '');
    if (!hash) return null;
    const hashParams = new URLSearchParams(hash);
    return hashParams.get('access_token') || hashParams.get('token');
  } catch {
    const hashIndex = value.indexOf('#');
    const queryIndex = value.indexOf('?');
    const raw = hashIndex >= 0 ? value.slice(hashIndex + 1) : queryIndex >= 0 ? value.slice(queryIndex + 1) : value;
    const params = new URLSearchParams(raw);
    return params.get('access_token') || params.get('token');
  }
}

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ access_token?: string; token?: string; type?: string }>();
  const { api } = useSession();
  const { colors } = useTheme();

  const [recoveryToken, setRecoveryToken] = useState<string | null>(
    typeof params.access_token === 'string' ? params.access_token :
      typeof params.token === 'string' ? params.token : null,
  );
  const [resolvingToken, setResolvingToken] = useState(!recoveryToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const capture = (url?: string | null) => {
      if (!active) return;
      const token = tokenFromUrl(url);
      if (token) {
        setRecoveryToken(token);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
      setResolvingToken(false);
    };

    if (recoveryToken) {
      setResolvingToken(false);
      return () => { active = false; };
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      capture(window.location.href);
    } else {
      void Linking.getInitialURL().then(capture).catch(() => setResolvingToken(false));
    }

    const subscription = Linking.addEventListener('url', ({ url }) => capture(url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, [recoveryToken]);

  const resetPassword = async () => {
    setError('');
    if (!recoveryToken) {
      setError('This password-reset link is missing or has expired. Request a new recovery email.');
      return;
    }
    if (!password) {
      setError('Enter your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.request('password-reset', {
        method: 'POST',
        context: 'public',
        headers: { Authorization: `Bearer ${recoveryToken}` },
        body: JSON.stringify({ password }),
      });
      setComplete(true);
      setPassword('');
      setConfirmPassword('');
      setRecoveryToken(null);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update your password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.bg }]}
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
          {complete ? (
            <View style={styles.centered}>
              <View style={[styles.iconWrap, { backgroundColor: colors.successSoft }]}>
                <Icon name="checkmark-circle-outline" size={30} color={colors.success} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Password updated</Text>
              <Text style={[styles.copy, { color: colors.textSecondary }]}>
                Your password has been changed. Sign in again using the new password.
              </Text>
              <Button label="Sign in" onPress={() => router.replace('/(auth)/login')} size="lg" fullWidth />
              <Pressable onPress={() => router.replace('/(tabs)/home')} hitSlop={8}>
                <Text style={[styles.link, { color: colors.interactive }]}>Return to public COT</Text>
              </Pressable>
            </View>
          ) : resolvingToken ? (
            <View style={styles.centered}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
                <Icon name="key-outline" size={28} color={colors.interactive} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Opening secure reset</Text>
              <Text style={[styles.copy, { color: colors.textSecondary }]}>Checking the recovery link…</Text>
            </View>
          ) : !recoveryToken ? (
            <View style={styles.centered}>
              <View style={[styles.iconWrap, { backgroundColor: colors.liveSoft }]}>
                <Icon name="alert-circle-outline" size={28} color={colors.live} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Reset link unavailable</Text>
              <Text style={[styles.copy, { color: colors.textSecondary }]}>
                This recovery link is missing, invalid or expired. Request a new password-reset email.
              </Text>
              <Button label="Request new link" onPress={() => router.replace('/(auth)/forgot-password')} size="lg" fullWidth />
              <Button label="Back to sign in" onPress={() => router.replace('/(auth)/login')} variant="outline" size="lg" fullWidth />
            </View>
          ) : (
            <>
              <View style={styles.heading}>
                <Text style={[styles.title, { color: colors.text }]}>Create a new password</Text>
                <Text style={[styles.copy, { color: colors.textSecondary }]}>
                  Choose the password you want to use for your COT account. Acceptance follows the current account security policy.
                </Text>
              </View>

              {error ? (
                <View style={[styles.errorBanner, { backgroundColor: colors.liveSoft }]}>
                  <Icon name="alert-circle-outline" size={17} color={colors.live} />
                  <Text style={[styles.errorText, { color: colors.live }]}>{error}</Text>
                </View>
              ) : null}

              <InputField
                label="New password"
                value={password}
                onChangeText={(value) => { setPassword(value); if (error) setError(''); }}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoCapitalize="none"
                placeholder="Enter new password"
              />
              <InputField
                label="Confirm password"
                value={confirmPassword}
                onChangeText={(value) => { setConfirmPassword(value); if (error) setError(''); }}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoCapitalize="none"
                placeholder="Repeat new password"
              />

              <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.showRow} hitSlop={8}>
                <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.interactive} />
                <Text style={[styles.link, { color: colors.interactive }]}>
                  {showPassword ? 'Hide passwords' : 'Show passwords'}
                </Text>
              </Pressable>

              <Button label="Update password" onPress={() => void resetPassword()} loading={submitting} size="lg" fullWidth />
            </>
          )}
        </View>
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
  centered: { alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 60, height: 60, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h1, textAlign: 'center' },
  copy: { ...typography.bodySmall, lineHeight: 20, textAlign: 'center' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  showRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.xs },
  link: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
