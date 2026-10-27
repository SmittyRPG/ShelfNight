import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { DataProvider } from '@/lib/data';
import { isConfigured } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

/** Sends people to the right place: sign in → create profile → the app. */
function Gate() {
  const { loading, session, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const c = useColors();

  useEffect(() => {
    if (loading) return;
    const at = segments[0];
    if (!session) {
      if (at !== 'sign-in') router.replace('/sign-in');
    } else if (!profile) {
      if (at !== 'onboarding') router.replace('/onboarding');
    } else if (at === 'sign-in' || at === 'onboarding') {
      router.replace('/');
    }
  }, [loading, session, profile, segments, router]);

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg }}><Loading /></View>;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.fg,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ title: 'Create your profile', headerBackVisible: false }} />
      <Stack.Screen name="thread/[id]" options={{ title: 'Discussion' }} />
      <Stack.Screen name="new-thread" options={{ title: 'New discussion', presentation: 'modal' }} />
      <Stack.Screen name="profile/[username]" options={{ title: 'Profile' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}

function NotConfigured() {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: 24, justifyContent: 'center', gap: 12 }}>
      <Text style={{ color: c.fg, fontSize: 22, fontWeight: '800' }}>Almost there</Text>
      <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22 }}>
        Shelf Night isn't connected to its database yet. Copy .env.example to .env, paste in your Supabase URL and anon key,
        then restart with "npx expo start". The README walks through it step by step.
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {isConfigured ? (
        <AuthProvider>
          <DataProvider>
            <Gate />
          </DataProvider>
        </AuthProvider>
      ) : (
        <NotConfigured />
      )}
    </SafeAreaProvider>
  );
}
