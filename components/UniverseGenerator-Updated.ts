import * as THREE from 'three';

export interface SizedNode {
  id: string;
  name?: string;
  val?: number; // размер в байтах
}

export interface PlacedNode {
  node: SizedNode;
  pos: THREE.Vector3;
  size: number;
}

export interface GeneratorOptions {
  arms?: number;
  baseRadius?: number;
  bulge?: number;
  spiralWinding?: number;
}

// Преобразование размера в видимую величину планеты (scale)
export function sizeFromBytes(bytes: number | undefined): number {
  const kb = Math.max(0, (bytes || 0) / 1024);
  if (kb <= 1) return 0.3;
  if (kb <= 50) return 0.3 + ((kb - 1) / (50 - 1)) * (2.0 - 0.3);
  if (kb <= 100) return 2.0 + ((kb - 50) / (100 - 50)) * (3.5 - 2.0);
  // for very large files scale slightly more but clamp
  return Math.min(6, 3.5 + Math.log10(kb / 100 + 1) * 0.8);
}

// spacing rule from spec
function spacingForSizes(size: number, prevSize: number | null): number {
  const minSpacing = size * 2;
  if (prevSize == null) return minSpacing;
  return Math.max(minSpacing, (size + prevSize) * 1.5);
}

// Генератор позиций для одной галактики (спираль)
export function generateGalaxyPositions(
  nodes: SizedNode[],
  center: THREE.Vector3,
  opts: GeneratorOptions = {}
): PlacedNode[] {
  const ARMS = opts.arms ?? 3;
  const baseRadius = opts.baseRadius ?? 60; // внутренний радиус
  const bulge = opts.bulge ?? 6; // ядро
  const winding = opts.spiralWinding ?? 2.5;

  // compute sizes
  const sizes = nodes.map(n => sizeFromBytes(n.val));

  const placed: PlacedNode[] = [];
  let prevSize: number | null = null;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const size = sizes[i];

    // spacing depends on size and previous size
    const spacing = spacingForSizes(size, prevSize);
    prevSize = size;

    // radius increases with spacing
    const t = i / Math.max(1, nodes.length - 1); // 0..1
    const radius = baseRadius + spacing * 0.5 + t * (200 + spacing);

    // assign arm
    const arm = i % ARMS;
    // angle: logarithmic spiral approximation
    const armOffset = (arm / ARMS) * Math.PI * 2;
    const angle = armOffset + t * Math.PI * 2 * winding + (Math.random() - 0.5) * 0.6;

    // small vertical wiggle
    const y = center.y + (Math.random() - 0.5) * 10 + Math.sin(t * Math.PI * 2) * 4;

    const x = center.x + Math.cos(angle) * radius;
    const z = center.z + Math.sin(angle) * radius;

    placed.push({ node, pos: new THREE.Vector3(x, y, z), size });
  }

  return placed;
}

export default {
  sizeFromBytes,
  generateGalaxyPositions,
};

