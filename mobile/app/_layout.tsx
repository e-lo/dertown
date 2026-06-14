import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { THEME } from '../lib/theme';
import { StarProvider } from '../contexts/StarContext';
import { WelcomeModal } from '../components/WelcomeModal';

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.1,
    debug: __DEV__,
  });
}

const WELCOME_KEY = 'welcome:seen';

function RootLayout() {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(WELCOME_KEY).then((val) => {
      if (!val) setShowWelcome(true);
    });
  }, []);

  const handleDismissWelcome = async () => {
    await AsyncStorage.setItem(WELCOME_KEY, 'true');
    setShowWelcome(false);
  };

  return (
    <StarProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: THEME.headerBackground },
          headerTintColor: THEME.textPrimary,
          headerTitleStyle: { fontSize: 16, fontWeight: '700' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="organization/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="webview" options={{ headerShown: false }} />
        <Stack.Screen name="calendar-subscribe" options={{ headerShown: false }} />
        <Stack.Screen name="help" options={{ headerShown: false }} />
      </Stack>
      <WelcomeModal visible={showWelcome} onDismiss={handleDismissWelcome} />
    </StarProvider>
  );
}

export default Sentry.wrap(RootLayout);
