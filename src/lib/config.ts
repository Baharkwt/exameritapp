import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

function resolveApiOrigin(): string {
  const raw = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001')
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');

  // If the configured URL uses localhost or 127.0.0.1, rewrite it for Android / physical devices:
  // - Android Emulator: `localhost` inside the emulator is the virtual device itself;
  //   `10.0.2.2` is the special alias to the host Mac's loopback interface.
  // - Physical Device (iOS or Android): use the Metro bundler's LAN IP if available.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw)) {
    if (Platform.OS === 'android' && !Device.isDevice) {
      return raw.replace(/\/\/(localhost|127\.0\.0\.1)/i, '//10.0.2.2');
    }
    if (Device.isDevice) {
      const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
      if (debuggerHost && debuggerHost !== 'localhost' && debuggerHost !== '127.0.0.1') {
        return raw.replace(/\/\/(localhost|127\.0\.0\.1)/i, `//${debuggerHost}`);
      }
    }
  }

  return raw;
}

/** Base URL without trailing slash or `/api` suffix. */
export const API_ORIGIN = resolveApiOrigin();
export const API_BASE_URL = `${API_ORIGIN}/api`;
