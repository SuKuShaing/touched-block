import type { TierRef } from '@tb/engine';
import { medalSvg, SHARE_BADGE } from '@/cosmetics/medal';
import { tierStepOf } from '@/cosmetics/tiers';
import type { ResultCard, Share, ShareOutcome } from './share.types';

// Web Share API con la tarjeta dibujada en un <canvas>. Si el navegador no comparte archivos,
// se comparte solo el texto; si tampoco, se copia al portapapeles. Todo con try/catch.

const W = 1080;
const H = 1080;
// la misma fuente que la página y la app (ver webFont.web.ts)
const FONT = '"Roboto Variable", Roboto, system-ui, sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Ajusta el tamaño de la fuente hasta que el texto quepa en maxW. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (s > 16 && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${FONT}`;
  }
}

/**
 * Insignia como en components/TierBadge.tsx: el mismo SVG (`cosmetics/medal.ts`), ya cargado como
 * imagen, centrado en (cx, cy) y con su nombre debajo. Sin imagen (no cargó) queda solo el nombre.
 */
function drawBadge(ctx: CanvasRenderingContext2D, ref: TierRef, medal: HTMLImageElement | null, cx: number, cy: number) {
  const t = tierStepOf(ref);
  if (!t) return;
  const B = SHARE_BADGE.box;
  if (medal) ctx.drawImage(medal, cx - B / 2, cy - B / 2, B, B);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.9;
  ctx.font = `700 ${SHARE_BADGE.nameSize}px ${FONT}`;
  ctx.fillText(t.name, cx, cy + SHARE_BADGE.nameDy);
  ctx.globalAlpha = 1;
}

/** La medalla de la tarjeta como imagen (SVG en data URI), o null si no hay insignia o no cargó. */
function loadMedal(ref: TierRef | null | undefined): Promise<HTMLImageElement | null> {
  const t = tierStepOf(ref);
  if (!t || typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      const svg = medalSvg({ tier: t.tier, step: t.step, emblem: 'tier', small: false }, SHARE_BADGE.box);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch {
      resolve(null);
    }
  });
}

function draw(card: ResultCard, medal: HTMLImageElement | null): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('sin canvas 2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // fondo + panel
  ctx.fillStyle = '#12121a';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1c1c28';
  roundRect(ctx, 60, 60, W - 120, H - 120, 48);
  ctx.fill();

  // logo: bloque azul con un 3 (el mismo del favicon)
  const bs = 190;
  const bx = (W - bs) / 2;
  const by = 120;
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  roundRect(ctx, bx, by + 16, bs, bs, 44);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0091ff';
  roundRect(ctx, bx, by, bs, bs, 44);
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#fff';
  roundRect(ctx, bx + 24, by + bs - 36, 88, 14, 7);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = `800 132px ${FONT}`;
  ctx.fillText('3', W / 2, by + 140);

  ctx.font = `800 64px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Touched Block', W / 2, 410);

  const who = card.username ? '@' + card.username : 'Invitado';
  ctx.fillStyle = '#77ccff';
  fitFont(ctx, who, 600, 42, W - 240);
  ctx.fillText(who, W / 2, 480);

  ctx.fillStyle = '#ffffff';
  fitFont(ctx, String(card.killed), 800, 230, W - 240);
  ctx.fillText(String(card.killed), W / 2, 720);
  ctx.globalAlpha = 0.85;
  ctx.font = `600 50px ${FONT}`;
  ctx.fillText(card.killed === 1 ? 'bloque' : 'bloques', W / 2, 790);
  ctx.globalAlpha = 1;

  // etapa alcanzada (opcional): "Llegué a las multiplicaciones y divisiones"
  if (card.stage) {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.92;
    fitFont(ctx, card.stage, 700, 40, W - 220);
    ctx.fillText(card.stage, W / 2, 858);
    ctx.globalAlpha = 1;
  }

  const ranks: string[] = [];
  if (card.worldRank) ranks.push(`#${card.worldRank} en el mundo`);
  if (card.countryRank) ranks.push(`#${card.countryRank} en ${card.countryName || 'mi país'}`);
  if (ranks.length) {
    const line = ranks.join(' · ');
    ctx.fillStyle = '#ffd166';
    fitFont(ctx, line, 700, card.stage ? 38 : 42, W - 220);
    ctx.fillText(line, W / 2, card.stage ? 918 : 880);
  }

  // insignia (opcional), arriba a la derecha del panel
  if (card.tier) drawBadge(ctx, card.tier, medal, W - 185, 182);

  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#ffffff';
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText('touchedblock.app', W / 2, 975);
  ctx.globalAlpha = 1;
  return c;
}

/** Tope para esperar la fuente: si no llega, se dibuja con la de respaldo antes que colgar. */
const FONT_WAIT_MS = 1500;

/**
 * Espera a que "Roboto Variable" esté cargada para los textos de la tarjeta (el canvas no espera
 * fuentes: sin esto el PNG, que queda en caché, podría salir con la de respaldo). Un solo archivo
 * variable cubre todos los pesos; pasar los textos carga además el latín extendido si hace falta.
 */
async function fontsReady(card: ResultCard): Promise<void> {
  try {
    if (typeof document === 'undefined' || !document.fonts?.load) return;
    const sample = `Touched Block 0123456789 ${card.username ?? ''} ${card.stage ?? ''} ${card.countryName ?? ''}`;
    await Promise.race([
      Promise.all(['500', '600', '700', '800', '900'].map((w) => document.fonts.load(`${w} 64px "Roboto Variable"`, sample))),
      new Promise((r) => setTimeout(r, FONT_WAIT_MS)),
    ]);
  } catch {}
}

let cache: { key: string; file: Promise<File | null> } | null = null;

function cardFile(card: ResultCard): Promise<File | null> {
  const key = JSON.stringify(card);
  if (cache?.key === key) return cache.file;
  const toFile = (canvas: HTMLCanvasElement) =>
    new Promise<File | null>((resolve) => {
      canvas.toBlob((blob) => {
        try {
          resolve(blob ? new File([blob], 'touched-block.png', { type: 'image/png' }) : null);
        } catch {
          resolve(null);
        }
      }, 'image/png');
    });
  const file = Promise.all([fontsReady(card), loadMedal(card.tier)]).then(async ([, medal]) => {
    try {
      return await toFile(draw(card, medal));
    } catch {
      // un navegador que no deja exportar un canvas con una imagen SVG: la tarjeta sin la medalla
      try {
        return medal ? await toFile(draw(card, null)) : null;
      } catch {
        return null;
      }
    }
  });
  cache = { key, file };
  return file;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const isAbort = (e: unknown) => !!e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError';

/** navigator.share; null si no está disponible o falló (para pasar al siguiente plan). */
async function shareData(data: ShareData): Promise<ShareOutcome | null> {
  try {
    if (typeof navigator.share !== 'function') return null;
    if (navigator.canShare && !navigator.canShare(data)) return null;
    await navigator.share(data);
    return 'shared';
  } catch (e) {
    return isAbort(e) ? 'cancelled' : null;
  }
}

/** Texto y enlace juntos: el enlace en su propia línea si el texto tiene varias (el del reto diario). */
const withUrl = (text: string, url: string) => (text.includes('\n') ? `${text}\n${url}` : `${text} ${url}`);

async function shareText(text: string, url: string): Promise<ShareOutcome> {
  // un texto de varias líneas va entero (con el enlace al final) para que cada app lo muestre igual
  const r = await shareData(text.includes('\n') ? { text: withUrl(text, url) } : { text, url });
  if (r) return r;
  return (await copyText(withUrl(text, url))) ? 'copied' : 'failed';
}

export const share: Share = {
  prepareCard(card) {
    try {
      if (typeof navigator.share === 'function') void cardFile(card);
    } catch {}
  },
  async shareResult(card, text, url) {
    try {
      if (typeof navigator.share === 'function') {
        const file = await cardFile(card);
        if (file) {
          const r = await shareData({ files: [file], text, url });
          if (r) return r;
        }
      }
    } catch {}
    return shareText(text, url);
  },
  shareText,
  copyText,
};
