import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME } from '../lib/theme';
import { StarProvider } from '../contexts/StarContext';
import { setupPushNotifications } from '../lib/notifications';
import { WelcomeModal } from '../components/WelcomeModal';

const WELCOME_KEY = 'welcome:seen';

export default function RootLayout() {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    setupPushNotifications().catch((err) =>
      console.error('Push notification setup error:', err)
    );
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
          headerStyle: { backgroundColor: THEME.tabBarBackground },
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
