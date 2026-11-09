import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestApp, type TestUser, bearer, createTestApp } from './helpers/app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
  await t.reset();
});
afterAll(async () => {
  await t?.app.close();
});

const names = (body: { entries: { username: string }[] }) => body.entries.map((e) => e.username);

describe('rankings', () => {
  let ana: TestUser; // CL, 5
  let beto: TestUser; // CL, 3
  let ciro: TestUser; // AR, 7
  let dani: TestUser; // CL, sin partidas

  beforeAll(async () => {
    ana = await t.login('lb-a', 'Ana', 'CL');
    beto = await t.login('lb-b', 'Beto', 'CL');
    ciro = await t.login('lb-c', 'Ciro', 'AR');
    dani = await t.login('lb-d', 'Dani', 'CL');
    for (const [u, kills] of [
      [ana, 5],
      [beto, 3],
      [ciro, 7],
    ] as const) {
      const { finish } = await t.playRun(u, { kills });
      expect(finish.body.valid).toBe(true);
    }
  });

  it('mundial: ordenado por destruidos, con mi posición', async () => {
    for (const period of ['week', 'month', 'year', 'all']) {
      const res = await t.http().get('/leaderboards').query({ scope: 'world', period }).set(bearer(ana)).expect(200);
      expect(names(res.body)).toEqual(['ciro', 'ana', 'beto']);
      expect(res.body.entries[0]).toMatchObject({ rank: 1, username: 'ciro', country: 'AR', killed: 7 });
      expect(res.body.me).toMatchObject({ rank: 2, killed: 5 });
      expect(res.body.total).toBe(3);
    }
    const anon = await t.http().get('/leaderboards').query({ scope: 'world', period: 'week' }).expect(200);
    expect(anon.body.me).toBeUndefined();
    expect(anon.body.periodKey).toMatch(/^\d{4}-W\d{2}$/);
    const none = await t.http().get('/leaderboards').query({ scope: 'world' }).set(bearer(dani)).expect(200);
    expect(none.body.me).toBeNull();
  });

  it('país: usa mi país por defecto o el indicado', async () => {
    let res = await t.http().get('/leaderboards').query({ scope: 'country', period: 'month' }).set(bearer(beto)).expect(200);
    expect(res.body.country).toBe('CL');
    expect(names(res.body)).toEqual(['ana', 'beto']);
    expect(res.body.me).toMatchObject({ rank: 2, killed: 3 });

    res = await t.http().get('/leaderboards').query({ scope: 'country', country: 'ar' }).expect(200);
    expect(names(res.body)).toEqual(['ciro']);
    // Beto mirando Argentina: no aparece
    res = await t.http().get('/leaderboards').query({ scope: 'country', country: 'AR' }).set(bearer(beto)).expect(200);
    expect(res.body.me).toBeNull();

    await t.http().get('/leaderboards').query({ scope: 'country' }).expect(400);
    await t.http().get('/leaderboards').query({ scope: 'galaxia' }).expect(400);
  });

  it('amigos: a quienes sigo más yo', async () => {
    await t.http().get('/leaderboards').query({ scope: 'friends' }).expect(401);
    await t.http().post(`/follows/${ana.id}`).set(bearer(beto)).expect(204);
    let res = await t.http().get('/leaderboards').query({ scope: 'friends', period: 'all' }).set(bearer(beto)).expect(200);
    expect(names(res.body)).toEqual(['ana', 'beto']);
    expect(res.body.me).toMatchObject({ rank: 2 });

    await t.http().post(`/follows/${ciro.id}`).set(bearer(beto)).expect(204);
    res = await t.http().get('/leaderboards').query({ scope: 'friends' }).set(bearer(beto)).expect(200);
    expect(names(res.body)).toEqual(['ciro', 'ana', 'beto']);
    expect(res.body.me.rank).toBe(3);

    // a Ana nadie la sigue de vuelta: solo ella
    res = await t.http().get('/leaderboards').query({ scope: 'friends' }).set(bearer(ana)).expect(200);
    expect(names(res.body)).toEqual(['ana']);
    expect(res.body.me.rank).toBe(1);
  });

  it('a igual cantidad de destruidos gana quien escapó menos, y luego quien llegó antes', async () => {
    const eva = await t.login('lb-e', 'Eva', 'CL');
    const { finish } = await t.playRun(eva, { kills: 5 });
    expect(finish.body.valid).toBe(true);
    const res = await t.http().get('/leaderboards').query({ scope: 'country' }).set(bearer(eva)).expect(200);
    const anaRow = res.body.entries.find((e: { username: string }) => e.username === 'ana');
    const evaRow = res.body.entries.find((e: { username: string }) => e.username === 'eva');
    const evaFirst = evaRow.missed < anaRow.missed;
    expect(evaRow.rank < anaRow.rank).toBe(evaFirst);
    expect(res.body.me.rank).toBe(evaRow.rank);
  });
});

describe('social', () => {
  it('quién te invitó: una sola vez, nunca uno mismo; ambos se siguen; corazones hasta 8', async () => {
    const host = await t.login('inv-host', 'Anfitrion');
    let res = await t.http().post('/me/inviter').set(bearer(host)).send({ username: host.username }).expect(400);
    expect(res.body.code).toBe('inviter_self');
    res = await t.http().post('/me/inviter').set(bearer(host)).send({ username: 'no.existe' }).expect(404);

    const expected = [6, 7, 8, 8];
    for (let i = 0; i < 4; i++) {
      const g = await t.login(`inv-g${i}`, `Invitado ${i}`);
      res = await t.http().post('/me/inviter').set(bearer(g)).send({ username: `@${host.username.toUpperCase()}` }).expect(200);
      expect(res.body).toMatchObject({ inviter: { id: host.id }, inviterInvitedCount: i + 1, inviterMaxLives: expected[i] });
      if (i === 0) {
        // solo una vez
        const other = await t.login('inv-other', 'Otro');
        res = await t.http().post('/me/inviter').set(bearer(g)).send({ username: other.username }).expect(409);
        expect(res.body.code).toBe('inviter_already_set');
        // se siguen mutuamente
        const f1 = await t.http().get('/me/following').set(bearer(g)).expect(200);
        expect(f1.body.users.map((u: { id: string }) => u.id)).toEqual([host.id]);
        const me = await t.http().get('/me').set(bearer(g)).expect(200);
        expect(me.body.invitedBy).toEqual({ id: host.id, username: host.username });
      }
    }
    const me = await t.http().get('/me').set(bearer(host)).expect(200);
    expect(me.body).toMatchObject({ invitedCount: 4, maxLives: 8, followersCount: 4, followingCount: 4 });
    const run = await t.http().post('/runs').set(bearer(host)).send({ fieldW: 390, fieldH: 640 }).expect(201);
    expect(run.body.maxLives).toBe(8);
    const profile = await t.http().get(`/users/${host.username}`).expect(200);
    expect(profile.body.invitedCount).toBe(4);
  });

  it('seguir y dejar de seguir', async () => {
    const a = await t.login('f-a', 'Fa');
    const b = await t.login('f-b', 'Fb');
    await t.http().post(`/follows/${a.id}`).set(bearer(a)).expect(400);
    await t.http().post('/follows/00000000-0000-4000-8000-000000000000').set(bearer(a)).expect(404);
    await t.http().post(`/follows/${b.id}`).set(bearer(a)).expect(204);
    await t.http().post(`/follows/${b.id}`).set(bearer(a)).expect(204); // idempotente
    let prof = await t.http().get(`/users/${b.username}`).set(bearer(a)).expect(200);
    expect(prof.body).toMatchObject({ isFollowing: true, isMe: false, followersCount: 1 });
    const s = await t.http().get('/users/search').query({ q: 'f' }).set(bearer(a)).expect(200);
    expect(s.body.users.find((u: { id: string }) => u.id === b.id).isFollowing).toBe(true);
    await t.http().delete(`/follows/${b.id}`).set(bearer(a)).expect(204);
    prof = await t.http().get(`/users/${b.username}`).set(bearer(a)).expect(200);
    expect(prof.body.isFollowing).toBe(false);
  });
});
