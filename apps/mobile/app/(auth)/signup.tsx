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
import { radius, spacing } from '@/design-system/tokens';

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { api } = useSession();
  const { colors, isDark } = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSignUp() {
    if (!displayName.trim() || !emailOrPhone.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isEmail = emailOrPhone.includes('@');
      const identity = isEmail
        ? { email: emailOrPhone.trim().toLowerCase() }
        : { phoneNumber: emailOrPhone.trim().replace(/\s+/g, '') };

      await api.request('signup', {
        method: 'POST',
        body: JSON.stringify({
          displayName: displayName.trim(),
          ...identity,
          password,
        }),
      });

      setSuccess(true);
      setTimeout(() => router.replace('/(auth)/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Header Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Icon name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.logoBadge}>
          <Icon name="business" size={24} color={colors.interactive} />
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          {/* Headline */}
          <Text style={[styles.headline, { color: colors.text }]}>
            Create your account
          </Text>
          <Text style={[styles.subheadline, { color: colors.textSecondary }]}>
            Join your church fellowship, sermon archives, and prayer community.
          </Text>

          {/* Error Banner */}
          {error ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Icon name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Success Banner */}
          {success ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Icon name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 8 }} />
              <Text style={styles.successText}>Account created! Redirecting to sign in...</Text>
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
                value={displayName}
                onChangeText={(val) => {
                  setDisplayName(val);
                  setError('');
                }}
                placeholder="Full Name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoComplete="name"
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
                value={emailOrPhone}
                onChangeText={(val) => {
                  setEmailOrPhone(val);
                  setError('');
                }}
                placeholder="Email or Phone Number"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
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
                placeholder="Password (6+ characters)"
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

          {/* Terms Disclaimer */}
          <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
            By signing up, you agree to our Terms of Service, Privacy Policy, and Community Guidelines.
          </Text>

          {/* Primary Pill Button */}
          <Pressable
            onPress={handleSignUp}
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
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </Pressable>
        </View>

        {/* Bottom Pinned Footer */}
        <View style={styles.footerRow}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Already have an account?{' '}
          </Text>
          <Pressable onPress={() => router.push('/(auth)/login')}>
            <Text style={[styles.footerLink, { color: colors.interactive }]}>
              Log in
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    padding: 4,
  },
  logoBadge: {
    width: 40,
    height: 40,
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
  banner: {
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
  successText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  formGroup: {
    gap: spacing.sm,
    marginBottom: spacing.md,
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
  disclaimerText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.lg,
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
});
