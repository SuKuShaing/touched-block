import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestApp, type TestUser, bearer, createTestApp } from './helpers/app';

// Moderación (guía 1.2 de Apple): filtro de nombres, reportar, bloquear y /admin.
const ADMIN = 'e2e-admin-token-e2e-admin-token-e2e-admin';

let t: TestApp;

beforeAll(async () => {
  process.env.ADMIN_TOKEN = ADMIN;
  t = await createTestApp();
  await t.reset();
});
afterAll(async () => {
  delete process.env.ADMIN_TOKEN;
  await t?.app.close();
});

const admin = { 'X-Admin-Token': ADMIN };

describe('salud', () => {
  it('anuncia la función de moderación', async () => {
    const res = await t.http().get('/health').expect(200);
    expect(res.body.features).toContain('moderation');
  });
});

describe('filtro de nombres', () => {
  let u: TestUser;
  beforeAll(async () => {
    u = await t.login('mod-filter', 'Filtro');
  });

  it('PATCH /me rechaza groserías y suplantación con un mensaje claro', async () => {
    let res = await t.http().patch('/me').set(bearer(u)).send({ username: 'fuck_you' }).expect(400);
    expect(res.body.code).toBe('invalid_username');
    expect(res.body.message).toContain('groserías');
    res = await t.http().patch('/me').set(bearer(u)).send({ username: 'soporte.oficial' }).expect(400);
    expect(res.body.message).toContain('hacerse pasar');
    await t.http().patch('/me').set(bearer(u)).send({ username: 'computadora' }).expect(200);
  });

  it('check-username lo marca como inválido', async () => {
    const res = await t.http().get('/users/check-username').query({ u: 'Pu7a.madre' }).expect(200);
    expect(res.body).toMatchObject({ valid: false, available: false });
    expect(res.body.message).toContain('groserías');
  });

  it('al crear la cuenta no usa un nombre de Google ofensivo', async () => {
    const bad = await t.login('mod-filter-2', 'Mierda Total');
    expect(bad.username).not.toContain('mierda');
  });
});

describe('reportar', () => {
  let ana: TestUser;
  let beto: TestUser;
  beforeAll(async () => {
    ana = await t.login('rep-a', 'Ana Rep');
    beto = await t.login('rep-b', 'Beto Rep');
  });

  it('requiere sesión y valida el motivo', async () => {
    await t.http().post(`/users/${beto.username}/report`).send({ reason: 'other' }).expect(401);
    await t.http().post(`/users/${beto.username}/report`).set(bearer(ana)).send({ reason: 'feo' }).expect(400);
    await t
      .http()
      .post(`/users/${beto.username}/report`)
      .set(bearer(ana))
      .send({ reason: 'other', details: 'x'.repeat(201) })
      .expect(400);
  });

  it('no se puede reportar a uno mismo ni a quien no existe', async () => {
    let res = await t.http().post(`/users/${ana.username}/report`).set(bearer(ana)).send({ reason: 'other' }).expect(400);
    expect(res.body.code).toBe('report_self');
    res = await t.http().post('/users/nadie.nunca/report').set(bearer(ana)).send({ reason: 'other' }).expect(404);
    expect(res.body.code).toBe('user_not_found');
  });

  it('un reporte por par y día', async () => {
    const res = await t
      .http()
      .post(`/users/@${beto.username.toUpperCase()}/report`)
      .set(bearer(ana))
      .send({ reason: 'offensive_name', details: '  insulta en el nombre  ' })
      .expect(201);
    expect(res.body).toMatchObject({ status: 'pending', reviewWithinHours: 24 });
    const again = await t.http().post(`/users/${beto.username}/report`).set(bearer(ana)).send({ reason: 'other' }).expect(409);
    expect(again.body.code).toBe('already_reported');
    // otro jugador sí puede reportarlo
    await t.http().post(`/users/${ana.username}/report`).set(bearer(beto)).send({ reason: 'impersonation' }).expect(201);
    const row = await t.prisma.report.findFirst({ where: { reporterId: ana.id } });
    expect(row).toMatchObject({ reportedId: beto.id, reportedUsername: beto.username, details: 'insulta en el nombre', status: 'pending' });
  });
});

describe('bloquear', () => {
  let ana: TestUser;
  let beto: TestUser;
  let ciro: TestUser;
  beforeAll(async () => {
    ana = await t.login('blk-a', 'Blkana');
    beto = await t.login('blk-b', 'Blkbeto');
    ciro = await t.login('blk-c', 'Blkciro');
    for (const [u, kills] of [
      [ana, 4],
      [beto, 3],
      [ciro, 2],
    ] as const) {
      const { finish } = await t.playRun(u, { kills });
      expect(finish.body.valid).toBe(true);
    }
    // se siguen todos con todos
    for (const a of [ana, beto, ciro]) for (const b of [ana, beto, ciro]) if (a !== b) await t.http().post(`/follows/${b.id}`).set(bearer(a)).expect(204);
  });

  it('requiere sesión; no a uno mismo', async () => {
    await t.http().post(`/users/${beto.username}/block`).expect(401);
    const res = await t.http().post(`/users/${ana.username}/block`).set(bearer(ana)).expect(400);
    expect(res.body.code).toBe('block_self');
    await t.http().post('/users/nadie.nunca/block').set(bearer(ana)).expect(404);
  });

  it('borra los seguimientos en ambos sentidos y ninguno puede volver a seguir', async () => {
    await t.http().post(`/users/${beto.username}/block`).set(bearer(ana)).expect(204);
    await t.http().post(`/users/${beto.username}/block`).set(bearer(ana)).expect(204); // idempotente
    const follows = await t.prisma.follow.count({
      where: {
        OR: [
          { followerId: ana.id, followeeId: beto.id },
          { followerId: beto.id, followeeId: ana.id },
        ],
      },
    });
    expect(follows).toBe(0);
    let res = await t.http().post(`/follows/${ana.id}`).set(bearer(beto)).expect(403);
    expect(res.body.code).toBe('follow_blocked');
    res = await t.http().post(`/follows/${beto.id}`).set(bearer(ana)).expect(409);
    expect(res.body.code).toBe('user_blocked');
    // los demás seguimientos siguen
    expect(await t.prisma.follow.count({ where: { followerId: ana.id, followeeId: ciro.id } })).toBe(1);
  });

  it('no aparecen en el ranking de amigos ni en la búsqueda del otro', async () => {
    const names = (b: { entries: { username: string }[] }) => b.entries.map((e) => e.username);
    let res = await t.http().get('/leaderboards').query({ scope: 'friends', period: 'all' }).set(bearer(ana)).expect(200);
    expect(names(res.body)).toEqual([ana.username, ciro.username]);
    res = await t.http().get('/leaderboards').query({ scope: 'friends', period: 'all' }).set(bearer(beto)).expect(200);
    expect(names(res.body)).toEqual([beto.username, ciro.username]);

    res = await t.http().get('/users/search').query({ q: 'blk' }).set(bearer(ana)).expect(200);
    expect(res.body.users.map((u: { username: string }) => u.username).sort()).toEqual([ana.username, ciro.username].sort());
    res = await t.http().get('/users/search').query({ q: 'blk' }).set(bearer(beto)).expect(200);
    expect(res.body.users.map((u: { username: string }) => u.username)).not.toContain(ana.username);
    // sin sesión se ven todos
    res = await t.http().get('/users/search').query({ q: 'blk' }).expect(200);
    expect(res.body.users).toHaveLength(3);
  });

  it('el bloqueado no ve el perfil de quien lo bloqueó; quien bloqueó ve isBlocked', async () => {
    let res = await t.http().get(`/users/${ana.username}`).set(bearer(beto)).expect(404);
    expect(res.body.code).toBe('user_not_found');
    res = await t.http().get(`/users/${beto.username}`).set(bearer(ana)).expect(200);
    expect(res.body).toMatchObject({ isBlocked: true, isFollowing: false });
    res = await t.http().get(`/users/${ciro.username}`).set(bearer(ana)).expect(200);
    expect(res.body.isBlocked).toBe(false);
    res = await t.http().get(`/users/${beto.username}`).expect(200);
    expect(res.body.isBlocked).toBeUndefined();
  });

  it('lista de bloqueados y desbloquear', async () => {
    let res = await t.http().get('/me/blocks').set(bearer(ana)).expect(200);
    expect(res.body.users).toEqual([expect.objectContaining({ id: beto.id, username: beto.username })]);
    await t.http().delete(`/users/${beto.username}/block`).set(bearer(ana)).expect(204);
    await t.http().delete(`/users/${beto.username}/block`).set(bearer(ana)).expect(204);
    res = await t.http().get('/me/blocks').set(bearer(ana)).expect(200);
    expect(res.body.users).toEqual([]);
    // los seguimientos no vuelven solos, pero ya se puede seguir
    await t.http().post(`/follows/${ana.id}`).set(bearer(beto)).expect(204);
    await t.http().get(`/users/${ana.username}`).set(bearer(beto)).expect(200);
  });

  it('"¿Quién te invitó?" con un bloqueo: da el corazón pero no se siguen', async () => {
    const dani = await t.login('blk-d', 'Blkdani');
    await t.http().post(`/users/${dani.username}/block`).set(bearer(ciro)).expect(204);
    await t.http().post('/me/inviter').set(bearer(dani)).send({ username: ciro.username }).expect(200);
    expect(await t.prisma.follow.count({ where: { OR: [{ followerId: dani.id }, { followeeId: dani.id }] } })).toBe(0);
  });
});

describe('admin', () => {
  let eva: TestUser;
  let malo: TestUser;
  beforeAll(async () => {
    eva = await t.login('adm-e', 'Eva Adm');
    malo = await t.login('adm-m', 'Malo Adm');
    await t.http().post(`/users/${malo.username}/report`).set(bearer(eva)).send({ reason: 'offensive_name' }).expect(201);
  });

  it('sin el token correcto responde 404', async () => {
    await t.http().get('/admin/reports').expect(404);
    await t.http().get('/admin/reports').set({ 'X-Admin-Token': 'otro' }).expect(404);
    // el token de sesión de un jugador no sirve
    await t.http().get('/admin/reports').set(bearer(eva)).expect(404);
  });

  it('lista los reportes pendientes', async () => {
    const res = await t.http().get('/admin/reports').set(admin).expect(200);
    expect(res.body.pending).toBeGreaterThanOrEqual(1);
    const r = res.body.reports.find((x: { reportedUsername: string }) => x.reportedUsername === malo.username);
    expect(r).toMatchObject({ status: 'pending', reason: 'offensive_name', reporter: { username: eva.username }, ageHours: 0 });
  });

  it('cambia el nombre a uno automático o al indicado y cierra los reportes', async () => {
    let res = await t.http().post(`/admin/users/${malo.username}/rename`).set(admin).send({}).expect(200);
    expect(res.body).toMatchObject({ from: malo.username, resolvedReports: 1 });
    expect(res.body.to).toMatch(/^jugador\d{4}$/);
    const auto = res.body.to as string;
    res = await t.http().post(`/admin/users/${auto}/rename`).set(admin).send({ username: 'culiao' }).expect(400);
    expect(res.body.code).toBe('invalid_username');
    res = await t.http().post(`/admin/users/${auto}/rename`).set(admin).send({ username: eva.username }).expect(409);
    res = await t.http().post(`/admin/users/${auto}/rename`).set(admin).send({ username: 'malo.renombrado' }).expect(200);
    expect(res.body.to).toBe('malo.renombrado');
    const me = await t.http().get('/me').set(bearer(malo)).expect(200);
    expect(me.body.username).toBe('malo.renombrado');
    const list = await t.http().get('/admin/reports').query({ status: 'resolved' }).set(admin).expect(200);
    expect(list.body.reports.find((x: { reported: { id: string } | null }) => x.reported?.id === malo.id)?.resolution).toContain('Nombre cambiado');
  });

  it('marca un reporte como resuelto o descartado', async () => {
    const created = await t.http().post('/users/malo.renombrado/report').set(bearer(eva)).send({ reason: 'other' }).expect(409);
    expect(created.body.code).toBe('already_reported');
    const x = await t.login('adm-x', 'Equis Adm');
    const rep = await t.http().post('/users/malo.renombrado/report').set(bearer(x)).send({ reason: 'other', details: 'nada' }).expect(201);
    await t.http().post('/admin/reports/no-es-uuid/resolve').set(admin).send({}).expect(400);
    await t.http().post('/admin/reports/00000000-0000-4000-8000-000000000000/resolve').set(admin).send({}).expect(404);
    const res = await t
      .http()
      .post(`/admin/reports/${rep.body.id}/resolve`)
      .set(admin)
      .send({ status: 'dismissed', resolution: 'Sin infracción.' })
      .expect(200);
    expect(res.body).toMatchObject({ status: 'dismissed', resolution: 'Sin infracción.' });
  });

  it('elimina una cuenta', async () => {
    const res = await t.http().delete('/admin/users/malo.renombrado').set(admin).expect(200);
    expect(res.body.deleted).toBe('malo.renombrado');
    expect(await t.prisma.user.findUnique({ where: { id: malo.id } })).toBeNull();
    // los reportes quedan, sin el usuario
    const reports = await t.prisma.report.findMany({ where: { reportedUsername: { in: [malo.username, 'malo.renombrado'] } } });
    expect(reports.length).toBeGreaterThan(0);
    expect(reports.every((r) => r.reportedId === null)).toBe(true);
    await t.http().delete('/admin/users/malo.renombrado').set(admin).expect(404);
  });
});

describe('admin sin ADMIN_TOKEN', () => {
  it('todos los endpoints responden 404', async () => {
    const saved = process.env.ADMIN_TOKEN;
    delete process.env.ADMIN_TOKEN;
    const t2 = await createTestApp();
    try {
      await t2.http().get('/admin/reports').set({ 'X-Admin-Token': '' }).expect(404);
      await t2.http().get('/admin/reports').set(admin).expect(404);
      await t2.http().delete('/admin/users/alguien').set(admin).expect(404);
    } finally {
      await t2.app.close();
      process.env.ADMIN_TOKEN = saved;
    }
  });
});
