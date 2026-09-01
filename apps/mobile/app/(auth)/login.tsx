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
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { BrandMark } from '@/components/primitives/BrandMark';
import { Icon } from '@/components/primitives/Icon';
import { Button } from '@/components/Button';
import { radius, spacing, typography } from '@/design-system/tokens';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, enterAsVisitor } = useSession();
  const { colors } = useTheme();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
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
      router.replace('/(tabs)/home');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid credentials. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestEntry = async () => {
    await enterAsVisitor();
    router.replace('/(tabs)/home');
  };

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
        {/* Platform Brand Mark */}
        <View style={styles.brandMarkContainer}>
          <BrandMark variant="auth" size={72} />
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in to access sermons, giving, prayer wall, and your campus fellowship.
          </Text>
        </View>

        {errorMsg ? (
          <View style={[styles.errorBanner, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
            <Icon name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={[styles.errorText, { color: '#EF4444' }]}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>EMAIL OR PHONE NUMBER</Text>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="name@example.com or +15550000000"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[
                styles.input,
                {
                  backgroundColor: colors.bgSecondary,
                  borderColor: colors.border,
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
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.bgSecondary,
                    borderColor: colors.border,
                    color: colors.text,
                    paddingRight: 44,
                  },
                ]}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={8}
              >
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
          </View>

          <Button
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            variant="primary"
            size="lg"
            style={{ marginTop: spacing.sm }}
          />

          <Button
            label="Continue as Guest"
            onPress={handleGuestEntry}
            variant="outline"
            size="lg"
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Don't have an account?{' '}
          </Text>
          <Link href="/(auth)/signup" asChild>
            <Pressable>
              <Text style={[styles.footerLink, { color: colors.interactive }]}>Sign up</Text>
            </Pressable>
          </Link>
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
    marginBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.xxl,
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
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
    borderRadius: radius.md,
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
    borderRadius: radius.md,
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
