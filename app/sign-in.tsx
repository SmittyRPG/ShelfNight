import { useState } from 'react';
import { Text, View } from 'react-native';
import { Banner, Button, Card, Field, Lede, Muted, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

/**
 * Passwordless sign-in: we email a 6-digit code. Works the same on phones, web and desktop
 * and avoids storing passwords.
 */
export default function SignIn() {
  const c = useColors();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);

  async function sendCode() {
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) { setMessage({ text: 'Enter a valid email address.', tone: 'error' }); return; }
    setBusy(true); setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) { setMessage({ text: 'We could not send the code. Wait a minute and try again.', tone: 'error' }); return; }
    setEmail(clean);
    setStep('code');
    setMessage({ text: `We sent a 6-digit code to ${clean}. It may take a minute to arrive.`, tone: 'info' });
  }

  async function verify() {
    if (!/^\d{6}$/.test(code.trim())) { setMessage({ text: 'The code is 6 digits.', tone: 'error' }); return; }
    setBusy(true); setMessage(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMessage({ text: 'That code did not work. Check it, or send a new one.', tone: 'error' });
    // On success the app moves on automatically.
  }

  return (
    <Screen>
      <View style={{ height: 32 }} />
      <Text style={{ fontSize: 44 }} accessibilityElementsHidden>🎲</Text>
      <Title>Shelf Night</Title>
      <Lede>Pick tonight's game from your own shelf, scan your collection with one photo, and talk games with other players.</Lede>
      <Card>
        {step === 'email' ? (
          <>
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com"
              autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email"
              onSubmitEditing={sendCode} returnKeyType="send" />
            <Button title="Email me a sign-in code" onPress={sendCode} loading={busy} />
            <Muted>New here? The same code creates your account.</Muted>
          </>
        ) : (
          <>
            <Field label="6-digit code" value={code} onChangeText={setCode} placeholder="123456"
              keyboardType="number-pad" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              onSubmitEditing={verify} returnKeyType="done" />
            <Button title="Sign in" onPress={verify} loading={busy} />
            <Button title="Use a different email" kind="ghost" onPress={() => { setStep('email'); setCode(''); setMessage(null); }} />
          </>
        )}
        <Banner text={message?.text} tone={message?.tone} />
      </Card>
      <Text style={{ color: c.muted, fontSize: 12 }}>
        Game data from Wikidata and the Shelf Night community.
      </Text>
    </Screen>
  );
}
