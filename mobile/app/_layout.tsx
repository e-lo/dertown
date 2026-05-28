import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { THEME } from '../lib/theme';
import { StarProvider } from '../contexts/StarContext';
import { setupPushNotifications } from '../lib/notifications';

export default function RootLayout() {
  useEffect(() => {
    setupPushNotifications().catch((err) =>
      console.error('Push notification setup error:', err)
    );
  }, []);

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
      </Stack>
    </StarProvider>
  );
}
