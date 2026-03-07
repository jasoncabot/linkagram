import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jasoncabot.linkagram',
  appName: 'Linkagram',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#1A0A2E',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0 },
  },
};

export default config;
