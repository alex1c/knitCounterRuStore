/**
 * Jest mocks for native AppMetrica / Yandex Mobile Ads SDKs.
 */

jest.mock('@appmetrica/react-native-analytics', () => ({
  __esModule: true,
  default: {
    activate: jest.fn(),
    reportEvent: jest.fn(),
  },
}));

jest.mock('yandex-mobile-ads', () => ({
  MobileAds: { initialize: jest.fn(async () => undefined) },
  InterstitialAdLoader: {
    create: jest.fn(async () => ({
      loadAd: jest.fn(async () => null),
    })),
  },
  InterstitialAd: {},
  BannerView: () => null,
  BannerAdSize: {
    stickySize: jest.fn(async () => ({ width: 320, height: 50 })),
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.0.0' },
  },
}));
