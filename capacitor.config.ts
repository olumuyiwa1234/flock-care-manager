import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.45d98a9b6adb4236832ae226c0bad88a',
  appName: 'Shepherd',
  webDir: 'dist',
  server: {
    // Loads the live Lovable build inside the native shell (hot reload while developing).
    // Swap to your published URL (https://flock-care-manager.lovable.app) for release builds.
    url: 'https://45d98a9b-6adb-4236-832a-e226c0bad88a.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    Geolocation: {},
  },
};

export default config;
