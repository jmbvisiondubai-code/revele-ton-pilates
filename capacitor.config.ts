import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.reveletonpilates.app',
  appName: 'Révèle ton Pilates',
  webDir: 'out',

  // L'app native charge directement le site Vercel
  // → toute mise à jour du code est instantanée sans republier sur les stores
  server: {
    url: 'https://revele-ton-pilates.vercel.app',
    cleartext: false,
  },

  android: {
    backgroundColor: '#FAF6F1',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  ios: {
    backgroundColor: '#FAF6F1',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Révèle ton Pilates',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FAF6F1',
      overlaysWebView: false,
    },
  },
}

export default config
