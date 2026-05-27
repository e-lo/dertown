import { Stack } from 'expo-router';
import { THEME } from '../lib/theme';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: THEME.tabBarBackground },
        headerTintColor: THEME.textPrimary,
        headerTitleStyle: { fontSize: 16, fontWeight: '700' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="event/[id]" options={{ title: 'Event Details' }} />
    </Stack>
  );
}
