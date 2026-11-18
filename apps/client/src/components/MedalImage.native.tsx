import { createElement, type ComponentType, type ReactNode } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { medalNode, type MedalSpec, type SvgNode } from '@/cosmetics/medal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TAGS: Record<string, ComponentType<any>> = {
  circle: Circle,
  clipPath: ClipPath,
  defs: Defs,
  ellipse: Ellipse,
  g: G,
  line: Line,
  linearGradient: LinearGradient,
  path: Path,
  polygon: Polygon,
  radialGradient: RadialGradient,
  rect: Rect,
  stop: Stop,
};

function render(n: SvgNode, key: number): ReactNode {
  const tag = TAGS[n.t];
  if (!tag) return null;
  return createElement(tag, { key, ...n.a }, n.c?.map(render));
}

/**
 * Medalla en la app: los mismos nodos de `cosmetics/medal.ts` que la web dibuja como SVG, con
 * react-native-svg (sin pasar por texto). Los ids de los degradados son propios de cada `Svg`.
 */
export function MedalImage({ spec, size }: { spec: MedalSpec; size: number }) {
  const root = medalNode(spec);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {root.c?.map(render)}
    </Svg>
  );
}
