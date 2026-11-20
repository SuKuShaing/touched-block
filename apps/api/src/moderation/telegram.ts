import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import { REPORT_REASON_LABELS, REPORT_RESPONSE_HOURS } from './admin';
import { charLength, truncateChars } from '../common/text';

/**
 * Avisos por Telegram al dueño cuando llega un reporte nuevo (para cumplir el plazo de 24 h de la
 * guía 1.2 de Apple sin tener que revisar la tabla a cada rato). Opcional: sin TELEGRAM_BOT_TOKEN y
 * TELEGRAM_CHAT_ID no se envía nada. Nunca bloquea ni hace fallar el reporte. Guía: docs/despliegue.md,
 * sección 7, "Avisos por Telegram".
 */

export const TELEGRAM_API = 'https://api.telegram.org';
export const TELEGRAM_TIMEOUT_MS = 5_000;
/** Como mucho un aviso por usuario reportado en este lapso; los siguientes se suman al próximo. */
export const TELEGRAM_COOLDOWN_MS = 10 * 60_000;
/** Largo máximo del comentario del reporte en el aviso. */
export const TELEGRAM_DETAILS_MAX = 200;

export type FetchFn = typeof fetch;
/** Token de inyección para reemplazar fetch en tests. */
export const TELEGRAM_FETCH = Symbol('TELEGRAM_FETCH');

/** Escapa el texto para parse_mode HTML de Telegram (solo hacen falta &, < y >; " por si acaso). */
export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Quita el token de cualquier texto antes de escribirlo en el log. */
export const redactToken = (text: string, token: string) => (token ? text.split(token).join('<token>') : text);

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-18 21:05 UTC (18:05 en Chile)". Si el runtime no conoce la zona de Chile, solo UTC. */
export function formatWhen(d: Date): string {
  const utc = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Santiago',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const sameDay = get('day') === pad(d.getUTCDate()) && get('month') === pad(d.getUTCMonth() + 1);
    const chile = `${get('hour')}:${get('minute')}${sameDay ? '' : ` del ${get('day')}/${get('month')}`}`;
    return `${utc} (${chile} en Chile)`;
  } catch {
    return utc;
  }
}

export interface ReportNotice {
  reportedUsername: string;
  reason: string;
  details: string | null;
  /** Reportes pendientes contra ese usuario (incluido este). */
  pendingForUser: number;
  /** Reportes pendientes en total. */
  pendingTotal: number;
  /** Reportes contra ese usuario que no avisaron por el límite de 10 min (desde el último aviso). */
  grouped: number;
  at: Date;
}

/** Texto del aviso (HTML de Telegram; todo lo que escribe un jugador va escapado). */
export function formatReportMessage(n: ReportNotice): string {
  const user = `@${escapeHtml(n.reportedUsername)}`;
  let details = (n.details ?? '').trim();
  if (charLength(details) > TELEGRAM_DETAILS_MAX) details = truncateChars(details, TELEGRAM_DETAILS_MAX - 1) + '…';
  const lines = [
    '🚩 <b>Nuevo reporte en Touched Block</b>',
    `Usuario: <b>${user}</b>`,
    `Motivo: ${escapeHtml(REPORT_REASON_LABELS[n.reason] ?? n.reason)}`,
    `Comentario: ${details ? `«${escapeHtml(details)}»` : '(sin comentario)'}`,
    `Pendientes: ${n.pendingForUser} de ${user} · ${n.pendingTotal} en total`,
  ];
  if (n.grouped > 0) {
    lines.push(`(+${n.grouped} reporte${n.grouped === 1 ? '' : 's'} contra ${user} sin aviso propio: máximo 1 aviso cada 10 min)`);
  }
  lines.push(`Hora: ${formatWhen(n.at)}`, '', `Revisar antes de ${REPORT_RESPONSE_HOURS} h: <code>node scripts/moderation.mjs reports</code>`);
  return lines.join('\n');
}

/**
 * Llama a sendMessage. Lanza si Telegram responde con error o la red falla; el mensaje del error
 * nunca incluye el token.
 */
export async function sendTelegramMessage(token: string, chatId: string, text: string, fetchFn: FetchFn = fetch): Promise<void> {
  let res: Response;
  try {
    res = await fetchFn(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
  } catch (e) {
    throw new Error(redactToken(`no se pudo conectar con Telegram: ${errText(e)}`, token));
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { description?: unknown };
    throw new Error(redactToken(`Telegram respondió ${res.status} (${String(data.description ?? 'sin detalle')})`, token));
  }
}

export const missingTelegramVars = (c: Pick<AppConfig, 'telegramBotToken' | 'telegramChatId'>) => [
  ...(c.telegramBotToken ? [] : ['TELEGRAM_BOT_TOKEN']),
  ...(c.telegramChatId ? [] : ['TELEGRAM_CHAT_ID']),
];

@Injectable()
export class TelegramNotifier implements OnModuleInit {
  private readonly log = new Logger('Telegram');
  private readonly fetchFn: FetchFn;
  /** Por id del usuario reportado: cuándo se avisó la última vez y cuántos reportes se agruparon desde entonces. */
  private readonly recent = new Map<string, { sentAt: number; grouped: number }>();
  /** Reportes agrupados de una ventana ya vencida, que se cuentan en el próximo aviso de ese usuario. */
  private readonly carried = new Map<string, number>();
  /** Reloj (reemplazable en tests). */
  now: () => number = () => Date.now();

  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    @Optional() @Inject(TELEGRAM_FETCH) fetchFn?: FetchFn,
  ) {
    this.fetchFn = fetchFn ?? ((...a) => fetch(...a));
  }

  get enabled(): boolean {
    return missingTelegramVars(this.config).length === 0;
  }

  onModuleInit() {
    const missing = missingTelegramVars(this.config);
    if (missing.length) this.log.log(`Avisos de reportes por Telegram desactivados (falta ${missing.join(' y ')}).`);
    else this.log.log('Avisos de reportes por Telegram activados.');
  }

  /**
   * Avisa de un reporte recién creado. No lanza nunca (los errores van al log sin el token); quien
   * lo llama no lo espera (`void`). Devuelve true si se envió el mensaje.
   */
  async reportCreated(r: { reportedId: string; reportedUsername: string; reason: string; details: string | null }): Promise<boolean> {
    if (!this.enabled) return false;
    const now = this.now();
    for (const [id, v] of this.recent) {
      if (now - v.sentAt < TELEGRAM_COOLDOWN_MS) continue;
      // venció la ventana: lo agrupado pasa al próximo aviso de ese usuario
      if (v.grouped) this.carried.set(id, (this.carried.get(id) ?? 0) + v.grouped);
      this.recent.delete(id);
    }
    const open = this.recent.get(r.reportedId);
    if (open) {
      open.grouped++;
      return false;
    }
    this.recent.set(r.reportedId, { sentAt: now, grouped: 0 });
    const grouped = this.carried.get(r.reportedId) ?? 0;
    this.carried.delete(r.reportedId);
    try {
      const [pendingForUser, pendingTotal] = await Promise.all([
        this.prisma.report.count({ where: { reportedId: r.reportedId, status: 'pending' } }),
        this.prisma.report.count({ where: { status: 'pending' } }),
      ]);
      const text = formatReportMessage({
        reportedUsername: r.reportedUsername,
        reason: r.reason,
        details: r.details,
        pendingForUser,
        pendingTotal,
        grouped,
        at: new Date(now),
      });
      await sendTelegramMessage(this.config.telegramBotToken, this.config.telegramChatId, text, this.fetchFn);
      return true;
    } catch (e) {
      this.log.error(redactToken(`No se pudo enviar el aviso del reporte por Telegram: ${errText(e)}`, this.config.telegramBotToken));
      // no se avisó: se libera la ventana y este reporte (más lo agrupado en ella) se cuenta en el próximo aviso
      const open = this.recent.get(r.reportedId);
      this.recent.delete(r.reportedId);
      const lost = 1 + grouped + (open?.grouped ?? 0);
      this.carried.set(r.reportedId, (this.carried.get(r.reportedId) ?? 0) + lost);
      return false;
    }
  }
}

const errText = (e: unknown) => {
  if (e instanceof Error) {
    const cause = (e as { cause?: unknown }).cause;
    return cause instanceof Error ? `${e.message} (${cause.message})` : e.message;
  }
  return String(e);
};
