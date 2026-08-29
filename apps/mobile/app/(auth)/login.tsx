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

export default function Login() {
  const { api, authenticate, continueAsVisitor } = useSession();
  const { colors, isDark } = useTheme();
  const [method, setMethod] = useState<Method>('email');
  const [email, setEmail] = useState('');
  const [callingCode, setCallingCode] = useState('1');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
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
      setError(err instanceof Error ? err.message : 'Unable to sign in');
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
      style={[styles.container, { backgroundColor: colors.bg }] as any}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header Branding */}
        <View style={styles.brandHeader}>
          <Text style={styles.brandKicker as any}>SANCTUARY DIGITAL PLATFORM</Text>
          <Text style={[styles.title, { color: colors.text }] as any}>Welcome Home</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }] as any}>
            Worship, fellowship, prayer, and spiritual growth — wherever you are.
          </Text>
        </View>

        {/* Login Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
            shadows.md,
          ] as any}
        >
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
                    {val === 'email' ? '✉️ Email Sign In' : '📱 Mobile Phone'}
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
              placeholder="pastor@church.org / member@example.com"
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
                  onChangeText={setCallingCode}
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
            label="Password"
            secureTextEntry
            placeholder="Enter your sanctuary password"
            value={password}
            onChangeText={setPassword}
            dark={isDark}
          />

          {error ? <Text style={styles.errorText as any}>{error}</Text> : null}

          <Button
            label="Sign In to Sanctuary ➔"
            onPress={submit}
            variant="gold"
            size="lg"
            loading={loading}
            style={{ marginTop: spacing.md } as any}
          />

          <Button
            label="Create New Account"
            onPress={() => router.push('/(auth)/signup')}
            variant="outline"
            size="md"
            style={{ marginTop: spacing.sm } as any}
          />
        </View>

        {/* Public Visitor Link (No Auth Required) */}
        <Pressable onPress={visit} style={styles.visitorLink as any}>
          <Text style={[styles.visitorLinkText, { color: colors.primaryDark }] as any}>
            ✦ Continue as Guest / Browse Public Services
          </Text>
        </Pressable>
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
    paddingTop: 70,
    paddingBottom: 60,
    justifyContent: 'center',
  },
  brandHeader: {
    marginBottom: spacing.xl,
  },
  brandKicker: {
    color: palette.yellow,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
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
  errorText: {
    color: palette.live,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  visitorLink: {
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  visitorLinkText: {
    fontWeight: '800',
    fontSize: 14,
  },
});
