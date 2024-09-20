import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'us.materialio.app',
  appName: 'Materialious',
  webDir: 'build',
  plugins: {
    CapacitorHttp: {
      enabled: false
    },
    CapacitorNodeJS: {
      nodeDir: 'nodejs-android'
    }
  },
};

export default config;
