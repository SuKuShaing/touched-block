import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RULES_VERSION } from '@tb/engine';
import { type TestApp, bearer, createTestApp } from './helpers/app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
  await t.reset();
});
afterAll(async () => {
  await t?.app.close();
});

describe('salud', () => {
  it('GET /health responde ok con la base', async () => {
    const res = await t.http().get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok', rulesVersion: RULES_VERSION });
  });

  it('CORS permite el origen configurado', async () => {
    const res = await t.http().options('/runs').set('Origin', 'http://localhost:8081').set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    const bad = await t.http().options('/runs').set('Origin', 'https://malo.example').set('Access-Control-Request-Method', 'POST');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('auth', () => {
  it('el login con Google crea el usuario con nombre generado y país', async () => {
    const res = await t.http().post('/auth/google').send({ idToken: 'fake:g-1:Sebastián Sanhueza', country: 'cl' }).expect(200);
    expect(res.body).toMatchObject({
      isNew: true,
      accessTokenExpiresIn: 900,
      user: { username: 'sebastian.sanhueza', country: 'CL', invitedCount: 0, maxLives: 5, invitedBy: null },
    });
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');

    // segundo login: mismo usuario
    const again = await t.http().post('/auth/google').send({ idToken: 'fake:g-1:Otro Nombre' }).expect(200);
    expect(again.body.isNew).toBe(false);
    expect(again.body.user.id).toBe(res.body.user.id);
  });

  it('si el nombre está tomado agrega dígitos; un país inválido se ignora', async () => {
    const res = await t.http().post('/auth/google').send({ idToken: 'fake:g-2:Sebastián Sanhueza', country: 'XX' }).expect(200);
    expect(res.body.user.username).toMatch(/^sebastian\.sanhueza\d{2}$/);
    expect(res.body.user.country).toBeNull();
  });

  it('un token inválido da 401 con mensaje en español', async () => {
    const res = await t.http().post('/auth/google').send({ idToken: 'no-es-un-token-valido' }).expect(401);
    expect(res.body).toMatchObject({ code: 'invalid_provider_token' });
  });

  it('valida el cuerpo', async () => {
    const res = await t.http().post('/auth/google').send({}).expect(400);
    expect(res.body).toMatchObject({ code: 'validation_error', message: 'Datos inválidos.' });
  });

  it('refresh rota el token y logout lo revoca', async () => {
    const u = await t.login('g-3', 'Ana');
    const r1 = await t.http().post('/auth/refresh').send({ refreshToken: u.refreshToken }).expect(200);
    expect(r1.body.user.id).toBe(u.id);
    // el token viejo ya no sirve
    await t.http().post('/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
    await t.http().get('/me').set('Authorization', `Bearer ${r1.body.accessToken}`).expect(200);
    await t.http().post('/auth/logout').send({ refreshToken: r1.body.refreshToken }).expect(204);
    const r3 = await t.http().post('/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(401);
    expect(r3.body.code).toBe('invalid_refresh_token');
  });

  it('rutas protegidas exigen sesión', async () => {
    const res = await t.http().get('/me').expect(401);
    expect(res.body).toEqual({ statusCode: 401, code: 'unauthorized', message: 'Debes iniciar sesión.' });
    await t.http().get('/me').set('Authorization', 'Bearer basura').expect(401);
  });
});

describe('usuarios', () => {
  it('nombre de usuario: disponibilidad, validez y unicidad sin distinguir mayúsculas', async () => {
    const a = await t.login('u-1', 'Pedro Pérez');
    const b = await t.login('u-2', 'Juan');

    let res = await t.http().get('/users/check-username').query({ u: 'Pedro.Perez' }).expect(200);
    expect(res.body).toMatchObject({ username: 'pedro.perez', valid: true, available: false });
    res = await t.http().get('/users/check-username').query({ u: 'pedro.perez' }).set(bearer(a)).expect(200);
    expect(res.body.available).toBe(true); // es el propio
    res = await t.http().get('/users/check-username').query({ u: 'x' }).expect(200);
    expect(res.body).toMatchObject({ valid: false, available: false });

    res = await t.http().patch('/me').set(bearer(b)).send({ username: 'PEDRO.PEREZ' }).expect(409);
    expect(res.body.code).toBe('username_taken');
    res = await t.http().patch('/me').set(bearer(b)).send({ username: 'juan-carlos' }).expect(400);
    expect(res.body.code).toBe('invalid_username');
    res = await t.http().patch('/me').set(bearer(b)).send({ username: '@Juanito_99' }).expect(200);
    expect(res.body.username).toBe('juanito_99');
  });

  it('país: el primer cambio es libre, luego uno cada 30 días, y actualiza los récords', async () => {
    const u = await t.login('u-3', 'Carla', 'AR');
    await t.playRun(u, { kills: 3 });
    let res = await t.http().patch('/me').set(bearer(u)).send({ country: 'cl' }).expect(200);
    expect(res.body.country).toBe('CL');
    expect(res.body.nextCountryChangeAt).not.toBeNull();
    const rows = await t.prisma.bestScore.findMany({ where: { userId: u.id } });
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.country === 'CL')).toBe(true);

    res = await t.http().patch('/me').set(bearer(u)).send({ country: 'PE' }).expect(409);
    expect(res.body).toMatchObject({ code: 'country_change_too_soon' });
    expect(res.body.nextCountryChangeAt).toBeTruthy();
    await t.http().patch('/me').set(bearer(u)).send({ country: 'CL' }).expect(200); // sin cambio: ok
    await t.http().patch('/me').set(bearer(u)).send({ country: 'ZZ' }).expect(400);
  });

  it('perfil público y búsqueda', async () => {
    const u = await t.login('u-4', 'Zoe Busca', 'MX');
    await t.playRun(u, { kills: 4 });
    const res = await t.http().get(`/users/${u.username}`).expect(200);
    expect(res.body).toMatchObject({ username: 'zoe.busca', country: 'MX', invitedCount: 0, best: { killed: 4 } });
    expect(res.body.isFollowing).toBeUndefined();
    await t.http().get('/users/no.existe').expect(404);

    const s = await t.http().get('/users/search').query({ q: 'ZOE' }).expect(200);
    expect(s.body.users.map((x: { username: string }) => x.username)).toContain('zoe.busca');
  });

  it('DELETE /me borra la cuenta y sus datos', async () => {
    const u = await t.login('u-5', 'Borrar Me');
    await t.playRun(u, { kills: 2 });
    await t.http().delete('/me').set(bearer(u)).expect(204);
    await t.http().get('/me').set(bearer(u)).expect(401);
    expect(await t.prisma.run.count({ where: { userId: u.id } })).toBe(0);
    expect(await t.prisma.bestScore.count({ where: { userId: u.id } })).toBe(0);
    // puede volver a registrarse como cuenta nueva
    const again = await t.http().post('/auth/google').send({ idToken: 'fake:u-5:Borrar Me' }).expect(200);
    expect(again.body.isNew).toBe(true);
  });
});
