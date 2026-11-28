import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, TICKS_PER_SECOND, TIERS, achievementMaterial } from '@tb/engine';
import { prizeDetail } from '@/lib/shareText';
import { galleryStats } from './galleryStats';

describe('galería de prueba: el texto corresponde al nivel que se mira', () => {
  it.each(ACHIEVEMENTS.map((a) => [a.id, a] as const))('logro %s', (id, a) => {
    for (let level = 0; level <= a.thresholds.length; level++) {
      const prize = { kind: 'achievement', id, level } as const;
      const d = prizeDetail(prize, galleryStats(prize));
      expect(d.material).toBe(achievementMaterial(level));
      if (level === 0) {
        expect(d.next).toBeNull();
        expect(d.ratio).toBe(0);
      } else if (level === a.thresholds.length) {
        expect(d.next).toBe('¡Tienes el material más alto!');
      } else {
        expect(d.next).toContain(`Siguiente: ${achievementMaterial(level + 1)} ·`);
      }
    }
  });

  it('insignias: la partida más larga es la de la insignia', () => {
    for (const t of TIERS) {
      expect(galleryStats({ kind: 'tier', index: t.index }).bestTicks).toBe(t.at * TICKS_PER_SECOND);
    }
    expect(galleryStats({ kind: 'tier', index: -1 }).bestTicks).toBe(0);
  });
});
