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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { Icon } from '@/components';
import { radius, spacing, typography } from '@/design-system/tokens';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { api, authenticate, continueAsVisitor } = useSession();
  const { colors, isDark } = useTheme();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignIn() {
    if (!identifier.trim() || !password) {
      setError('Please enter your email, phone, or username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isEmail = identifier.includes('@');
      const isPhone = /^\+?[0-9\s\-()]{7,}$/.test(identifier.trim());

      const payload = isEmail
        ? { email: identifier.trim().toLowerCase() }
        : isPhone
        ? { phoneNumber: identifier.trim().replace(/\s+/g, '') }
        : { email: identifier.trim().toLowerCase() };

      const data = await api.request<{
        session: {
          accessToken: string;
          refreshToken: string;
          expiresAt?: number;
          tokenType: string;
        };
      }>('login', {
        method: 'POST',
        body: JSON.stringify({ ...payload, password }),
      });

      await authenticate({ session: data.session });
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleContinueAsGuest() {
    continueAsVisitor();
    router.replace('/(tabs)/home');
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Header Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.logoBadge}>
          <Icon name="business" size={26} color={colors.interactive} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          {/* Headline */}
          <Text style={[styles.headline, { color: colors.text }]}>
            Sign in to Church
          </Text>
          <Text style={[styles.subheadline, { color: colors.textSecondary }]}>
            Connect to live broadcasts, sermon teachings, giving receipts, and spiritual community.
          </Text>

          {/* Social / Fast OAuth Buttons (Twitter / Instagram style) */}
          <View style={styles.oauthContainer}>
            <Pressable
              onPress={() => setError('Google sign-in is coming soon.')}
              style={({ pressed }) => [
                styles.oauthBtn,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Icon name="logo-google" size={18} color={colors.text} style={{ marginRight: 10 }} />
              <Text style={[styles.oauthBtnText, { color: colors.text }]}>
                Continue with Google
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setError('Apple sign-in is coming soon.')}
              style={({ pressed }) => [
                styles.oauthBtn,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Icon name="logo-apple" size={18} color={colors.text} style={{ marginRight: 10 }} />
              <Text style={[styles.oauthBtnText, { color: colors.text }]}>
                Continue with Apple
              </Text>
            </Pressable>
          </View>

          {/* Minimal Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Error Banner */}
          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Icon name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Minimal Inputs */}
          <View style={styles.formGroup}>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                },
              ]}
            >
              <TextInput
                value={identifier}
                onChangeText={(val) => {
                  setIdentifier(val);
                  setError('');
                }}
                placeholder="Phone, email, or username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={[styles.inputField, { color: colors.text }]}
              />
            </View>

            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                },
              ]}
            >
              <TextInput
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  setError('');
                }}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={[styles.inputField, { color: colors.text }]}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={10}
                style={styles.eyeBtn}
              >
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
          </View>

          {/* Primary Pill Action Button */}
          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryPillBtn,
              {
                backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                opacity: pressed || loading ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.primaryPillBtnText,
                { color: isDark ? '#0F172A' : '#FFFFFF' },
              ]}
            >
              {loading ? 'Signing In...' : 'Log In'}
            </Text>
          </Pressable>

          {/* Guest / Visitor Access Button */}
          <Pressable
            onPress={handleContinueAsGuest}
            style={({ pressed }) => [
              styles.guestPillBtn,
              { borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.guestPillBtnText, { color: colors.textSecondary }]}>
              Continue as Guest
            </Text>
          </Pressable>
        </View>

        {/* Bottom Pinned Footer */}
        <View style={styles.footerRow}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Don't have an account?{' '}
          </Text>
          <Pressable onPress={() => router.push('/(auth)/signup')}>
            <Text style={[styles.footerLink, { color: colors.interactive }]}>
              Sign up
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  logoBadge: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  mainColumn: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginBottom: spacing.xs,
  },
  subheadline: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  oauthContainer: {
    gap: spacing.sm,
  },
  oauthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  oauthBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  formGroup: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    height: 52,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  eyeBtn: {
    padding: 4,
  },
  primaryPillBtn: {
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  primaryPillBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  guestPillBtn: {
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestPillBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
