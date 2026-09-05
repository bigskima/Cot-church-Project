import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { BrandMark } from '@/components/primitives/BrandMark';
import { Icon } from '@/components/primitives/Icon';
import { Button } from '@/components/Button';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { api, setSession } = useSession();
  const { colors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [birthday, setBirthday] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [verificationPending, setVerificationPending] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const usernameValid = /^[a-z0-9][a-z0-9._]{2,29}$/.test(username.trim().toLowerCase());
  const birthdayValid = /^\d{4}-\d{2}-\d{2}$/.test(birthday.trim());

  const handleSignup = async () => {
    setErrorMsg('');
    if (!fullName.trim()) return setErrorMsg('Please enter your full name.');
    if (!usernameValid) return setErrorMsg('Choose a username using 3-30 letters, numbers, dots or underscores.');
    if (!birthdayValid) return setErrorMsg('Enter your birthday as YYYY-MM-DD.');
    if (!email.trim() || !email.includes('@')) return setErrorMsg('Please enter a valid email address.');
    if (!password) return setErrorMsg('Please enter a password.');
    if (password !== confirmPassword) return setErrorMsg('Passwords do not match.');

    setLoading(true);
    try {
      const res = await api.request<{ status: string; session?: { accessToken: string; refreshToken: string; expiresAt?: number; tokenType?: string } }>('signup', {
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
      if (res.status === 'verification_required' || !res.session) setVerificationPending(true);
      else {
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
    if (!otpCode.trim()) return setVerifyError('Please enter the verification code sent to your email.');
    setVerifying(true);
    setVerifyError('');
    try {
      const res = await api.request<{ status: string; session?: { accessToken: string; refreshToken: string; expiresAt?: number; tokenType?: string } }>('verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), token: otpCode.trim(), type: 'signup' }),
      });
      if (res.session) {
        await setSession(res.session);
        router.replace('/(tabs)/home');
      } else router.replace('/(auth)/login');
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Invalid or expired verification code.');
    } finally {
      setVerifying(false);
    }
  };

  const field = (label: string, value: string, onChangeText: (value: string) => void, placeholder: string, options: Partial<React.ComponentProps<typeof TextInput>> = {}) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMuted} style={[styles.input, { backgroundColor: colors.bgSecondary, borderColor: colors.border, color: colors.text }]} {...options} />
    </View>
  );

  const errorBanner = (message: string) => <View style={[styles.errorBanner, { backgroundColor: colors.liveSoft }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.errorText, { color: colors.live }]}>{message}</Text></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMarkContainer}><BrandMark variant="auth" size={68} /></View>
        {verificationPending ? (
          <View style={styles.verificationContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Check Your Email</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>We sent a verification code to <Text style={{ color: colors.text, fontWeight: '700' }}>{email}</Text>. Enter it below to activate your account.</Text>
            {verifyError ? errorBanner(verifyError) : null}
            <View style={[styles.inputGroup, { marginTop: spacing.md, width: '100%' }]}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>VERIFICATION CODE</Text>
              <TextInput value={otpCode} onChangeText={setOtpCode} placeholder="123456" placeholderTextColor={colors.textMuted} keyboardType="number-pad" maxLength={8} style={[styles.otpInput, { backgroundColor: colors.bgSecondary, borderColor: colors.border, color: colors.text }]} />
            </View>
            <Button label="Verify & Activate Account" onPress={handleVerifyOtp} loading={verifying} variant="primary" size="lg" style={{ marginTop: spacing.md, width: '100%' }} />
            <Pressable onPress={() => setVerificationPending(false)} style={styles.switchMethodBtn}><Text style={[styles.switchMethodText, { color: colors.interactive }]}>Change details</Text></Pressable>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Create Your Account</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your account is separate from Expression membership. Joining an Expression later unlocks its member-only community and birthday features.</Text>
            </View>
            {errorMsg ? errorBanner(errorMsg) : null}
            <View style={[styles.authCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <View style={styles.form}>
              {field('FULL NAME', fullName, setFullName, 'e.g. Grace Adebayo', { autoCapitalize: 'words', textContentType: 'name' })}
              {field('USERNAME', username, (value) => setUsername(value.replace(/\s/g, '').toLowerCase()), 'grace.adebayo', { autoCapitalize: 'none', autoCorrect: false })}
              <Text style={[styles.helper, { color: colors.textMuted }]}>Your username is public. It is not a church role or permission.</Text>
              {field('BIRTHDAY', birthday, setBirthday, 'YYYY-MM-DD', { keyboardType: 'numbers-and-punctuation', maxLength: 10 })}
              <Text style={[styles.helper, { color: colors.textMuted }]}>Birthday reminders become relevant only after you join an Expression.</Text>
              {field('EMAIL ADDRESS', email, setEmail, 'name@example.com', { autoCapitalize: 'none', keyboardType: 'email-address', textContentType: 'emailAddress' })}
              {field('PHONE NUMBER (OPTIONAL)', phone, setPhone, '+234…', { keyboardType: 'phone-pad', textContentType: 'telephoneNumber' })}
              {field('PASSWORD', password, setPassword, 'Create a strong password', { secureTextEntry: true, textContentType: 'newPassword' })}
              <Text style={[styles.helper, { color: colors.textMuted }]}>Use the password accepted by the platform’s current account security policy.</Text>
              {field('CONFIRM PASSWORD', confirmPassword, setConfirmPassword, 'Repeat password', { secureTextEntry: true, textContentType: 'newPassword' })}
              <Button label="Create Account" onPress={handleSignup} loading={loading} variant="primary" size="lg" style={{ marginTop: spacing.sm }} />
              </View>
            </View>
            <View style={styles.footer}><Text style={[styles.footerText, { color: colors.textSecondary }]}>Already have an account? </Text><Link href="/(auth)/login" asChild><Pressable><Text style={[styles.footerLink, { color: colors.interactive }]}>Sign in</Text></Pressable></Link></View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xxl, maxWidth: 460, width: '100%', alignSelf: 'center' },
  brandMarkContainer: { alignItems: 'center', marginBottom: spacing.lg },
  header: { marginBottom: spacing.xl, alignItems: 'center' },
  title: { ...typography.h1, textAlign: 'center' },
  subtitle: { ...typography.bodySmall, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  errorText: { fontSize: 13, fontWeight: '600', flex: 1 },
  form: { gap: spacing.md },
  inputGroup: { gap: 4 },
  inputLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontSize: 15 },
  helper: { fontSize: 11, lineHeight: 16, marginTop: -8 },
  otpInput: { height: 54, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontSize: 24, fontWeight: '700', textAlign: 'center', letterSpacing: 6 },
  authCard: { padding: spacing.lg, borderRadius: radius.xxl, borderWidth: 1 },
  verificationContainer: { alignItems: 'center', gap: spacing.sm },
  switchMethodBtn: { marginTop: spacing.md, padding: spacing.sm },
  switchMethodText: { fontSize: 14, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xxl, alignItems: 'center' },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '700' },
});
