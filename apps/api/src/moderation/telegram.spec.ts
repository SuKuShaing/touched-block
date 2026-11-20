import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../config/app-config';
import type { PrismaService } from '../prisma/prisma.service';
import { TELEGRAM_API, TELEGRAM_COOLDOWN_MS, TelegramNotifier, escapeHtml, formatReportMessage, formatWhen, sendTelegramMessage } from './telegram';
import { chatsFromUpdates, runTelegramCli } from './telegram-cli';

const TOKEN = '123456:AAE-token-secreto-de-prueba';
const CHAT = '987654321';

const cfg = (over: Partial<{ telegramBotToken: string; telegramChatId: string }> = {}) =>
  ({ telegramBotToken: TOKEN, telegramChatId: CHAT, ...over }) as unknown as AppConfig;

interface Call {
  url: string;
  body: Record<string, unknown>;
  hasSignal: boolean;
}

/** fetch simulado: registra cada llamada y responde lo que diga `reply` (o lanza). */
function fakeFetch(reply: (url: string) => { status: number; body?: unknown } = () => ({ status: 200, body: { ok: true } })) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : {}, hasSignal: !!init?.signal });
    const r = reply(String(url));
    return new Response(r.body === undefined ? '' : JSON.stringify(r.body), { status: r.status });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

/** Prisma mínimo: cuenta los pendientes de una lista en memoria. */
function fakePrisma(pending: { reportedId: string }[]) {
  return {
    report: {
      count: vi.fn(async ({ where }: { where: { reportedId?: string } }) =>
        where.reportedId ? pending.filter((p) => p.reportedId === where.reportedId).length : pending.length,
      ),
    },
  } as unknown as PrismaService;
}

const report = (over: Partial<{ reportedId: string; reportedUsername: string; reason: string; details: string | null }> = {}) => ({
  reportedId: 'u1',
  reportedUsername: 'pepa',
  reason: 'offensive_name',
  details: null,
  ...over,
});

const make = (opts: { config?: AppConfig; reply?: Parameters<typeof fakeFetch>[0]; pending?: { reportedId: string }[] } = {}) => {
  const f = fakeFetch(opts.reply);
  const n = new TelegramNotifier(opts.config ?? cfg(), fakePrisma(opts.pending ?? [{ reportedId: 'u1' }]), f.fn);
  let t = Date.UTC(2026, 10, 18, 21, 5);
  n.now = () => t;
  return { n, f, advance: (ms: number) => (t += ms) };
};

describe('TelegramNotifier', () => {
  it('envía sendMessage con el token, el chat, HTML y sin vista previa', async () => {
    const { n, f } = make({ pending: [{ reportedId: 'u1' }, { reportedId: 'u1' }, { reportedId: 'u2' }] });
    expect(await n.reportCreated(report({ details: 'muy feo' }))).toBe(true);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe(`${TELEGRAM_API}/bot${TOKEN}/sendMessage`);
    expect(f.calls[0].hasSignal).toBe(true);
    expect(f.calls[0].body).toMatchObject({ chat_id: CHAT, parse_mode: 'HTML', disable_web_page_preview: true });
    const text = f.calls[0].body.text as string;
    expect(text).toContain('🚩 <b>Nuevo reporte en Touched Block</b>');
    expect(text).toContain('@pepa');
    expect(text).toContain('Motivo: nombre ofensivo');
    expect(text).toContain('«muy feo»');
    expect(text).toContain('Pendientes: 2 de @pepa · 3 en total');
    expect(text).toContain('2026-11-18 21:05 UTC');
    expect(text).toContain('node scripts/moderation.mjs reports');
  });

  it('sin TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no envía nada', async () => {
    for (const config of [cfg({ telegramBotToken: '' }), cfg({ telegramChatId: '' })]) {
      const { n, f } = make({ config });
      expect(n.enabled).toBe(false);
      expect(await n.reportCreated(report())).toBe(false);
      expect(f.calls).toHaveLength(0);
    }
  });

  it('escapa el HTML del nombre y del comentario', async () => {
    const { n, f } = make();
    await n.reportCreated(report({ reportedUsername: 'a<b>', details: '<script>alert("x")</script> & <a href="x">' }));
    const text = f.calls[0].body.text as string;
    expect(text).not.toContain('<script>');
    expect(text).not.toContain('<a href');
    expect(text).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;a href=&quot;x&quot;&gt;');
    expect(text).toContain('@a&lt;b&gt;');
  });

  it('recorta el comentario largo', () => {
    const text = formatReportMessage({
      reportedUsername: 'pepa',
      reason: 'other',
      details: 'x'.repeat(500),
      pendingForUser: 1,
      pendingTotal: 1,
      grouped: 0,
      at: new Date(),
    });
    expect(text).toContain('x'.repeat(199) + '…»');
    expect(text).not.toContain('x'.repeat(200));
  });

  it('no lanza si Telegram responde con error ni si la red falla, y el log no trae el token', async () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { n } = make({ reply: () => ({ status: 400, body: { ok: false, description: 'Bad Request: chat not found' } }) });
    const logSpy = vi.spyOn((n as unknown as { log: { error: (m: string) => void } }).log, 'error').mockImplementation((m: string) => {
      errors.push(m);
    });
    await expect(n.reportCreated(report())).resolves.toBe(false);
    const { n: n2 } = make({
      reply: () => {
        throw new TypeError(`fetch failed for ${TELEGRAM_API}/bot${TOKEN}/sendMessage`);
      },
    });
    vi.spyOn((n2 as unknown as { log: { error: (m: string) => void } }).log, 'error').mockImplementation((m: string) => {
      errors.push(m);
    });
    await expect(n2.reportCreated(report())).resolves.toBe(false);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('chat not found');
    for (const e of errors) expect(e).not.toContain(TOKEN);
    logSpy.mockRestore();
    spy.mockRestore();
  });

  it('como mucho un aviso por usuario cada 10 min; los siguientes se suman al próximo', async () => {
    const { n, f, advance } = make({ pending: [{ reportedId: 'u1' }, { reportedId: 'u2' }] });
    expect(await n.reportCreated(report())).toBe(true);
    advance(60_000);
    expect(await n.reportCreated(report())).toBe(false);
    advance(60_000);
    expect(await n.reportCreated(report())).toBe(false);
    // otro usuario no espera
    expect(await n.reportCreated(report({ reportedId: 'u2', reportedUsername: 'beto' }))).toBe(true);
    expect(f.calls).toHaveLength(2);
    advance(TELEGRAM_COOLDOWN_MS);
    expect(await n.reportCreated(report())).toBe(true);
    expect(f.calls).toHaveLength(3);
    expect(f.calls[2].body.text).toContain('+2 reportes contra @pepa sin aviso propio');
    // el siguiente ya no arrastra los agrupados
    advance(TELEGRAM_COOLDOWN_MS);
    await n.reportCreated(report());
    expect(f.calls[3].body.text).not.toContain('sin aviso propio');
  });
});

describe('TelegramNotifier: fallos y emojis', () => {
  it('si el envío falla, no bloquea la ventana: el próximo reporte avisa y cuenta el perdido', async () => {
    let fail = true;
    const { n, f, advance } = make({ reply: () => (fail ? { status: 500, body: { ok: false } } : { status: 200, body: { ok: true } }) });
    vi.spyOn((n as unknown as { log: { error: (m: string) => void } }).log, 'error').mockImplementation(() => {});
    expect(await n.reportCreated(report())).toBe(false);
    fail = false;
    advance(60_000);
    expect(await n.reportCreated(report())).toBe(true);
    expect(f.calls).toHaveLength(2);
    expect(f.calls[1].body.text).toContain('+1 reporte contra @pepa sin aviso propio');
  });

  it('recortar el comentario no parte emojis', () => {
    const text = formatReportMessage({
      reportedUsername: 'pepa',
      reason: 'other',
      details: '😀'.repeat(100) + 'x'.repeat(150),
      pendingForUser: 1,
      pendingTotal: 1,
      grouped: 0,
      at: new Date(0),
    });
    expect(/[�-�](?![�-�])|(?<![�-�])[�-�]/.test(text)).toBe(false);
    expect(text).toContain('😀'.repeat(100) + 'x'.repeat(99) + '…»');
  });
});

describe('formato', () => {
  it('escapeHtml', () => {
    expect(escapeHtml('a & b < c > "d"')).toBe('a &amp; b &lt; c &gt; &quot;d&quot;');
  });

  it('hora en UTC y en Chile', () => {
    // noviembre: Chile en horario de verano (UTC-3)
    expect(formatWhen(new Date(Date.UTC(2026, 10, 18, 21, 5)))).toBe('2026-11-18 21:05 UTC (18:05 en Chile)');
    // pasada la medianoche UTC sigue siendo el día anterior en Chile
    expect(formatWhen(new Date(Date.UTC(2026, 10, 19, 1, 30)))).toBe('2026-11-19 01:30 UTC (22:30 del 18/11 en Chile)');
  });

  it('sendTelegramMessage lanza con el status y la descripción, sin el token', async () => {
    const f = fakeFetch(() => ({ status: 401, body: { ok: false, description: 'Unauthorized' } }));
    const err = await sendTelegramMessage(TOKEN, CHAT, 'hola', f.fn).catch((e: Error) => e);
    expect(String(err)).toContain('401 (Unauthorized)');
    expect(String(err)).not.toContain(TOKEN);
  });
});

describe('telegram-test (línea de comandos)', () => {
  const env = { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: CHAT };

  it('manda un mensaje de prueba con las variables', async () => {
    const f = fakeFetch();
    const out: string[] = [];
    expect(await runTelegramCli([], env, (m) => out.push(m), f.fn)).toBe(0);
    expect(f.calls[0].url).toBe(`${TELEGRAM_API}/bot${TOKEN}/sendMessage`);
    expect(f.calls[0].body.chat_id).toBe(CHAT);
    expect(out.join('\n')).not.toContain(TOKEN);
  });

  it('sin token avisa y no llama a Telegram', async () => {
    const f = fakeFetch();
    expect(await runTelegramCli([], {}, () => {}, f.fn)).toBe(1);
    expect(f.calls).toHaveLength(0);
  });

  it('--chat-id lista los chats de getUpdates sin imprimir el token', async () => {
    const f = fakeFetch(() => ({
      status: 200,
      body: {
        ok: true,
        result: [
          { update_id: 1, message: { chat: { id: 555, type: 'private', first_name: 'Ana', username: 'ana' } } },
          { update_id: 2, message: { chat: { id: 555, type: 'private', first_name: 'Ana' } } },
          { update_id: 3, my_chat_member: { chat: { id: -100, type: 'group', title: 'Mods' } } },
        ],
      },
    }));
    const out: string[] = [];
    expect(await runTelegramCli(['telegram-test', '--chat-id'], { TELEGRAM_BOT_TOKEN: TOKEN }, (m) => out.push(m), f.fn)).toBe(0);
    expect(f.calls[0].url).toBe(`${TELEGRAM_API}/bot${TOKEN}/getUpdates`);
    const text = out.join('\n');
    expect(text).toContain('id: 555');
    expect(text).toContain('id: -100');
    expect(text).not.toContain(TOKEN);
    expect(chatsFromUpdates('x')).toEqual([]);
  });
});
