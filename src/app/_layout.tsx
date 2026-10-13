import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { LanguageProvider } from '@/hooks/use-language';
import { supabase } from '@/services/supabase';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (active) {
        setSession(error ? null : data.session);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <LanguageProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <AnimatedSplashOverlay />
      {session === undefined ? null : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={session == null}>
            <Stack.Screen name="login" />
          </Stack.Protected>
          <Stack.Protected guard={session != null}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="supplier/new" />
            <Stack.Screen name="medicine/new" />
            <Stack.Screen name="patient/new" />
            <Stack.Screen name="patient/visits" />
            <Stack.Screen name="appointment/new" />
            <Stack.Screen name="transaction/new" />
            <Stack.Screen name="purchase/new" />
          </Stack.Protected>
        </Stack>
      )}
      </LanguageProvider>
    </ThemeProvider>
  );
}
