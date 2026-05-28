import { Linking, Platform } from 'react-native';

export interface MapLocation {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Open a location in the device's native maps app.
 *
 * iOS  → Apple Maps via maps:// scheme with coordinates + label.
 * Android → Google Maps web URL with coordinates (more reliable than
 *   the `geo:` scheme, which some apps interpret as a name search when
 *   a `?q=label` param is present).
 * Fallback → Google Maps search by address or name.
 */
export function openMaps(location: MapLocation): void {
  let url: string;
  const label = encodeURIComponent(location.name);

  if (location.latitude != null && location.longitude != null) {
    const lat = location.latitude;
    const lon = location.longitude;
    if (Platform.OS === 'ios') {
      url = `maps://maps.apple.com/?ll=${lat},${lon}&q=${label}`;
    } else {
      // Use coordinate-based query — avoids Android interpreting ?q as a name search
      url = `https://maps.google.com/?q=${lat},${lon}`;
    }
  } else if (location.address) {
    url = `https://maps.google.com/maps?q=${encodeURIComponent(location.address)}`;
  } else {
    url = `https://maps.google.com/maps?q=${label}`;
  }

  Linking.openURL(url).catch(console.error);
}
