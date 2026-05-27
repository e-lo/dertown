import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { registerPushToken } from './api';
import { APP_CONFIG } from './app-config';

/**
 * Request push notification permissions, get an Expo push token,
 * and register it with the Dertown backend.
 *
 * No-ops on simulators/emulators (requires a physical device).
 * Errors are logged but not re-thrown — push is best-effort.
 */
export async function setupPushNotifications(): Promise<void> {
  // Physical device required for push notifications
  if (!Device.isDevice) return;

  // Android requires an explicit notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: APP_CONFIG.notificationChannelName,
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  // Get the Expo push token and register it
  const { data: token } = await Notifications.getExpoPushTokenAsync();
  await registerPushToken(token, Platform.OS as 'ios' | 'android');
}
