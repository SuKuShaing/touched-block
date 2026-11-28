// El porcentaje del reto lo guarda `GET /daily`: después de él hay que volver a pedir `/me`.
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/storage', () => ({ storage: { get: () => null, set: () => {}, remove: () => {} } }));
vi.mock('@/api/endpoints', () => ({}));

import { watchDailyForMe } from '@/api/hooks';

const tick = () => new Promise((r) => setTimeout(r, 10));

let qc: QueryClient;
let stops: (() => void)[] = [];
/** Cada llamada a `/me` queda pendiente hasta que el test la responde. */
let meCalls: ((v: string) => void)[] = [];

/** La consulta de `/me` montada, como `useMeRefresh`. */
function mountMe() {
  const obs = new QueryObserver<string>(qc, { queryKey: ['me', 'u1'], queryFn: () => new Promise<string>((r) => meCalls.push(r)), staleTime: 15_000 });
  stops.push(obs.subscribe(() => {}));
  return obs;
}
async function daily(date: string, viewer = 'u1', best = 2) {
  await qc.fetchQuery({ queryKey: ['daily', date, viewer], queryFn: async () => ({ date, streak: { current: 1, best } }), staleTime: 0 });
  await tick();
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  meCalls = [];
});
afterEach(() => {
  for (const s of stops) s();
  stops = [];
  qc.clear();
  vi.useRealTimers();
});

describe('/me después de /daily', () => {
  it('la petición de /me que salió antes se descarta: gana la de después', async () => {
    const me = mountMe();
    stops.push(watchDailyForMe(qc));
    await tick();
    expect(meCalls).toHaveLength(1); // en vuelo al responder /daily
    await daily('2026-12-10');
    expect(meCalls).toHaveLength(2);
    meCalls[1]('con porcentaje');
    meCalls[0]('sin porcentaje');
    await tick();
    expect(me.getCurrentResult().data).toBe('con porcentaje');
  });

  it('con /me recién traído (fresco) igual se vuelve a pedir', async () => {
    mountMe();
    await tick();
    meCalls[0]('sin porcentaje');
    await tick();
    stops.push(watchDailyForMe(qc));
    await daily('2026-12-10');
    expect(meCalls).toHaveLength(2);
  });

  it('sin bucles: una vez por fecha y por día cerrado, aunque miren varias pantallas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 11, 10, 12));
    mountMe();
    await tick();
    meCalls[0]('0');
    await tick();
    stops.push(watchDailyForMe(qc), watchDailyForMe(qc), watchDailyForMe(qc));
    await daily('2026-12-10');
    meCalls[1]('1');
    await tick();
    vi.setSystemTime(Date.UTC(2026, 11, 10, 13));
    await daily('2026-12-10'); // se vuelve a pedir /daily (después de una partida)
    expect(meCalls).toHaveLength(2);
    vi.setSystemTime(Date.UTC(2026, 11, 10, 15, 1)); // cerró el reto del 9
    await daily('2026-12-10');
    expect(meCalls).toHaveLength(3);
    meCalls[2]('2');
    await tick();
    await daily('2026-12-11');
    expect(meCalls).toHaveLength(4);
  });

  it('si /daily respondió antes de empezar a mirar, también', async () => {
    mountMe();
    await tick();
    await daily('2026-12-10');
    stops.push(watchDailyForMe(qc));
    await tick();
    expect(meCalls).toHaveLength(2);
  });

  it('no corresponde: invitado, cuenta sin ningún reto jugado u otra consulta', async () => {
    mountMe();
    stops.push(watchDailyForMe(qc));
    await tick();
    await daily('2026-12-10', 'guest');
    await daily('2026-12-10', 'u1', 0);
    await qc.fetchQuery({ queryKey: ['dailyLb', '2026-12-10', 'friends', null, 'u1'], queryFn: async () => ({}) });
    await tick();
    expect(meCalls).toHaveLength(1);
  });
});
