import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.downuptiles.app',
  appName: 'downuptiles',
  webDir: 'dist',
  backgroundColor: '#101315',
  android: { backgroundColor: '#101315' },
  plugins: {
    SystemBars: { style: 'DARK', insetsHandling: 'native', initialViewportFitValueHint: 'cover' },
  },
};

export default config;
