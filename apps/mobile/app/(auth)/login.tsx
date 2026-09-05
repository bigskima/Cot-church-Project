import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { BrandMark } from '@/components/primitives/BrandMark';
import { Icon } from '@/components/primitives/Icon';
import { Button } from '@/components/Button';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

function safeReturnTo(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('://') || value.startsWith('/(auth)')) {
    return '/(tabs)/home';
  }
  return value;
}

function loginErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return 'We couldn’t sign you in. Please try again.';
  }

  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'The email, phone number, or password you entered is incorrect.';
    case 'RATE_LIMITED':
      return 'Too many sign-in attempts. Please wait a little and try again.';
    case 'REQUEST_TIMEOUT':
    case 'NETWORK_ERROR':
      return 'We couldn’t reach the server. Check your connection and try again.';
    case 'API_NOT_CONFIGURED':
      return 'Sign in is temporarily unavailable on this app build.';
    case 'ORIGIN_NOT_ALLOWED':
    case 'REQUEST_FAILED':
    case 'INVALID_RESPONSE':
      return 'Sign in is temporarily unavailable. Please try again shortly.';
    default:
      return error.status >= 500
        ? 'Sign in is temporarily unavailable. Please try again shortly.'
        : error.message || 'We couldn’t sign you in. Please try again.';
  }
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { returnTo: requestedReturnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeReturnTo(requestedReturnTo);
  const { login, enterAsVisitor } = useSession();
  const { colors } = useTheme();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (loading || guestLoading) return;
    setErrorMsg('');
    if (!identifier.trim()) {
      setErrorMsg('Please enter your email or phone number.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await login(identifier.trim(), password);
      router.replace(returnTo as any);
    } catch (error) {
      setErrorMsg(loginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGuestEntry = async () => {
    if (loading || guestLoading) return;
    setErrorMsg('');
    setGuestLoading(true);
    try {
      await enterAsVisitor();
      router.replace('/(tabs)/home');
    } catch {
      setErrorMsg('We couldn’t open guest access. Please try again.');
    } finally {
      setGuestLoading(false);
    }
  };

  const identifierKeyboard = identifier.trim().startsWith('+') ? 'phone-pad' : 'email-address';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.bg }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandMarkContainer}>
          <BrandMark variant="auth" size={72} />
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in to interact, join your Expression, manage your account, and use member-only church features.
          </Text>
        </View>

        <View style={[styles.authCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
        {errorMsg ? (
          <View
            style={[styles.errorBanner, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
            accessibilityRole="alert"
          >
            <Icon name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={[styles.errorText, { color: '#EF4444' }]}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>EMAIL OR PHONE NUMBER</Text>
            <TextInput
              value={identifier}
              onChangeText={(value) => {
                setIdentifier(value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="name@example.com or +country code"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={identifierKeyboard}
              editable={!loading && !guestLoading}
              returnKeyType="next"
              style={[
                styles.input,
                {
                  backgroundColor: colors.bgSecondary,
                  borderColor: colors.borderSubtle,
                  color: colors.text,
                },
              ]}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>PASSWORD</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Enter your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                editable={!loading && !guestLoading}
                returnKeyType="done"
                onSubmitEditing={() => void handleLogin()}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.bgSecondary,
                    borderColor: colors.borderSubtle,
                    color: colors.text,
                    paddingRight: 44,
                  },
                ]}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            hitSlop={8}
            style={styles.forgotPassword}
            accessibilityRole="button"
          >
            <Text style={[styles.forgotPasswordText, { color: colors.interactive }]}>Forgot password?</Text>
          </Pressable>

          <Button
            label="Sign in"
            onPress={handleLogin}
            loading={loading}
            disabled={guestLoading}
            variant="primary"
            size="lg"
            style={{ marginTop: spacing.sm }}
          />

          <Button
            label="Explore public COT"
            onPress={handleGuestEntry}
            loading={guestLoading}
            disabled={loading}
            variant="outline"
            size="lg"
          />
        </View>

        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>Don't have an account? </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/(auth)/signup', params: { returnTo } } as any)}
          >
            <Text style={[styles.footerLink, { color: colors.interactive }]}>Sign up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  brandMarkContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  authCard: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.display,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodySmall,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  form: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  input: {
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  passwordContainer: {
    position: 'relative',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  forgotPassword: { alignSelf: 'flex-end', paddingVertical: spacing.xs },
  forgotPasswordText: { fontSize: 12, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xxl,
  },
  footerText: {
    ...typography.bodySmall,
  },
  footerLink: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
});
