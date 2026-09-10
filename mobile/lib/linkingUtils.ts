import { Alert, Linking } from 'react-native';

/**
 * Open a URL that hands off to another app (mail, phone), showing the user
 * the contact detail instead of failing silently when no app can handle it.
 *
 * On iOS, `Linking.openURL` rejects with "Unable to open URL" when the
 * device has no app registered for the scheme — e.g. the built-in Mail app
 * was deleted, or `tel:` on an iPad. That rejection was previously unhandled
 * and surfaced in Sentry while the user saw nothing happen on tap.
 */
async function openUrlWithFallback(url: string, fallbackTitle: string, fallbackMessage: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(fallbackTitle, fallbackMessage);
  }
}

export function openMailto(email: string, subject?: string): Promise<void> {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return openUrlWithFallback(
    `mailto:${email}${query}`,
    'No mail app available',
    `You can reach us at ${email}.`
  );
}

export function openTel(phone: string): Promise<void> {
  const digits = phone.replace(/\D/g, '');
  return openUrlWithFallback(
    `tel:${digits}`,
    'No phone app available',
    `You can call ${phone} from another device.`
  );
}
