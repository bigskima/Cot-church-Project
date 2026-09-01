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

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { api, setSession } = useSession();
  const { colors } = useTheme();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Verification stage state
  const [verificationPending, setVerificationPending] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Live Password Checklist validation
  const hasMinLength = password.length >= 12 && password.length <= 128;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  const handleSignup = async () => {
    setErrorMsg('');

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!isPasswordValid) {
      setErrorMsg('Please ensure password satisfies all security requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.request<{
        status: string;
        session?: {
          accessToken: string;
          refreshToken: string;
          expiresAt?: number;
          tokenType?: string;
        };
        userId?: string;
      }>('signup', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phoneNumber: phone.trim() ? (phone.startsWith('+') ? phone.trim() : `+${phone.trim()}`) : undefined,
          password,
        }),
      });

      if (res.status === 'verification_required' || !res.session) {
        setVerificationPending(true);
      } else if (res.session) {
        await setSession(res.session);
        router.replace('/(tabs)/home');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      setVerifyError('Please enter the verification code sent to your email.');
      return;
    }
    setVerifying(true);
    setVerifyError('');
    try {
      const res = await api.request<{
        status: string;
        session?: {
          accessToken: string;
          refreshToken: string;
          expiresAt?: number;
          tokenType?: string;
        };
      }>('verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          token: otpCode.trim(),
          type: 'signup',
        }),
      });

      if (res.session) {
        await setSession(res.session);
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/login');
      }
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Invalid or expired verification code.');
    } finally {
      setVerifying(false);
    }
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
        {/* Brand Mark */}
        <View style={styles.brandMarkContainer}>
          <BrandMark variant="auth" size={68} />
        </View>

        {verificationPending ? (
          /* Branded Verification Screen */
          <View style={styles.verificationContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Check Your Email</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              We sent a verification code to <Text style={{ color: colors.text, fontWeight: '700' }}>{email}</Text>. Enter the code below to activate your account.
            </Text>

            {verifyError ? (
              <View style={[styles.errorBanner, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <Icon name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                <Text style={[styles.errorText, { color: '#EF4444' }]}>{verifyError}</Text>
              </View>
            ) : null}

            <View style={[styles.inputGroup, { marginTop: spacing.md }]}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>6-DIGIT VERIFICATION CODE</Text>
              <TextInput
                value={otpCode}
                onChangeText={setOtpCode}
                placeholder="123456"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={8}
                style={[
                  styles.otpInput,
                  {
                    backgroundColor: colors.bgSecondary,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
              />
            </View>

            <Button
              label="Verify & Activate Account"
              onPress={handleVerifyOtp}
              loading={verifying}
              variant="primary"
              size="lg"
              style={{ marginTop: spacing.md }}
            />

            <Pressable
              onPress={() => setVerificationPending(false)}
              style={styles.switchMethodBtn}
            >
              <Text style={[styles.switchMethodText, { color: colors.interactive }]}>
                Change Email / Back to Signup
              </Text>
            </Pressable>
          </View>
        ) : (
          /* Signup Form */
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Join the Fellowship</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Create your church profile to access sermons, worship livestreams, and community.
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
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>FULL NAME</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="e.g. Grace Adebayo"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
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
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>EMAIL ADDRESS</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
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
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>PHONE NUMBER (OPTIONAL)</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
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
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Create a strong password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
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

              {/* Live Password Requirements Checklist */}
              <View style={[styles.checklistCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.checklistTitle, { color: colors.textSecondary }]}>PASSWORD REQUIREMENTS</Text>
                <View style={styles.checkItem}>
                  <Icon
                    name={hasMinLength ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={hasMinLength ? '#10B981' : colors.textMuted}
                  />
                  <Text style={[styles.checkText, { color: hasMinLength ? colors.text : colors.textMuted }]}>
                    12 to 128 characters
                  </Text>
                </View>
                <View style={styles.checkItem}>
                  <Icon
                    name={hasUppercase ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={hasUppercase ? '#10B981' : colors.textMuted}
                  />
                  <Text style={[styles.checkText, { color: hasUppercase ? colors.text : colors.textMuted }]}>
                    At least one uppercase letter (A-Z)
                  </Text>
                </View>
                <View style={styles.checkItem}>
                  <Icon
                    name={hasLowercase ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={hasLowercase ? '#10B981' : colors.textMuted}
                  />
                  <Text style={[styles.checkText, { color: hasLowercase ? colors.text : colors.textMuted }]}>
                    At least one lowercase letter (a-z)
                  </Text>
                </View>
                <View style={styles.checkItem}>
                  <Icon
                    name={hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={hasNumber ? '#10B981' : colors.textMuted}
                  />
                  <Text style={[styles.checkText, { color: hasNumber ? colors.text : colors.textMuted }]}>
                    At least one numeric digit (0-9)
                  </Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>CONFIRM PASSWORD</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
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

              <Button
                label="Create Account"
                onPress={handleSignup}
                loading={loading}
                variant="primary"
                size="lg"
                style={{ marginTop: spacing.sm }}
              />
            </View>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                Already have an account?{' '}
              </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text style={[styles.footerLink, { color: colors.interactive }]}>Sign in</Text>
                </Pressable>
              </Link>
            </View>
          </>
        )}
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
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  brandMarkContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
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
  otpInput: {
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 6,
  },
  checklistCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
  },
  checklistTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    fontSize: 12,
    fontWeight: '500',
  },
  verificationContainer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchMethodBtn: {
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  switchMethodText: {
    fontSize: 14,
    fontWeight: '600',
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
