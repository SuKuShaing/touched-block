// Las `EXPO_PUBLIC_*` quedan dentro del bundle: un release no puede reutilizar el del APK de prueba.
import { describe, expect, it } from 'vitest';

// fs de Node sin depender de @types/node (el cliente no los tiene); vitest corre en apps/client
const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync(path: string, enc: 'utf8'): string };
const read = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

type Cfg = { modResults: { contents: string } };

/** Corre el config plugin sobre un build.gradle, sin Expo. */
function apply(gradle: string): string {
  const mod = { exports: null as unknown as (c: Cfg) => Cfg };
  const fakeRequire = () => ({ withAppBuildGradle: (c: Cfg, fn: (c: Cfg) => Cfg) => fn(c) });
  new Function('require', 'module', read('plugins/withReleaseSigning.js'))(fakeRequire, mod);
  return mod.exports({ modResults: { contents: gradle } }).modResults.contents;
}

describe('bundle de release', () => {
  const out = apply('android {}\n');

  it('Gradle declara las variables y los .env como entradas de la tarea del bundle', () => {
    expect(out).toContain('it.name.startsWith("createBundle") && it.name.endsWith("JsAndAssets")');
    expect(out).toContain('it.key.startsWith("EXPO_PUBLIC_") || it.key == "TB_TEST_APK"');
    expect(out).toContain('t.inputs.property("tbPublicEnv"');
    expect(out).toContain('".env", ".env.local", ".env.production", ".env.production.local"');
  });

  it('aplicarlo de nuevo (prebuild sin --clean) no duplica el bloque', () => {
    expect(apply(out)).toBe(out);
  });

  it('docs/despliegue.md limpia Gradle y la caché de Metro antes del release', () => {
    const blocks = read('../../docs/despliegue.md')
      .split('```')
      .filter((_, i) => i % 2 === 1);
    const release = blocks.find((b) => b.includes('app:assembleRelease'))!;
    const at = release.indexOf('app:assembleRelease');
    expect(release.indexOf('./gradlew clean')).toBeGreaterThan(-1);
    expect(release.indexOf('./gradlew clean')).toBeLessThan(at);
    expect(release.indexOf('metro-cache')).toBeGreaterThan(-1);
    expect(release.indexOf('metro-cache')).toBeLessThan(at);
  });
});
