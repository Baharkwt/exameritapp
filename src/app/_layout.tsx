import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { ApiError } from '@/api/client';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { loading, user } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
        <Stack.Screen name="exams/index" />
        <Stack.Screen name="exams/[id]" />
        <Stack.Screen name="tests/[id]/index" />
        <Stack.Screen name="tests/[id]/window" options={{ gestureEnabled: false }} />
        <Stack.Screen name="tests/[id]/result" />
        <Stack.Screen name="live-tests" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="courses/[id]" />
        <Stack.Screen name="syllabus" />
        <Stack.Screen name="current-affairs/index" />
        <Stack.Screen name="current-affairs/[id]" />
        <Stack.Screen name="vocabulary" />
        <Stack.Screen name="subscription" />
        <Stack.Screen name="pricing" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="mistakes" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="help" />
        <Stack.Screen name="settings/security" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: (count, err) => {
              const s = err instanceof ApiError ? err.status : null;
              if (s && s >= 400 && s < 500) return false; // don't retry client errors
              return count < 2;
            },
          },
        },
      }),
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <StatusBar style="auto" />
          <RootStack />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
