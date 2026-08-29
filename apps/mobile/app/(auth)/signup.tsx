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
import { Button, InputField } from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';

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
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!displayName.trim()) {
      setMessage('Please enter your full name.');
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
      setMessage('Account created! Check your email or SMS for verification.');
      setTimeout(() => router.replace('/(auth)/login'), 2000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create your account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }] as any}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.brandHeader}>
          <Text style={styles.brandKicker as any}>SANCTUARY MEMBERSHIP</Text>
          <Text style={[styles.title, { color: colors.text }] as any}>Join the Sanctuary</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }] as any}>
            Connect with pastoral care, local expression campuses, and giving receipts.
          </Text>
        </View>

        {/* Signup Form Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
            shadows.md,
          ] as any}
        >
          <InputField
            label="Full Name"
            placeholder="e.g. Johnathan Doe"
            value={displayName}
            onChangeText={setName}
            dark={isDark}
          />

          {/* Method Pill Selector */}
          <View
            style={[
              styles.methodPillContainer,
              { backgroundColor: isDark ? '#1C1009' : '#E8D5C4' },
            ] as any}
          >
            {(['email', 'phone'] as Method[]).map((val) => {
              const isSelected = method === val;
              return (
                <Pressable
                  key={val}
                  onPress={() => setMethod(val)}
                  style={[
                    styles.methodPill,
                    isSelected ? {
                      backgroundColor: isDark ? '#2E1C11' : '#FFFDF9',
                      ...shadows.sm,
                    } : null,
                  ] as any}
                >
                  <Text
                    style={[
                      styles.methodPillText,
                      { color: isSelected ? colors.text : colors.textMuted },
                      isSelected ? styles.methodPillTextActive : null,
                    ] as any}
                  >
                    {val === 'email' ? '✉️ Email Sign Up' : '📱 Mobile Phone'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {method === 'email' ? (
            <InputField
              label="Email Address"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="member@church.org"
              value={email}
              onChangeText={setEmail}
              dark={isDark}
            />
          ) : (
            <View style={styles.phoneRow}>
              <View style={{ width: 90 }}>
                <InputField
                  label="Code"
                  keyboardType="phone-pad"
                  placeholder="+1"
                  value={callingCode}
                  onChangeText={setCode}
                  dark={isDark}
                />
              </View>
              <View style={{ flex: 1 }}>
                <InputField
                  label="Phone Number"
                  keyboardType="phone-pad"
                  placeholder="(555) 000-0000"
                  value={phone}
                  onChangeText={setPhone}
                  dark={isDark}
                />
              </View>
            </View>
          )}

          <InputField
            label="Create Secure Password"
            secureTextEntry
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            dark={isDark}
          />

          {message ? <Text style={styles.messageText as any}>{message}</Text> : null}

          <Button
            label="Complete Registration ➔"
            onPress={submit}
            variant="gold"
            size="lg"
            loading={loading}
            style={{ marginTop: spacing.md } as any}
          />

          <Button
            label="Already have an account? Sign In"
            onPress={() => router.back()}
            variant="outline"
            size="md"
            style={{ marginTop: spacing.sm } as any}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: 60,
  },
  brandHeader: {
    marginBottom: spacing.lg,
  },
  brandKicker: {
    color: palette.yellow,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 19,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
  },
  methodPillContainer: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.md,
  },
  methodPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  methodPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  methodPillTextActive: {
    fontWeight: '900',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  messageText: {
    color: palette.yellowDark,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
});
