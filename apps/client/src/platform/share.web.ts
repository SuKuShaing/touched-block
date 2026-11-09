import type { ResultCard, Share, ShareOutcome } from './share.types';

// Web Share API con la tarjeta dibujada en un <canvas>. Si el navegador no comparte archivos,
// se comparte solo el texto; si tampoco, se copia al portapapeles. Todo con try/catch.

const W = 1080;
const H = 1080;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

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

function draw(card: ResultCard): HTMLCanvasElement {
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

  const ranks: string[] = [];
  if (card.worldRank) ranks.push(`#${card.worldRank} en el mundo`);
  if (card.countryRank) ranks.push(`#${card.countryRank} en ${card.countryName || 'mi país'}`);
  if (ranks.length) {
    const line = ranks.join(' · ');
    ctx.fillStyle = '#ffd166';
    fitFont(ctx, line, 700, 42, W - 220);
    ctx.fillText(line, W / 2, 880);
  }

  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#ffffff';
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText('sukushaing.github.io/touched-block', W / 2, 975);
  ctx.globalAlpha = 1;
  return c;
}

let cache: { key: string; file: Promise<File | null> } | null = null;

function cardFile(card: ResultCard): Promise<File | null> {
  const key = JSON.stringify(card);
  if (cache?.key === key) return cache.file;
  const file = new Promise<File | null>((resolve) => {
    try {
      draw(card).toBlob((blob) => {
        try {
          resolve(blob ? new File([blob], 'touched-block.png', { type: 'image/png' }) : null);
        } catch {
          resolve(null);
        }
      }, 'image/png');
    } catch {
      resolve(null);
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

async function shareText(text: string, url: string): Promise<ShareOutcome> {
  const r = await shareData({ text, url });
  if (r) return r;
  return (await copyText(`${text} ${url}`)) ? 'copied' : 'failed';
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
