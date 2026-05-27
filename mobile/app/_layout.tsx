import { Stack } from 'expo-router';
import { THEME } from '../lib/theme';
import { StarProvider } from '../contexts/StarContext';

export default function RootLayout() {
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
        <Stack.Screen name="event/[id]" options={{ title: 'Event Details' }} />
      </Stack>
    </StarProvider>
  );
}
