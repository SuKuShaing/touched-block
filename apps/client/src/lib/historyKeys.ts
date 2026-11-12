// Claves del récord y el historial locales. Están aparte para que `history.ts` y `stats.ts`
// las usen sin importarse entre sí.
// Las claves cambian cuando cambian las reglas, para no comparar récords incompatibles
// (tb_best1/tb_hist1 = reglas de legacy/game.js y v1, tb_best2/tb_hist2 = reglas v2; se dejan como estaban, sin borrarlas).
// No cambiarlas sin aprobación expresa del usuario: reinicia el récord local de todos.
export const BEST_KEY = 'tb_best5';
export const HIST_KEY = 'tb_hist5';
