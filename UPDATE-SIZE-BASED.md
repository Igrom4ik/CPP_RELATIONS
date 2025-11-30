# Update: Size-based Universe Layout

This update introduces size-based visualisation for nodes (files) in the 3D universe.

Files added:
- `components/UniverseGenerator-Updated.ts` — generator which maps file size (bytes) to planet scale and positions nodes in spiral galaxies with adaptive spacing.
- `components/CleanUniverse-SizeBased.tsx` — React/three-fiber component that uses the generator and renders planets using InstancedMesh for performance.

Usage

1. Provide file sizes in `node.val` (bytes). Example data:

```ts
const data = {
  nodes: files.map(f => ({ id: f.path, name: f.name, val: f.sizeBytes })),
  links: dependencies
};
```

2. Render:

```tsx
import CleanUniverseWithGenerator from './components/CleanUniverse-SizeBased';

<CleanUniverseWithGenerator data={data} onNodeClick={(n) => console.log(n)} />
```

Design

- `sizeFromBytes(bytes)` maps bytes → visible scale (0.3 .. 6)
- `spacingForSizes(size, prevSize)` ensures larger files have larger spacing and minimize overlap
- Spiral radius grows with spacing, ensuring large nodes are not packed tightly
- Uses `InstancedMesh` when possible for performance

Notes

- You can tune parameters in `UniverseGenerator-Updated.ts` (arms, baseRadius, bulge, spiralWinding).
- Instancing reduces draw calls; for interactive selection per-node you can implement a raycast mapping from instanceId → node.


