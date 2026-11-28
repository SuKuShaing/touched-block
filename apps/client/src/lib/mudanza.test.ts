import { describe, expect, it } from 'vitest';

/**
 * Mudanza de la web vieja (GitHub Pages) a https://web.touchedblock.app: se ejecutan los scripts
 * reales de deploy/gh-pages-redirect/index.html (lado viejo) y del <head> de public/index.html
 * (lado nuevo, `tb-mudanza`) con un navegador falso.
 */
// fs de Node sin depender de @types/node (el cliente no los tiene); vitest corre en apps/client
const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync(path: string, enc: 'utf8'): string };
const read = (rel: string) => fs.readFileSync(rel, 'utf8');
const NEW_JS = read('public/index.html').match(/<script id="tb-mudanza">([\s\S]*?)<\/script>/)![1];
const OLD_HTML = read('../../deploy/gh-pages-redirect/index.html');
const OLD_JS = OLD_HTML.match(/<script>([\s\S]*?)<\/script>/)![1];

const VIEJA = 'https://sukushaing.github.io';
const NUEVA = 'https://web.touchedblock.app';

class Mem {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  obj() {
    return Object.fromEntries(this.m);
  }
}

interface Run {
  replaced: string | null;
  href: string;
  win: Record<string, unknown>;
}

function run(js: string, url: string, ls: Mem, opts: { referrer?: string; ua?: string } = {}): Run {
  const u = new URL(url);
  const out: Run = { replaced: null, href: url, win: { localStorage: ls } };
  const location = {
    get hostname() {
      return u.hostname;
    },
    get pathname() {
      return u.pathname;
    },
    get search() {
      return u.search;
    },
    get hash() {
      return u.hash;
    },
    get href() {
      return u.href;
    },
    replace(to: string) {
      out.replaced = to;
    },
  };
  const history = {
    state: null,
    replaceState(_s: unknown, _t: string, to: string) {
      const n = new URL(to, u.href);
      u.hash = n.hash;
      u.search = n.search;
      u.pathname = n.pathname;
      out.href = u.href;
    },
  };
  const document = { referrer: opts.referrer ?? '', addEventListener() {}, getElementById: () => null };
  const navigator = { userAgent: opts.ua ?? 'Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile' };
  new Function('window', 'location', 'history', 'document', 'navigator', js)(out.win, location, history, document, navigator);
  out.href = u.href;
  return out;
}

/** Datos de un jugador antiguo en sukushaing.github.io (más una clave de otro proyecto). */
function oldStorage() {
  const ls = new Mem();
  const d = (n: number) => 1_790_000_000_000 + n * 86_400_000;
  ls.setItem('tb_best6', '87');
  ls.setItem('tb_hist6', JSON.stringify([{ k: 87, m: 1, d: d(3), t: 21600, s: 31 }, { k: 40, m: 2, d: d(1), t: 9000, s: 12 }]));
  ls.setItem('tb_stats2', JSON.stringify({ bestTicks: 21600, bestStreak: 31, totalKilled: 1500, runs: 64, bonusXp: 120 }));
  ls.setItem('tb_set1', JSON.stringify({ sound: true }));
  ls.setItem('tb_onb1', '1');
  ls.setItem('tb_onb_adv1', '1');
  ls.setItem('tb_visits1', '7');
  ls.setItem('tb_last1', String(d(3)));
  ls.setItem('tb_unlock1', '1');
  ls.setItem('tb_miss2', JSON.stringify({ '2026-11-10': ['a', 'b'] }));
  ls.setItem('tb_cele2', JSON.stringify(['tier:0', 'tier:1']));
  ls.setItem(
    'tb_daily2',
    JSON.stringify({
      days: { '2026-11-10': { used: 1, runs: [{ k: 30, m: 1, t: 5000, s: 9, d: d(2) }] } },
      played: ['2026-11-09', '2026-11-10'],
      rulesSeen: true,
      yesterdaySeen: '2026-11-10',
      bestPct: 70,
    }),
  );
  ls.setItem('tb_rt1', 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde');
  ls.setItem('tb_me2', JSON.stringify({ id: 'u1', username: 'jugador_viejo', displayName: 'Sebastián Ñuñez' }));
  ls.setItem('otro_proyecto', 'NO');
  return ls;
}

/** Lado viejo: a dónde manda (con el paquete en el fragmento). */
function fromOld(path: string, ls = oldStorage()) {
  return run(OLD_JS, VIEJA + path, ls).replaced!;
}

describe('página vieja (GitHub Pages)', () => {
  it('conserva ruta y parámetros, y manda solo las claves del juego', () => {
    const to = fromOld('/touched-block/como-jugar?nivel=basico');
    expect(to.startsWith(`${NUEVA}/como-jugar?nivel=basico#tbmigrar=`)).toBe(true);
    const b = to.split('#tbmigrar=')[1];
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
    expect(json.v).toBe(1);
    expect(json.d.otro_proyecto).toBeUndefined();
    expect(Object.keys(json.d)).toHaveLength(14); // todas las sembradas (no hay tb_reto1)
  });

  it('sin datos no agrega fragmento; las páginas legales van a la landing', () => {
    expect(fromOld('/touched-block/?reto=K7M2QXAB', new Mem())).toBe(`${NUEVA}/?reto=K7M2QXAB`);
    expect(fromOld('/touched-block/politica-de-privacidad/')).toBe('https://touchedblock.app/privacidad/');
  });

  it('volver: solo rutas relativas seguras', () => {
    expect(fromOld('/touched-block/?volver=' + encodeURIComponent('/?reto=K7M2QXAB'), new Mem())).toBe(`${NUEVA}/?reto=K7M2QXAB`);
    for (const bad of ['//evil.com/x', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '/a\nb']) {
      expect(fromOld('/touched-block/?volver=' + encodeURIComponent(bad), new Mem())).toBe(`${NUEVA}/`);
    }
  });
});

describe('sitio nuevo: importar #tbmigrar', () => {
  it('importa todo en un navegador nuevo y borra el fragmento', () => {
    const ls = new Mem();
    const r = run(NEW_JS, fromOld('/touched-block/como-jugar?nivel=basico'), ls, { referrer: VIEJA + '/' });
    expect(r.href).toBe(`${NUEVA}/como-jugar?nivel=basico`);
    expect(r.replaced).toBeNull();
    const o = oldStorage().obj();
    for (const k of Object.keys(o)) if (k !== 'otro_proyecto') expect(ls.getItem(k)).toBe(o[k]);
    expect(ls.getItem('otro_proyecto')).toBeNull();
    expect(ls.getItem('tb_mig1')).toBe('1');
  });

  it('un enlace fabricado (sin referrer de la web vieja) no cambia nada, pero se limpia', () => {
    const ls = new Mem();
    ls.setItem('tb_best6', '10');
    const r = run(NEW_JS, fromOld('/touched-block/?reto=X'), ls, { referrer: '' });
    expect(r.href).toBe(`${NUEVA}/?reto=X`);
    expect(ls.obj()).toEqual({ tb_best6: '10' });
    const r2 = run(NEW_JS, fromOld('/touched-block/'), ls, { referrer: 'https://evil.example/' });
    expect(r2.href).toBe(`${NUEVA}/`);
    expect(ls.obj()).toEqual({ tb_best6: '10' });
  });

  it('borra un #tbmigrar inválido o enorme sin romper', () => {
    const ls = new Mem();
    expect(run(NEW_JS, `${NUEVA}//x?a=1#tbmigrar=%%%`, ls, { referrer: VIEJA }).href).toBe(`${NUEVA}//x?a=1`);
    expect(run(NEW_JS, `${NUEVA}/#tbmigrar=${'A'.repeat(500_000)}`, ls, { referrer: VIEJA }).href).toBe(`${NUEVA}/`);
    expect(ls.getItem('tb_best6')).toBeNull();
  });

  it('mezcla con lo que ya hay aquí sin bajar nada ni contar doble', () => {
    const ls = new Mem();
    const dn = 1_795_000_000_000;
    ls.setItem('tb_best6', '120');
    ls.setItem('tb_hist6', JSON.stringify([{ k: 120, m: 0, d: dn, t: 30000, s: 50 }]));
    ls.setItem('tb_stats2', JSON.stringify({ bestTicks: 30000, bestStreak: 50, totalKilled: 120, runs: 1, bonusXp: 0 }));
    ls.setItem('tb_set1', JSON.stringify({ sound: false }));
    ls.setItem('tb_visits1', '2');
    ls.setItem('tb_cele2', JSON.stringify(['tier:0', 'tier:2']));
    ls.setItem('tb_miss2', JSON.stringify({ '2026-11-10': ['b', 'c'] }));
    ls.setItem(
      'tb_daily2',
      JSON.stringify({
        days: { '2026-11-10': { used: 1, runs: [{ k: 50, m: 0, t: 8000, s: 20, d: dn }], claim: { runId: 'r', claimToken: 't' } } },
        played: ['2026-11-10', '2026-11-16'],
        rulesSeen: false,
        yesterdaySeen: null,
        bestPct: 40,
      }),
    );
    ls.setItem('tb_rt1', 'SesionNuevaSesionNuevaSesionNueva');
    ls.setItem('tb_me2', JSON.stringify({ id: 'u2', username: 'nuevo' }));
    const url = fromOld('/touched-block/');
    for (let i = 0; i < 2; i++) run(NEW_JS, url, ls, { referrer: VIEJA + '/' }); // dos veces: mismo resultado
    expect(ls.getItem('tb_best6')).toBe('120');
    expect(JSON.parse(ls.getItem('tb_stats2')!)).toEqual({ bestTicks: 30000, bestStreak: 50, totalKilled: 1500, runs: 64, bonusXp: 120 });
    expect(JSON.parse(ls.getItem('tb_hist6')!).map((g: { k: number }) => g.k)).toEqual([120, 87, 40]);
    expect(ls.getItem('tb_set1')).toBe(JSON.stringify({ sound: false }));
    expect(ls.getItem('tb_visits1')).toBe('7');
    expect(ls.getItem('tb_onb1')).toBe('1');
    expect(JSON.parse(ls.getItem('tb_cele2')!)).toEqual(['tier:0', 'tier:2', 'tier:1']);
    expect(JSON.parse(ls.getItem('tb_miss2')!)).toEqual({ '2026-11-10': ['b', 'c', 'a'] });
    const daily = JSON.parse(ls.getItem('tb_daily2')!);
    expect(daily.played).toEqual(['2026-11-09', '2026-11-10', '2026-11-16']);
    expect(daily.rulesSeen).toBe(true);
    expect(daily.yesterdaySeen).toBe('2026-11-10');
    expect(daily.bestPct).toBe(70);
    expect(daily.days['2026-11-10'].used).toBe(1);
    expect(daily.days['2026-11-10'].runs).toHaveLength(2);
    expect(daily.days['2026-11-10'].claim).toEqual({ runId: 'r', claimToken: 't' });
    // la sesión del sitio nuevo no se cambia
    expect(ls.getItem('tb_rt1')).toBe('SesionNuevaSesionNuevaSesionNueva');
    expect(JSON.parse(ls.getItem('tb_me2')!).username).toBe('nuevo');
  });
});

describe('claves de antes del reinicio de datos', () => {
  const OLD_KEYS = ['tb_best5', 'tb_hist5', 'tb_stats1', 'tb_daily1', 'tb_miss1', 'tb_cele1', 'tb_me1'];
  const NEW_KEYS = ['tb_best6', 'tb_hist6', 'tb_stats2', 'tb_daily2', 'tb_miss2', 'tb_cele2', 'tb_me2'];
  const RT = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';

  /** Un jugador de la web vieja de verdad: los mismos datos, con los nombres de antes. */
  const beforeReset = () => {
    const now = oldStorage();
    const ls = new Mem();
    ls.setItem('tb_rt1', RT);
    ls.setItem('tb_onb1', '1');
    OLD_KEYS.forEach((k, i) => ls.setItem(k, now.getItem(NEW_KEYS[i])!));
    return ls;
  };

  it('la página vieja ya no las manda', () => {
    const b = fromOld('/touched-block/', beforeReset()).split('#tbmigrar=')[1];
    const json = JSON.parse(atob(b.replace(/-/g, '+').replace(/_/g, '/')));
    expect(Object.keys(json.d).sort()).toEqual(['tb_onb1', 'tb_rt1']);
  });

  it('un fragmento que las trae no escribe ni las viejas ni las nuevas', () => {
    // como lo arma una copia en caché de la página vieja (con sus claves de entonces)
    const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, d: beforeReset().obj() }));
    const b = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const ls = new Mem();
    run(NEW_JS, `${NUEVA}/#tbmigrar=${b}`, ls, { referrer: VIEJA + '/' });
    expect(ls.obj()).toEqual({ tb_rt1: RT, tb_onb1: '1', tb_mig1: '1' });
  });
});

describe('sitio nuevo: ida y vuelta', () => {
  it('la 1.ª visita sale a la web vieja (marca antes) y vuelve a la misma dirección con los datos', () => {
    const nuevo = new Mem();
    const ida = run(NEW_JS, `${NUEVA}/?reto=K7M2QXAB`, nuevo);
    expect(nuevo.getItem('tb_mig1')).toBe('1');
    expect(ida.win.__tbMudanza).toBe(true);
    expect(ida.replaced).toBe(`${VIEJA}/touched-block/?volver=${encodeURIComponent('/?reto=K7M2QXAB')}`);
    const vuelta = fromOld(new URL(ida.replaced!).pathname + new URL(ida.replaced!).search);
    expect(vuelta.startsWith(`${NUEVA}/?reto=K7M2QXAB#tbmigrar=`)).toBe(true);
    const fin = run(NEW_JS, vuelta, nuevo, { referrer: VIEJA + '/' });
    expect(fin.href).toBe(`${NUEVA}/?reto=K7M2QXAB`);
    expect(fin.replaced).toBeNull();
    expect(nuevo.getItem('tb_best6')).toBe('87');
    // la siguiente visita ya no sale
    expect(run(NEW_JS, `${NUEVA}/`, nuevo).replaced).toBeNull();
  });

  it('no sale con ?volver, para bots, en localhost ni sin almacenamiento que dure', () => {
    expect(run(NEW_JS, `${NUEVA}/?volver=%2F`, new Mem()).replaced).toBeNull();
    expect(run(NEW_JS, `${NUEVA}/`, new Mem(), { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' }).replaced).toBeNull();
    expect(run(NEW_JS, 'http://localhost:8081/', new Mem()).replaced).toBeNull();
    const roto = new Mem();
    roto.setItem = () => {};
    expect(run(NEW_JS, `${NUEVA}/`, roto).replaced).toBeNull();
  });
});
