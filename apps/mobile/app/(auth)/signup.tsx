import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { BrandMark } from '@/components/primitives/BrandMark';
import { Icon } from '@/components/primitives/Icon';
import { Button } from '@/components/Button';
import { InputField } from '@/components/Input';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

type SignupStep = 'identity' | 'security';

function safeReturnTo(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('://') || value.startsWith('/(auth)')) {
    return '/general';
  }
  return value;
}

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { returnTo: requestedReturnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeReturnTo(requestedReturnTo);
  const { api, setSession } = useSession();
  const { colors } = useTheme();

  const [step, setStep] = useState<SignupStep>('identity');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [birthday, setBirthday] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [verificationPending, setVerificationPending] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const usernameValid = /^[a-z0-9][a-z0-9._]{2,29}$/.test(username.trim().toLowerCase());
  const birthdayValid = /^\d{4}-\d{2}-\d{2}$/.test(birthday.trim());

  const validateIdentity = () => {
    setErrorMsg('');
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return false;
    }
    if (!usernameValid) {
      setErrorMsg('Choose a username using 3-30 letters, numbers, dots or underscores.');
      return false;
    }
    if (!birthdayValid) {
      setErrorMsg('Enter your birthday as YYYY-MM-DD.');
      return false;
    }
    return true;
  };

  const continueToSecurity = () => {
    if (!validateIdentity()) return;
    setStep('security');
  };

  const handleSignup = async () => {
    setErrorMsg('');
    if (!validateIdentity()) {
      setStep('identity');
      return;
    }
    if (!email.trim() || !email.includes('@')) return setErrorMsg('Please enter a valid email address.');
    if (!password) return setErrorMsg('Please enter a password.');
    if (password !== confirmPassword) return setErrorMsg('Passwords do not match.');

    setLoading(true);
    try {
      const res = await api.request<{
        status: string;
        session?: { accessToken: string; refreshToken: string; expiresAt?: number; tokenType?: string };
      }>('signup', {
        method: 'POST',
        body: JSON.stringify({
          displayName: fullName.trim(),
          username: username.trim().toLowerCase(),
          birthday: birthday.trim(),
          email: email.trim().toLowerCase(),
          phoneNumber: phone.trim() ? (phone.trim().startsWith('+') ? phone.trim() : `+${phone.trim()}`) : undefined,
          password,
        }),
      });

      if (res.status === 'verification_required') {
        setVerificationPending(true);
      } else if (res.session) {
        await setSession(res.session);
        router.replace(returnTo as any);
      } else {
        // The signup Edge Function may intentionally omit the raw Auth session.
        // An active account is still a successful registration; route to login
        // instead of incorrectly asking for an OTP that may not exist.
        router.replace({
          pathname: '/(auth)/login',
          params: { returnTo, registered: '1' },
        } as any);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) return setVerifyError('Please enter the verification code sent to your email.');
    setVerifying(true);
    setVerifyError('');
    try {
      const res = await api.request<{
        status: string;
        session?: { accessToken: string; refreshToken: string; expiresAt?: number; tokenType?: string };
      }>('verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), token: otpCode.trim(), type: 'signup' }),
      });
      if (res.session) {
        await setSession(res.session);
        router.replace(returnTo as any);
      } else {
        router.replace({ pathname: '/(auth)/login', params: { returnTo } } as any);
      }
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Invalid or expired verification code.');
    } finally {
      setVerifying(false);
    }
  };

  const field = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    placeholder: string,
    options: Partial<React.ComponentProps<typeof TextInput>> = {},
    rightIcon?: React.ReactNode,
  ) => {
    const leftIcon =
      label === 'FULL NAME' ? <Icon name="person-outline" size={18} color={colors.textMuted} /> :
      label === 'USERNAME' ? <Icon name="at-outline" size={18} color={colors.textMuted} /> :
      label === 'BIRTHDAY' ? <Icon name="calendar-outline" size={18} color={colors.textMuted} /> :
      label === 'EMAIL ADDRESS' ? <Icon name="mail-outline" size={18} color={colors.textMuted} /> :
      label.startsWith('PHONE') ? <Icon name="call-outline" size={18} color={colors.textMuted} /> :
      <Icon name="lock-closed-outline" size={18} color={colors.textMuted} />;

    return (
      <InputField
        label={label}
        value={value}
        onChangeText={(next) => {
          onChangeText(next);
          if (errorMsg) setErrorMsg('');
        }}
        placeholder={placeholder}
        containerStyle={styles.sharedField}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
        {...options}
      />
    );
  };

  const errorBanner = (message: string) => (
    <View style={[styles.errorBanner, { backgroundColor: colors.liveSoft }]}>
      <Icon name="alert-circle" size={18} color={colors.live} />
      <Text style={[styles.errorText, { color: colors.live }]}>{message}</Text>
    </View>
  );

  const stepHeader = (
    <View style={styles.stepWorkspace}>
      <View style={styles.stepProgressRow}>
        <View style={[styles.stepProgressItem, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
          <View style={[styles.stepNumber, { backgroundColor: colors.interactive }]}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={styles.stepProgressCopy}>
            <Text style={[styles.stepProgressTitle, { color: colors.text }]}>Identity</Text>
            <Text style={[styles.stepProgressMeta, { color: colors.textMuted }]}>Name & profile</Text>
          </View>
        </View>
        <View
          style={[
            styles.stepConnector,
            { backgroundColor: step === 'security' ? colors.interactive : colors.borderSubtle },
          ]}
        />
        <View
          style={[
            styles.stepProgressItem,
            {
              backgroundColor: step === 'security' ? colors.primarySoft : colors.bgSecondary,
              borderColor: step === 'security' ? colors.primarySoftStrong : colors.borderSubtle,
            },
          ]}
        >
          <View
            style={[
              styles.stepNumber,
              { backgroundColor: step === 'security' ? colors.interactive : colors.cardElevated },
            ]}
          >
            <Text style={[styles.stepNumberText, step !== 'security' && { color: colors.textMuted }]}>2</Text>
          </View>
          <View style={styles.stepProgressCopy}>
            <Text style={[styles.stepProgressTitle, { color: step === 'security' ? colors.text : colors.textSecondary }]}>Security</Text>
            <Text style={[styles.stepProgressMeta, { color: colors.textMuted }]}>Contact & access</Text>
          </View>
        </View>
      </View>
      <Text style={[styles.stepLabel, { color: colors.textMuted }]}>
        {step === 'identity' ? 'Start with the identity people will see around COT.' : 'Add your sign-in details. Password rules come from the live account security policy.'}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandMarkContainer}><BrandMark variant="auth" size={64} /></View>

        {verificationPending ? (
          <View style={[styles.authCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={styles.verificationContainer}>
              <View style={[styles.verifyIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="mail-outline" size={28} color={colors.interactive} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Check your email</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                We sent a verification code to <Text style={{ color: colors.text, fontWeight: '700' }}>{email}</Text>.
              </Text>
              {verifyError ? errorBanner(verifyError) : null}
              <View style={[styles.inputGroup, { marginTop: spacing.sm, width: '100%' }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>VERIFICATION CODE</Text>
                <TextInput
                  value={otpCode}
                  onChangeText={setOtpCode}
                  placeholder="123456"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={8}
                  style={[styles.otpInput, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle, color: colors.text }]}
                />
              </View>
              <Button label="Verify account" onPress={handleVerifyOtp} loading={verifying} variant="primary" size="lg" style={{ width: '100%' }} />
              <Pressable onPress={() => setVerificationPending(false)} style={styles.switchMethodBtn}>
                <Text style={[styles.switchMethodText, { color: colors.interactive }]}>Change signup details</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Create your account</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Your COT account is separate from Expression membership. You can join an Expression later.
              </Text>
            </View>

            <View style={[styles.authCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              {stepHeader}
              {errorMsg ? errorBanner(errorMsg) : null}

              {step === 'identity' ? (
                <View style={styles.form}>
                  {field('FULL NAME', fullName, setFullName, 'e.g. Grace Adebayo', {
                    autoCapitalize: 'words',
                    textContentType: 'name',
                  })}
                  {field('USERNAME', username, (value) => setUsername(value.replace(/\s/g, '').toLowerCase()), 'grace.adebayo', {
                    autoCapitalize: 'none',
                    autoCorrect: false,
                  })}
                  <Text style={[styles.helper, { color: colors.textMuted }]}>Your username is public. It is not a church role or permission.</Text>
                  {field('BIRTHDAY', birthday, setBirthday, 'YYYY-MM-DD', {
                    keyboardType: 'numbers-and-punctuation',
                    maxLength: 10,
                  })}
                  <Text style={[styles.helper, { color: colors.textMuted }]}>Birthday visibility becomes relevant only after you join an Expression.</Text>
                  <Button label="Continue" onPress={continueToSecurity} variant="primary" size="lg" />
                </View>
              ) : (
                <View style={styles.form}>
                  {field('EMAIL ADDRESS', email, setEmail, 'name@example.com', {
                    autoCapitalize: 'none',
                    keyboardType: 'email-address',
                    textContentType: 'emailAddress',
                  })}
                  {field('PHONE NUMBER (OPTIONAL)', phone, setPhone, '+234…', {
                    keyboardType: 'phone-pad',
                    textContentType: 'telephoneNumber',
                  })}
                  {field(
                    'PASSWORD',
                    password,
                    setPassword,
                    'Create your password',
                    {
                      secureTextEntry: !showPassword,
                      textContentType: 'newPassword',
                    },
                    <Pressable
                      onPress={() => setShowPassword((value) => !value)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.textMuted} />
                    </Pressable>,
                  )}
                  <Text style={[styles.helper, { color: colors.textMuted }]}>Password acceptance follows the platform’s current Supabase/account security policy.</Text>
                  {field(
                    'CONFIRM PASSWORD',
                    confirmPassword,
                    setConfirmPassword,
                    'Repeat password',
                    {
                      secureTextEntry: !showConfirmPassword,
                      textContentType: 'newPassword',
                    },
                    <Pressable
                      onPress={() => setShowConfirmPassword((value) => !value)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                    >
                      <Icon name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.textMuted} />
                    </Pressable>,
                  )}

                  <View style={styles.actionRow}>
                    <Button label="Back" onPress={() => { setErrorMsg(''); setStep('identity'); }} variant="outline" size="lg" style={styles.flexButton} />
                    <Button label="Create account" onPress={handleSignup} loading={loading} variant="primary" size="lg" style={styles.flexButton} />
                  </View>
                </View>
              )}
            </View>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>Already have an account? </Text>
              <Pressable onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo } } as any)}>
                <Text style={[styles.footerLink, { color: colors.interactive }]}>Sign in</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, maxWidth: 460, width: '100%', alignSelf: 'center' },
  brandMarkContainer: { alignItems: 'center', marginBottom: spacing.md },
  header: { marginBottom: spacing.lg, alignItems: 'center' },
  title: { ...typography.h1, textAlign: 'center' },
  subtitle: { ...typography.bodySmall, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  authCard: { padding: spacing.lg, borderRadius: radius.xxl, borderWidth: 1 },
  stepWorkspace: { gap: spacing.sm, marginBottom: spacing.lg },
  stepProgressRow: { flexDirection: 'row', alignItems: 'center' },
  stepProgressItem: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.sm },
  stepConnector: { width: 12, height: 2 },
  stepNumber: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  stepProgressCopy: { flex: 1, minWidth: 0 },
  stepProgressTitle: { fontSize: 11.5, fontWeight: '800' },
  stepProgressMeta: { fontSize: 9.5, marginTop: 1 },
  stepLabel: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.md },
  errorText: { fontSize: 13, fontWeight: '600', flex: 1 },
  form: { gap: spacing.sm },
  sharedField: { marginBottom: spacing.sm },
  inputGroup: { gap: 4 },
  inputLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  input: { minHeight: 50, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.md, fontSize: 15 },
  helper: { fontSize: 11, lineHeight: 16, marginTop: -4 },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  flexButton: { flex: 1 },
  otpInput: { height: 56, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.md, fontSize: 24, fontWeight: '700', textAlign: 'center', letterSpacing: 6 },
  verificationContainer: { alignItems: 'center', gap: spacing.md },
  verifyIcon: { width: 58, height: 58, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  switchMethodBtn: { padding: spacing.sm },
  switchMethodText: { fontSize: 13, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl, alignItems: 'center' },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '700' },
});
