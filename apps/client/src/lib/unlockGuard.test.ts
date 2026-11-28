// `EXPO_PUBLIC_UNLOCK_ALL=1` desbloquea todos los premios y es solo para el APK de prueba: no
// puede colarse en un despliegue ni en el comando del APK que se reparte.
import { describe, expect, it } from 'vitest';

// fs de Node sin depender de @types/node (el cliente no los tiene); vitest corre en apps/client
const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as {
  readFileSync(path: string, enc: 'utf8'): string;
  readdirSync(path: string): string[];
};

const FLAG = 'EXPO_PUBLIC_UNLOCK_ALL';
/** Marca del comando del APK de prueba (`TB_TEST_APK=1`), el único que puede llevar la bandera. */
const TEST_APK = 'TB_TEST_APK';
/** Raíz del repositorio, vista desde apps/client. */
const ROOT = '../../';
const read = (p: string) => fs.readFileSync(ROOT + p, 'utf8').replace(/\r\n/g, '\n');
/** Une las líneas cortadas con `\` para leer cada comando completo. */
const commands = (text: string) => text.replace(/\\\n\s*/g, ' ').split('\n');

describe('la bandera de desbloqueo no llega a lo publicado', () => {
  it('ningún workflow la menciona', () => {
    const files = fs.readdirSync(`${ROOT}.github/workflows`);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(read(`.github/workflows/${f}`), f).not.toContain(FLAG);
  });

  it('el comando del APK de release (docs/despliegue.md) no la lleva', () => {
    const doc = read('docs/despliegue.md');
    const release = commands(doc).filter((l) => l.includes('assembleRelease') && !l.includes(TEST_APK));
    expect(release.length).toBeGreaterThan(0);
    for (const l of release) expect(l).not.toContain(FLAG);
    // tampoco exportada en una línea aparte, en un bloque de código que no sea el de prueba
    const blocks = doc.split('```').filter((_: string, i: number) => i % 2 === 1);
    for (const block of blocks) {
      if (!block.includes(TEST_APK)) expect(block).not.toContain(FLAG);
    }
  });

  it('ni la configuración del proyecto del cliente', () => {
    for (const f of ['apps/client/package.json', 'apps/client/app.json', 'apps/client/wrangler.jsonc']) {
      expect(read(f), f).not.toContain(FLAG);
    }
  });
});
