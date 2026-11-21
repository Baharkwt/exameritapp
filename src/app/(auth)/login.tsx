import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { toApiError } from '@/api/client';
import { AppText, AuthHeader, Button, ErrorBanner, Screen, TextField } from '@/components/ui/kit';
import { useAuth } from '@/features/auth/auth-provider';
import { space, useColors } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { signIn } = useAuth();
  const c = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const emailErr = touched && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email' : null;
  const passErr = touched && !password ? 'Password is required' : null;

  async function submit() {
    setTouched(true);
    if (!EMAIL_RE.test(email.trim()) || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signIn({ email: email.trim().toLowerCase(), password });
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <AuthHeader title="Welcome back" subtitle="Sign in to continue your exam preparation." />
      {error ? <ErrorBanner message={error} /> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={emailErr}
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        error={passErr}
        onSubmitEditing={submit}
      />
      <Button title="Sign in" onPress={submit} loading={busy} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space.lg, gap: 6 }}>
        <AppText muted>New here?</AppText>
        <Link href="/register">
          <AppText style={{ color: c.primary, fontWeight: '800' }}>Create account</AppText>
        </Link>
      </View>
    </Screen>
  );
}

