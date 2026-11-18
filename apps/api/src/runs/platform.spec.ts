import { describe, expect, it } from 'vitest';
import { isRunPlatform, platformFromUserAgent, resolvePlatform } from './platform';

const UA = {
  rnAndroid: 'okhttp/4.12.0',
  dalvik: 'Dalvik/2.1.0 (Linux; U; Android 14; Pixel 8 Build/AP2A.240805.005)',
  rnIos: 'TouchedBlock/1 CFNetwork/1498.700.2 Darwin/23.6.0',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  safariIpadMobile:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0',
  chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
};

describe('platformFromUserAgent', () => {
  it('la app nativa', () => {
    expect(platformFromUserAgent(UA.rnAndroid)).toBe('app_android');
    expect(platformFromUserAgent(UA.dalvik)).toBe('app_android');
    expect(platformFromUserAgent(UA.rnIos)).toBe('app_ios');
  });

  it('navegadores de celular y tablet', () => {
    for (const ua of [UA.chromeAndroid, UA.androidTablet, UA.safariIphone, UA.safariIpadMobile, UA.firefoxAndroid]) {
      expect(platformFromUserAgent(ua), ua).toBe('web_mobile');
    }
  });

  it('navegadores de PC', () => {
    for (const ua of [UA.chromeWindows, UA.safariMac, UA.firefoxLinux]) {
      expect(platformFromUserAgent(ua), ua).toBe('web_desktop');
    }
  });

  it('sin UA o con uno que no es ni la app ni un navegador: null', () => {
    for (const ua of [undefined, null, '', '   ', 'curl/8.4.0', 'node-superagent/3.8.3', 'PostmanRuntime/7.39.0']) {
      expect(platformFromUserAgent(ua), String(ua)).toBeNull();
    }
  });
});

describe('resolvePlatform', () => {
  it('manda el valor del cliente si es conocido', () => {
    expect(resolvePlatform('web_mobile', UA.chromeWindows)).toBe('web_mobile');
    expect(resolvePlatform('app_ios', undefined)).toBe('app_ios');
  });

  it('un valor desconocido o de otro tipo se ignora y se usa el User-Agent', () => {
    expect(resolvePlatform('smart_tv', UA.chromeAndroid)).toBe('web_mobile');
    expect(resolvePlatform('WEB_MOBILE', UA.chromeWindows)).toBe('web_desktop');
    expect(resolvePlatform(42, UA.rnAndroid)).toBe('app_android');
    expect(resolvePlatform({ x: 1 }, undefined)).toBeNull();
    expect(resolvePlatform(undefined, undefined)).toBeNull();
  });

  it('isRunPlatform: solo la lista cerrada', () => {
    expect(['app_android', 'app_ios', 'web_mobile', 'web_desktop'].every(isRunPlatform)).toBe(true);
    expect(isRunPlatform('web')).toBe(false);
    expect(isRunPlatform(null)).toBe(false);
  });
});
