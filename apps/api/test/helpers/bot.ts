import { type GameConfig, type TapInput, createGame, step, tap } from '@tb/engine';

export interface BotResult {
  inputs: TapInput[];
  killed: number;
  missed: number;
  ticks: number;
  over: boolean;
}

/**
 * Juega una partida completa con el motor, como lo haría el cliente, y devuelve los toques.
 * Destruye bloques normales (evita trampas) hasta llegar a `kills`; después toca un espacio
 * vacío hasta perder todas las vidas, para que la partida termine rápido.
 * Sin `kills` juega hasta perder: con las reglas v2 son unos 8–9 min simulados (unos ms de CPU).
 */
export function playBot(config: GameConfig, opts: { kills?: number; tapEvery?: number } = {}): BotResult {
  const kills = opts.kills ?? Infinity;
  const tapEvery = opts.tapEvery ?? 6; // ~10 toques por segundo
  const s = createGame(config);
  const inputs: TapInput[] = [];
  let cooldown = 0;
  while (!s.over && s.tick < 60 * 60 * 60) {
    if (cooldown <= 0) {
      if (s.killed < kills) {
        const target = s.blocks.find((b) => !b.trap && !b.heart && b.life > 0.3);
        if (target) {
          const x = target.x + target.w / 2;
          const y = target.y + target.h / 2;
          inputs.push([s.tick, x, y]);
          tap(s, x, y);
          cooldown = tapEvery;
        }
      } else {
        // la esquina (1, 1) nunca tiene bloque (los bloques se ubican con 6 px de margen)
        inputs.push([s.tick, 1, 1]);
        tap(s, 1, 1);
        cooldown = tapEvery;
      }
    }
    cooldown--;
    if (!s.over) step(s);
  }
  return { inputs, killed: s.killed, missed: s.missed, ticks: s.tick, over: s.over };
}
