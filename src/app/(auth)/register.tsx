import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { toApiError } from '@/api/client';
import { AppText, Button, ErrorBanner, Screen, TextField } from '@/components/ui/kit';
import { useAuth } from '@/features/auth/auth-provider';
import { space, useColors } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { signUp } = useAuth();
  const c = useColors();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const errs = {
    name: touched && !name.trim() ? 'Name is required' : null,
    email: touched && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email' : null,
    phone: touched && phone.length > 20 ? 'Phone is too long' : null,
    password: touched && password.length < 8 ? 'At least 8 characters' : null,
  };

  async function submit() {
    setTouched(true);
    if (!name.trim() || !EMAIL_RE.test(email.trim()) || password.length < 8 || phone.length > 20) return;
    setBusy(true);
    setError(null);
    try {
      await signUp({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || null,
      });
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <View style={{ marginBottom: space.xl }}>
        <AppText variant="title">Create account</AppText>
        <AppText muted>Join Examerit and start practising</AppText>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <TextField label="Full name" value={name} onChangeText={setName} autoComplete="name" error={errs.name} />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        error={errs.email}
      />
      <TextField
        label="Phone (optional)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        error={errs.phone}
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        error={errs.password}
        onSubmitEditing={submit}
      />
      <Button title="Create account" onPress={submit} loading={busy} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space.lg, gap: 6 }}>
        <AppText muted>Already registered?</AppText>
        <Link href="/login">
          <AppText style={{ color: c.primary, fontWeight: '600' }}>Sign in</AppText>
        </Link>
      </View>
    </Screen>
  );
}

