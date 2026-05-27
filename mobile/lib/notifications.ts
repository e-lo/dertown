import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken } from './api';
import { APP_CONFIG } from './app-config';

/**
 * Request push notification permissions, get an Expo push token,
 * and register it with the Dertown backend.
 *
 * No-ops on:
 *   - Simulators / emulators (no push support)
 *   - Expo Go (remote push removed in SDK 53; use a development build)
 *   - Builds without an EAS projectId configured
 *
 * Errors are logged but not re-thrown — push is best-effort.
 */
export async function setupPushNotifications(): Promise<void> {
  // Physical device required for push notifications
  if (!Device.isDevice) return;

  // EAS projectId is required for getExpoPushTokenAsync.
  // It is absent in Expo Go and bare projects that haven't run `eas init`.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
      ?.projectId;

  if (!projectId) {
    // Running in Expo Go or a build without EAS set up.
    // Push notifications are unavailable — this is expected in development.
    return;
  }

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
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerPushToken(token, Platform.OS as 'ios' | 'android');
}
