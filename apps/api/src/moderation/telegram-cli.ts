import { type FetchFn, TELEGRAM_API, TELEGRAM_TIMEOUT_MS, escapeHtml, formatWhen, redactToken, sendTelegramMessage } from './telegram';

/**
 * Prueba de los avisos por Telegram desde la línea de comandos (scripts/telegram-test.mjs y
 * `moderation.mjs telegram-test`). No usa la base de datos. Nunca imprime el token.
 *
 *   (sin opciones)  manda un mensaje de prueba con TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID
 *   --chat-id       llama a getUpdates y muestra el chat id de quienes le escribieron al bot
 */

const errText = (e: unknown) => {
  if (e instanceof Error) {
    const cause = (e as { cause?: unknown }).cause;
    return cause instanceof Error ? `${e.message} (${cause.message})` : e.message;
  }
  return String(e);
};

interface TgChat {
  id: number;
  type?: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/** Chats distintos que aparecen en la respuesta de getUpdates. */
export function chatsFromUpdates(result: unknown): TgChat[] {
  const out = new Map<number, TgChat>();
  if (!Array.isArray(result)) return [];
  for (const u of result as Record<string, { chat?: TgChat } | undefined>[]) {
    for (const key of ['message', 'edited_message', 'channel_post', 'my_chat_member', 'chat_member']) {
      const chat = u?.[key]?.chat;
      if (chat && typeof chat.id === 'number') out.set(chat.id, chat);
    }
  }
  return [...out.values()];
}

export async function runTelegramCli(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  log: (m: string) => void = console.log,
  fetchFn: FetchFn = fetch,
): Promise<number> {
  const token = (env.TELEGRAM_BOT_TOKEN ?? '').trim();
  const chatId = (env.TELEGRAM_CHAT_ID ?? '').trim();
  if (!token) {
    log('Falta TELEGRAM_BOT_TOKEN (el token que te dio @BotFather). Guía: docs/despliegue.md, sección 7, "Avisos por Telegram".');
    return 1;
  }

  if (argv.includes('--chat-id')) {
    try {
      const res = await fetchFn(`${TELEGRAM_API}/bot${token}/getUpdates`, { signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: unknown; description?: unknown };
      if (!res.ok || !data.ok) {
        log(`Error: Telegram respondió ${res.status} (${String(data.description ?? 'sin detalle')}).`);
        if (res.status === 401) log('El token no es válido: cópialo de nuevo desde @BotFather.');
        return 1;
      }
      const chats = chatsFromUpdates(data.result);
      if (!chats.length) {
        log('Nadie le ha escrito al bot todavía (o ya pasaron más de 24 h). Abre el bot en Telegram, toca Iniciar (/start) o escríbele "hola" y vuelve a correr esto.');
        return 1;
      }
      log('Chats que le escribieron al bot (usa el "id" del tuyo como TELEGRAM_CHAT_ID):');
      for (const c of chats) {
        const name = c.title ?? [c.first_name, c.last_name].filter(Boolean).join(' ');
        log(`- id: ${c.id}  (${c.type ?? '?'}${name ? `, ${name}` : ''}${c.username ? `, @${c.username}` : ''})`);
      }
      return 0;
    } catch (e) {
      log(redactToken(`Error: no se pudo conectar con Telegram: ${errText(e)}`, token));
      return 1;
    }
  }

  if (!chatId) {
    log('Falta TELEGRAM_CHAT_ID. Para averiguarlo: node scripts/telegram-test.mjs --chat-id');
    return 1;
  }
  const text = [
    '✅ <b>Prueba de avisos de Touched Block</b>',
    'Si lees esto, los avisos de reportes nuevos llegarán a este chat.',
    `Hora: ${escapeHtml(formatWhen(new Date()))}`,
  ].join('\n');
  try {
    await sendTelegramMessage(token, chatId, text, fetchFn);
    log(`Mensaje de prueba enviado al chat ${chatId}. Revisa Telegram.`);
    return 0;
  } catch (e) {
    log(redactToken(`Error: ${errText(e)}`, token));
    if (/\b400\b/.test(errText(e))) log('Revisa TELEGRAM_CHAT_ID y que hayas tocado Iniciar (/start) en el bot.');
    if (/\b401\b/.test(errText(e))) log('El token no es válido: cópialo de nuevo desde @BotFather.');
    return 1;
  }
}
