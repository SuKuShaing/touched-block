import { describe, expect, it } from 'vitest';
import { appleDeviceOf, webPlatformOf } from './webPlatform';

const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

describe('webPlatformOf', () => {
  it('celulares y tablets son web_mobile', () => {
    expect(webPlatformOf({ userAgent: UA.chromeAndroid, userAgentData: { mobile: true } })).toBe('web_mobile');
    expect(webPlatformOf({ userAgent: UA.iphone, platform: 'iPhone', maxTouchPoints: 5 })).toBe('web_mobile');
    // Chrome en tablet Android: userAgentData.mobile es false, pero el UA dice Android
    expect(webPlatformOf({ userAgent: UA.androidTablet, userAgentData: { mobile: false } })).toBe('web_mobile');
    // iPadOS en modo escritorio: UA de Mac con pantalla táctil
    expect(webPlatformOf({ userAgent: UA.mac, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('web_mobile');
  });

  it('PC es web_desktop', () => {
    expect(webPlatformOf({ userAgent: UA.windows, platform: 'Win32', maxTouchPoints: 0, userAgentData: { mobile: false } })).toBe('web_desktop');
    expect(webPlatformOf({ userAgent: UA.mac, platform: 'MacIntel', maxTouchPoints: 0 })).toBe('web_desktop');
    // portátil con pantalla táctil (Windows): sigue siendo PC
    expect(webPlatformOf({ userAgent: UA.windows, platform: 'Win32', maxTouchPoints: 10 })).toBe('web_desktop');
  });

  it('sin datos: web_desktop', () => {
    expect(webPlatformOf(null)).toBe('web_desktop');
    expect(webPlatformOf({})).toBe('web_desktop');
  });
});

describe('appleDeviceOf', () => {
  it('iPhone y iPad (también iPadOS en modo escritorio) son ios; Mac es mac', () => {
    expect(appleDeviceOf({ userAgent: UA.iphone, platform: 'iPhone', maxTouchPoints: 5 })).toBe('ios');
    expect(appleDeviceOf({ userAgent: UA.mac, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios');
    expect(appleDeviceOf({ userAgent: UA.mac, platform: 'MacIntel', maxTouchPoints: 0 })).toBe('mac');
  });

  it('Android, Windows o sin datos: null', () => {
    expect(appleDeviceOf({ userAgent: UA.chromeAndroid, userAgentData: { mobile: true } })).toBeNull();
    expect(appleDeviceOf({ userAgent: UA.windows, platform: 'Win32' })).toBeNull();
    expect(appleDeviceOf(null)).toBeNull();
    expect(appleDeviceOf({})).toBeNull();
  });
});
