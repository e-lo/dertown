import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { THEME } from '../lib/theme';
import { StarProvider } from '../contexts/StarContext';
import { BlockProvider } from '../contexts/BlockContext';
import { WelcomeModal } from '../components/WelcomeModal';
import { loadTermsAgreed, saveTermsAgreed } from '../lib/moderation';

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.1,
    debug: __DEV__,
  });
}

function RootLayout() {
  const [showWelcome, setShowWelcome] = useState(false);

  // The welcome screen doubles as the terms-of-use agreement gate: it blocks
  // the app until the user agrees (App Store Guideline 1.2).
  useEffect(() => {
    loadTermsAgreed().then((agreed) => {
      if (!agreed) setShowWelcome(true);
    });
  }, []);

  const handleAgreeWelcome = async () => {
    await saveTermsAgreed();
    setShowWelcome(false);
  };

  return (
    <StarProvider>
      <BlockProvider>
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
      <WelcomeModal visible={showWelcome} onDismiss={handleAgreeWelcome} />
      </BlockProvider>
    </StarProvider>
  );
}

export default Sentry.wrap(RootLayout);
