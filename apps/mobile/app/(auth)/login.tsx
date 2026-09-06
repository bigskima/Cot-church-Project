import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { InputField } from '@/components/Input';
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
  const { returnTo: requestedReturnTo, registered } = useLocalSearchParams<{ returnTo?: string; registered?: string }>();
  const returnTo = safeReturnTo(requestedReturnTo);
  const registrationComplete = registered === '1';
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
          <View style={[styles.authEyebrow, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.authEyebrowText, { color: colors.interactive }]}>COT ACCOUNT</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in for member interactions and Expression access, or continue directly into the public COT experience.
          </Text>
        </View>

        <Pressable
          onPress={() => void handleGuestEntry()}
          disabled={loading || guestLoading}
          style={({ pressed }) => [
            styles.publicAccessCard,
            { backgroundColor: colors.card, borderColor: colors.borderSubtle },
            shadows.sm,
            pressed && styles.publicAccessPressed,
            (loading || guestLoading) && styles.publicAccessDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Explore public City of Transformation"
        >
          <View style={[styles.publicAccessIcon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="globe-outline" size={21} color={colors.interactive} />
          </View>
          <View style={styles.publicAccessCopy}>
            <Text style={[styles.publicAccessTitle, { color: colors.text }]}>
              {guestLoading ? 'Opening public COT…' : 'Explore public COT'}
            </Text>
            <Text style={[styles.publicAccessText, { color: colors.textMuted }]}>
              Browse public media, church information and community content without signing in.
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <View style={styles.signInDivider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.borderSubtle }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>MEMBER SIGN IN</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.borderSubtle }]} />
        </View>

        <View style={[styles.authCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
        {registrationComplete && !errorMsg ? (
          <View style={[styles.successBanner, { backgroundColor: colors.successSoft }]}>
            <Icon name="checkmark-circle" size={18} color={colors.success} style={{ marginRight: 8 }} />
            <Text style={[styles.successText, { color: colors.success }]}>Your account is ready. Sign in to continue.</Text>
          </View>
        ) : null}
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
          <InputField
            label="Email or phone number"
            value={identifier}
            onChangeText={(value) => {
              setIdentifier(value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="name@example.com or +country code"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={identifierKeyboard}
            editable={!loading && !guestLoading}
            returnKeyType="next"
            containerStyle={styles.sharedField}
            leftIcon={<Icon name="person-outline" size={18} color={colors.textMuted} />}
          />

          <InputField
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            editable={!loading && !guestLoading}
            returnKeyType="done"
            onSubmitEditing={() => void handleLogin()}
            containerStyle={styles.sharedField}
            leftIcon={<Icon name="lock-closed-outline" size={18} color={colors.textMuted} />}
            rightIcon={(
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color={colors.textMuted}
                />
              </Pressable>
            )}
          />

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
            fullWidth
            style={{ marginTop: spacing.xs }}
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
  authEyebrow: {
    minHeight: 25,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  authEyebrowText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  authCard: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.lg,
  },
  publicAccessCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  publicAccessPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  publicAccessDisabled: {
    opacity: 0.55,
  },
  publicAccessIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publicAccessCopy: {
    flex: 1,
    minWidth: 0,
  },
  publicAccessTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.15,
  },
  publicAccessText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  signInDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  dividerLine: {
    height: StyleSheet.hairlineWidth,
    flex: 1,
  },
  dividerText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
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
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  form: {
    gap: spacing.sm,
  },
  sharedField: {
    marginBottom: spacing.sm,
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
