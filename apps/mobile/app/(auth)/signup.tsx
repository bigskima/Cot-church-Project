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

export default function Signup() {
  const { api } = useSession();
  const { colors, isDark } = useTheme();
  const [method, setMethod] = useState<Method>('email');
  const [displayName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [callingCode, setCode] = useState('1');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!displayName.trim()) {
      setMessage('Please enter your full name.');
      setIsSuccess(false);
      return;
    }
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      setIsSuccess(false);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const identity =
        method === 'email'
          ? { email: email.trim().toLowerCase() }
          : { phoneNumber: `+${callingCode.replace(/\D/g, '')}${phone.replace(/\D/g, '')}` };
      await api.request('signup', {
        method: 'POST',
        body: JSON.stringify({ displayName: displayName.trim(), ...identity, password }),
      });
      setIsSuccess(true);
      setMessage('Account created successfully! Check your email or phone for verification.');
      setTimeout(() => router.replace('/(auth)/login'), 2000);
    } catch (err) {
      setIsSuccess(false);
      setMessage(err instanceof Error ? err.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
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
          {/* Header */}
          <View style={styles.brandHeader}>
            <View style={[styles.brandIconWrapper, { backgroundColor: colors.primarySoft }]}>
              <Icon name="person-add" size={28} color={colors.interactive} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Create Your Account</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Join your church family for sermon archives, events, giving, and community prayer.
            </Text>
          </View>

          {/* Signup Form Card */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            {/* Notification Banner */}
            {message ? (
              <View
                style={[
                  styles.messageBanner,
                  {
                    backgroundColor: isSuccess
                      ? 'rgba(22, 163, 106, 0.12)'
                      : 'rgba(229, 72, 77, 0.12)',
                    borderColor: isSuccess
                      ? 'rgba(22, 163, 106, 0.3)'
                      : 'rgba(229, 72, 77, 0.3)',
                  },
                ]}
              >
                <Icon
                  name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={isSuccess ? '#16A36A' : '#E5484D'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.messageText,
                    { color: isSuccess ? '#16A36A' : '#E5484D' },
                  ]}
                >
                  {message}
                </Text>
              </View>
            ) : null}

            <InputField
              label="Full Name"
              placeholder="e.g. Sarah Jenkins"
              value={displayName}
              onChangeText={setName}
              autoComplete="name"
              leftIcon={<Icon name="person-outline" size={18} color={colors.textMuted} />}
            />

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
                      setMessage('');
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

            {method === 'email' ? (
              <InputField
                label="Email"
                placeholder="name@example.com"
                value={email}
                onChangeText={setEmail}
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
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    placeholder="1"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField
                    label="Phone Number"
                    placeholder="5550199"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    leftIcon={<Icon name="call-outline" size={18} color={colors.textMuted} />}
                  />
                </View>
              </View>
            )}

            <InputField
              label="Create Password"
              placeholder="Minimum 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
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
              label="Create Account"
              onPress={submit}
              loading={loading}
              variant="primary"
              size="lg"
              style={{ marginTop: spacing.xs }}
            />
          </View>

          {/* Footer Navigation */}
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Already have an account?
            </Text>
            <Pressable onPress={() => router.push('/(auth)/login')}>
              <Text style={[styles.footerLink, { color: colors.interactive }]}>
                Sign In
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
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  messageText: {
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
