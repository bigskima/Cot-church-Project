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
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { Button, InputField, Icon } from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

type Method = 'email' | 'phone';

export default function Login() {
  const { api, authenticate, continueAsVisitor } = useSession();
  const { colors, isDark } = useTheme();
  const [method, setMethod] = useState<Method>('email');
  const [email, setEmail] = useState('');
  const [callingCode, setCallingCode] = useState('1');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const identity =
        method === 'email'
          ? { email: email.trim().toLowerCase() }
          : { phoneNumber: `+${callingCode.replace(/\D/g, '')}${phone.replace(/\D/g, '')}` };
      const data = await api.request<{
        session: {
          accessToken: string;
          refreshToken: string;
          expiresAt?: number;
          tokenType: string;
        };
      }>('login', {
        method: 'POST',
        body: JSON.stringify({ ...identity, password }),
      });
      await authenticate({ session: data.session });
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  function visit() {
    continueAsVisitor();
    router.replace('/(tabs)/home');
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formWrapper}>
          {/* Header Branding */}
          <View style={styles.brandHeader}>
            <View style={[styles.brandIconWrapper, { backgroundColor: colors.primarySoft }]}>
              <Icon name="business" size={28} color={colors.interactive} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign in to your church community, teachings, giving, and pastoral care.
            </Text>
          </View>

          {/* Login Card */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            {/* Method Pill Selector */}
            <View
              style={[
                styles.methodPillContainer,
                { backgroundColor: colors.bgSecondary },
              ]}
            >
              {(['email', 'phone'] as Method[]).map((val) => {
                const isSelected = method === val;
                return (
                  <Pressable
                    key={val}
                    onPress={() => {
                      setMethod(val);
                      setError('');
                    }}
                    style={[
                      styles.methodPill,
                      isSelected && {
                        backgroundColor: colors.card,
                        ...shadows.sm,
                      },
                    ]}
                  >
                    <Icon
                      name={val === 'email' ? 'mail-outline' : 'call-outline'}
                      size={16}
                      color={isSelected ? colors.text : colors.textMuted}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.methodPillText,
                        { color: isSelected ? colors.text : colors.textMuted },
                      ]}
                    >
                      {val === 'email' ? 'Email Address' : 'Phone Number'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Error Banner */}
            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: 'rgba(229, 72, 77, 0.12)', borderColor: 'rgba(229, 72, 77, 0.3)' }]}>
                <Icon name="alert-circle" size={16} color="#E5484D" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Inputs */}
            {method === 'email' ? (
              <InputField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                leftIcon={<Icon name="mail-outline" size={18} color={colors.textMuted} />}
              />
            ) : (
              <View style={styles.phoneInputRow}>
                <View style={{ width: 80 }}>
                  <InputField
                    label="Code"
                    value={callingCode}
                    onChangeText={setCallingCode}
                    keyboardType="number-pad"
                    placeholder="1"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField
                    label="Phone Number"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="5550199"
                    autoComplete="tel"
                    leftIcon={<Icon name="call-outline" size={18} color={colors.textMuted} />}
                  />
                </View>
              </View>
            )}

            <InputField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="Enter your password"
              autoCapitalize="none"
              leftIcon={<Icon name="lock-closed-outline" size={18} color={colors.textMuted} />}
              rightIcon={
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                  <Icon
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              }
            />

            <Button
              label="Sign In"
              onPress={submit}
              loading={loading}
              variant="primary"
              size="lg"
              style={{ marginTop: spacing.xs }}
            />

            {/* Guest / Visitor Access */}
            <Button
              label="Continue as Guest"
              onPress={visit}
              variant="ghost"
              size="md"
              style={{ marginTop: spacing.xxs }}
            />
          </View>

          {/* Footer Navigation */}
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Don't have an account?
            </Text>
            <Pressable onPress={() => router.push('/(auth)/signup')}>
              <Text style={[styles.footerLink, { color: colors.interactive }]}>
                Create Account
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  formWrapper: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  brandHeader: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  brandIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodySmall,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
  },
  methodPillContainer: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.xs,
  },
  methodPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  methodPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  errorText: {
    color: '#E5484D',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
