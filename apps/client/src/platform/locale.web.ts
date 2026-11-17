import type { DeviceLocale } from './locale.types';

// En la web basta con navigator.languages e Intl (ver src/lib/countries.ts): no hay datos extra.
export const deviceLocale: DeviceLocale = {
  regions: () => [],
  countryNameFallback: () => null,
};
