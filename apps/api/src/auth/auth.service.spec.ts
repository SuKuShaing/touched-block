import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { TokensService } from './tokens.service';

/**
 * Nombre de Sign in with Apple: Apple lo entrega solo en el primer inicio de sesión. Se guarda al crear
 * la cuenta y los inicios siguientes (sin nombre, o con otro) no lo borran ni lo reemplazan.
 */
function setup() {
  const users = new Map<string, { id: string; displayName: string | null }>();
  const idents = new Map<string, string>(); // `${provider}:${subject}` -> userId
  let n = 0;
  const prisma = {
    authIdentity: {
      findUnique: vi.fn(async ({ where }: { where: { provider_subject: { provider: string; subject: string } } }) => {
        const id = idents.get(`${where.provider_subject.provider}:${where.provider_subject.subject}`);
        return id ? { userId: id } : null;
      }),
    },
    user: {
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; displayName: null }; data: { displayName: string } }) => {
        const u = users.get(where.id);
        if (!u || u.displayName !== where.displayName) return { count: 0 };
        u.displayName = data.displayName;
        return { count: 1 };
      }),
    },
  };
  const usersSvc = {
    createWithIdentity: vi.fn(async (input: { provider: string; subject: string; name?: string | null }) => {
      const id = `u${++n}`;
      users.set(id, { id, displayName: input.name ?? null });
      idents.set(`${input.provider}:${input.subject}`, id);
      return { id };
    }),
    getMe: vi.fn(async (id: string) => ({ id })),
  };
  const tokens = { issue: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r', accessTokenExpiresIn: 900 })) };
  const auth = new AuthService(prisma as unknown as PrismaService, usersSvc as unknown as UsersService, tokens as unknown as TokensService);
  return { auth, users, usersSvc };
}

const appleId = { subject: 'apple-sub-1', email: 'x@privaterelay.appleid.com', name: null, audience: 'app.touchedblock' };

describe('AuthService.login: nombre de Apple', () => {
  it('guarda el nombre del primer inicio de sesión (recortado)', async () => {
    const { auth, users, usersSvc } = setup();
    const r = await auth.login('apple', appleId, { name: '  Ana Pérez  ' });
    expect(r.isNew).toBe(true);
    expect(usersSvc.createWithIdentity).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana Pérez' }));
    expect(users.get(r.user.id)?.displayName).toBe('Ana Pérez');
  });

  it('los inicios siguientes sin nombre no lo borran', async () => {
    const { auth, users } = setup();
    const first = await auth.login('apple', appleId, { name: 'Ana Pérez' });
    const again = await auth.login('apple', appleId, {});
    const blank = await auth.login('apple', appleId, { name: '   ' });
    expect(again.isNew).toBe(false);
    expect(blank.user.id).toBe(first.user.id);
    expect(users.get(first.user.id)?.displayName).toBe('Ana Pérez');
  });

  it('un nombre distinto en un inicio posterior no reemplaza el guardado', async () => {
    const { auth, users } = setup();
    const first = await auth.login('apple', appleId, { name: 'Ana Pérez' });
    await auth.login('apple', appleId, { name: 'Otra Persona' });
    expect(users.get(first.user.id)?.displayName).toBe('Ana Pérez');
  });

  it('si la cuenta quedó sin nombre, el reintento con el nombre en memoria lo completa', async () => {
    const { auth, users } = setup();
    // 1.er intento: la cuenta se creó sin nombre (p. ej. otra petición simultánea sin fullName)
    const first = await auth.login('apple', appleId, {});
    expect(users.get(first.user.id)?.displayName).toBeNull();
    // reintento del cliente con el nombre que Apple le dio la primera vez
    const retry = await auth.login('apple', appleId, { name: 'Ana Pérez' });
    expect(retry.isNew).toBe(false);
    expect(users.get(first.user.id)?.displayName).toBe('Ana Pérez');
  });

  it('Google: el nombre del token se usa al crear, pero no rellena después', async () => {
    const { auth, users } = setup();
    const g = { subject: 'g1', email: 'g@x.com', name: null };
    const first = await auth.login('google', g);
    await auth.login('google', { ...g, name: 'Nombre De Google' });
    expect(users.get(first.user.id)?.displayName).toBeNull();
  });
});
