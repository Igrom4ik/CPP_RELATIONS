import React, { useRef, useEffect, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

interface Node {
  id: string;
  name: string;
  val?: number;
  color?: string;
  type?: 'entry' | 'header' | 'source' | 'lib';
  x?: number; y?: number; z?: number;
}

interface Link { source: string; target: string; value?: number }

// Create a canvas-backed sprite with reasonable texture size (scaled by baseSize)
const createLabelSprite = (text: string, color = '#ffffff', baseSize = 8) => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Critically reduce texture sizes and font size
  const fontSize = Math.max(12, Math.min(32, Math.round(baseSize * 3)));
  ctx.font = `${fontSize}px sans-serif`;
  const lines = text.split('\n').slice(0, 2); // max 2 lines
  const padding = 4;
  const lineHeight = Math.round(fontSize * 1.1);
  const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width), 40);

  // Much smaller caps to avoid large GPU uploads
  canvas.width = Math.ceil(Math.min(512, maxWidth + padding * 2));
  canvas.height = Math.ceil(Math.min(256, lineHeight * lines.length + padding * 2));

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.fillStyle = color || '#ffffff'; } catch (e) { ctx.fillStyle = '#ffffff'; }
  ctx.font = `${fontSize}px sans-serif`;
  const cx = canvas.width / 2;
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], cx, padding + (i + 0.5) * lineHeight);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  try { (texture as any).encoding = THREE.sRGBEncoding; } catch (e) {}
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  material.depthTest = true;
  material.alphaTest = 0.01;
  material.transparent = true;
  material.blending = THREE.NormalBlending;
  material.opacity = 1.0;
  material.needsUpdate = true;

  const sprite = new THREE.Sprite(material);
  // Enable frustum culling (was disabled before) to skip offscreen sprites
  sprite.frustumCulled = true;
  (sprite as any).renderOrder = 999999;
  (sprite as any).__baseTextHeight = baseSize;
  (sprite as any).__texture = texture;
  (sprite as any).__canvas = canvas;
  return sprite;
};

// --- NEW: lightweight THREE.Points + Troika labels helpers (dynamic import)
// These helpers try to use troika-three-text if available at runtime. If troika is
// not installed, code falls back to existing sprite/instanced paths.

// Create a THREE.Points system from nodes (fast single draw call)
const createPointsSystem = (nodes: any[], colorFn?: (name?: string) => string) => {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((nodes || []).length * 3);
  const colors = new Float32Array((nodes || []).length * 3);
  const sizes = new Float32Array((nodes || []).length);

  for (let i = 0; i < (nodes || []).length; i++) {
    const node = nodes[i] || {};
    positions[i * 3] = typeof node.x === 'number' ? node.x : 0;
    positions[i * 3 + 1] = typeof node.y === 'number' ? node.y : 0;
    positions[i * 3 + 2] = typeof node.z === 'number' ? node.z : 0;
    const c = node.color || (colorFn ? colorFn(node.name) : '#888888');
    const color = new THREE.Color(c);
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
    sizes[i] = Math.max(2, (node.val || 3) * 0.5);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Use a simple PointsMaterial with vertex colors. Size attenuation enabled.
  const material = new THREE.PointsMaterial({ vertexColors: true, size: 6, sizeAttenuation: true, transparent: true, opacity: 0.95 });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  (points as any).name = '__points_nodes__';
  return points;
};

// Create a Troika Text label; dynamic import is used to avoid hard dependency at build time
const createTroikaLabel = async (text: string, color: string, size = 8) => {
  try {
    // @ts-ignore - dynamic import of optional dependency
    const mod = await import('troika-three-text');
    const Text = (mod as any).Text;
    const t = new Text();
    t.text = (text || '').slice(0, 60);
    t.fontSize = size;
    t.color = color || '#ffffff';
    t.anchorX = 'center';
    t.anchorY = 'middle';
    t.depthOffset = -1;
    t.frustumCulled = false;
    // Troika Text requires sync() to commit glyphs; we call sync after adding to scene
    (t as any).renderOrder = 999999;
    return t;
  } catch (e) {
    return null; // troika not available
  }
};

const PERF_MODE_AGGRESSIVE = true; // quick toggle for aggressive performance mode


const ForceGraph3DView: React.FC<{ data: { nodes: Node[]; links: Link[] }; onNodeClick?: (n: any) => void; showClusterLabels?: boolean; sensitivity?: number; performanceMode?: boolean }> = ({ data, onNodeClick, showClusterLabels = true, sensitivity = 1, performanceMode = true }) => {
   const fgRef = useRef<any>(null);

  // Shared geometry + material cache for node meshes (much lower detail)
  const sharedSphereGeom = useMemo(() => new THREE.SphereGeometry(1, PERF_MODE_AGGRESSIVE ? 4 : 6, PERF_MODE_AGGRESSIVE ? 3 : 5), []);
  const materialCache = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map());
  const labelSpriteCache = useRef<Map<string, THREE.Sprite>>(new Map());
  // per-node small label cache
  const nodeLabelCache = useRef<Map<string, THREE.Sprite>>(new Map());
  // remember last graph key to avoid re-running heavy cluster setup if graph unchanged
  const lastGraphKey = useRef<string | null>(null);
  // keep cluster group around between toggles to avoid heavy rebuild
  const clusterGroupRef = useRef<THREE.Group | null>(null);

  // helper: is main-like (moved to component scope so nodeThreeObject can use it)
  const isMainNode = (n: any) => {
    if (!n || !n.name) return false;
    const raw = (n.name || '').toString();
    const normalized = raw.replace(/\\/g, '/');
    const parts = normalized.split('/');
    const base = parts[parts.length - 1] || normalized;
    const lname = base.toLowerCase();
    return (/^main(\b|[._\-]|$)/i.test(lname) || normalized.toLowerCase().includes('/main'));
  };

  const localGraph = useMemo(() => {
    let g: any;
    try { g = JSON.parse(JSON.stringify(data || { nodes: [], links: [] })); }
    catch { g = { nodes: (data.nodes || []).map((n:any) => ({ ...n })), links: (data.links || []).map((l:any) => ({ ...l })) }; }
    // Apply persisted positions if available and freeze nodes (fx/fy/fz) to avoid re-layout
    try {
      const persisted = (typeof window !== 'undefined') ? (window as any).__CPP_RELATIONS_NODE_POSITIONS__ : null;
      if (persisted && typeof persisted === 'object') {
        for (let i = 0; i < (g.nodes || []).length; i++) {
          const n = g.nodes[i];
          if (!n || !n.id) continue;
          const p = persisted[n.id];
          if (p && typeof p.x === 'number' && typeof p.y === 'number') {
            n.x = p.x; n.y = p.y; if (typeof p.z === 'number') n.z = p.z;
            // freeze position for force layout
            (n as any).fx = n.x; (n as any).fy = n.y; (n as any).fz = typeof n.z === 'number' ? n.z : 0;
          }
        }
      }
    } catch(e) {}
    return g;
  }, [data]);

  const getCamera = (): THREE.Camera | undefined => {
    try {
      const cand = fgRef.current?.scene;
      const scene = typeof cand === 'function' ? cand() : cand;
      if (!scene) return undefined;
      if (fgRef.current) {
        if (typeof fgRef.current.camera === 'function') return fgRef.current.camera();
        if (fgRef.current.camera) return fgRef.current.camera;
      }
      const possible = scene.children.find((c:any) => c.type === 'PerspectiveCamera' || c.isCamera);
      return possible as THREE.Camera | undefined;
    } catch (e) { return undefined; }
  };

  useEffect(() => {
    const sceneCand = fgRef.current?.scene;
    const scene = sceneCand ? (typeof sceneCand === 'function' ? sceneCand() : sceneCand) : undefined;
    if (!scene) return;

    // Restore camera position/quaternion from previous session (no animation)
    try {
      const camPersist = (typeof window !== 'undefined') ? (window as any).__CPP_RELATIONS_CAMERA__ : null;
      if (camPersist && camPersist.pos) {
        const cam = getCamera();
        if (cam) {
          try {
            cam.position.set(camPersist.pos.x || 0, camPersist.pos.y || 0, camPersist.pos.z || 0);
            if (camPersist.quat) cam.quaternion.set(camPersist.quat.x || 0, camPersist.quat.y || 0, camPersist.quat.z || 0, camPersist.quat.w || 1);
            try { (cam as any).updateProjectionMatrix && (cam as any).updateProjectionMatrix(); } catch(e) {}
            // also try to set via force-graph API without animation
            try { if (fgRef.current && typeof fgRef.current.cameraPosition === 'function') fgRef.current.cameraPosition({ x: cam.position.x, y: cam.position.y, z: cam.position.z }, undefined, 0); } catch(e) {}
          } catch(e) {}
        }
      }
    } catch(e) {}

    // --- High-performance InstancedMesh for nodes ---
    let instancedMesh: THREE.InstancedMesh | null = null;
    let instIndexMap: Record<string, number> = {};
    const tmpObj = new THREE.Object3D();

    const createOrUpdateInstanced = () => {
      if (!performanceMode) return;
      const nodes = localGraph.nodes || [];
      const count = nodes.length;
      // If existing mesh and count matches, reuse, else recreate
      if (instancedMesh && (instancedMesh as any).count === count) {
        // reuse
        return;
      }
      // remove old
      try { const old = scene.getObjectByName('__instanced_nodes__'); if (old) scene.remove(old); } catch(e){}
      try { if (instancedMesh) { instancedMesh.geometry.dispose(); (instancedMesh.material as any).dispose(); } } catch(e){}

      // single material with vertex colors enabled
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
      const geom = sharedSphereGeom.clone();
      // @ts-ignore - InstancedMesh may require different typings in this environment
      instancedMesh = new (THREE as any).InstancedMesh(geom, mat, Math.max(1, count));
      instancedMesh.name = '__instanced_nodes__';
      (instancedMesh as any).instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // build index map
      instIndexMap = {};
      for (let i = 0; i < count; i++) instIndexMap[(nodes[i].id).toString()] = i;
      // initialize matrices & colors
      for (let i = 0; i < count; i++) {
        const n = nodes[i];
        tmpObj.position.set(typeof n.x === 'number' ? n.x : 0, typeof n.y === 'number' ? n.y : 0, typeof n.z === 'number' ? n.z : 0);
        const scale = Math.max(0.5, (n.val || 3) * 0.3);
        tmpObj.scale.setScalar(scale);
        tmpObj.updateMatrix();
        instancedMesh.setMatrixAt(i, tmpObj.matrix);
        try { (instancedMesh as any).setColorAt(i, new THREE.Color(n.color || defaultColorForName(n.name))); } catch(e) {}
      }
      try { (instancedMesh as any).instanceColor.needsUpdate = true; } catch(e) {}
      scene.add(instancedMesh);
    };

    // Manage cluster label group
    let clusterGroup: THREE.Group | null = null;
    let intervalId: number | null = null;

    // sprites array must be in outer scope so updater can access it in both branches
    const sprites: { sprite: THREE.Sprite; ids: string[]; color: string }[] = [];

    // --- NEW: points & troika labels declarations (moved out so cleanup can access them)
    let pointsSystem: THREE.Points | null = null;
    const troikaLabels: any[] = [];
    let troikaFallbackSprites: THREE.Sprite[] = [];

    if (!showClusterLabels) {
      try { const old = scene.getObjectByName('__cluster_labels__'); if (old) scene.remove(old); } catch (e) {}
      return;
    }

    // compute connected components and keep those that contain main-like files
    const computeClusters = (graph: any) => {
      const adj = new Map<string, string[]>();
      (graph.nodes || []).forEach((n: any) => adj.set(n.id, []));
      (graph.links || []).forEach((l: any) => {
        const s = l.source?.toString(); const t = l.target?.toString(); if (!s || !t) return;
        if (!adj.has(s)) adj.set(s, []); if (!adj.has(t)) adj.set(t, []);
        adj.get(s)!.push(t); adj.get(t)!.push(s);
      });
      const visited = new Set<string>();
      const comps: string[][] = [];
      for (const node of graph.nodes || []) {
        const id = node.id; if (visited.has(id)) continue;
        const q = [id]; visited.add(id); const comp: string[] = [];
        while (q.length) { const cur = q.shift()!; comp.push(cur); const neigh = adj.get(cur) || []; for (const nb of neigh) if (!visited.has(nb)) { visited.add(nb); q.push(nb); } }
        comps.push(comp);
      }
      return comps.map(c => {
        const nodes = c.map(id => graph.nodes.find((n:any) => n.id === id)).filter(Boolean);
        const mains = nodes.filter(isMainNode);
        return mains.length > 0 ? { ids: c, nodes, mains } : null;
      }).filter(Boolean);
    };

    try {
      // build a lightweight key for graph to decide whether to rebuild clusterGroup
      const keyObj: any = { nodesLen: (localGraph.nodes || []).length, linksLen: (localGraph.links || []).length };
      keyObj.sample = (localGraph.nodes || []).slice(0, 20).map((n:any) => n.id).join(',');
      const graphKey = JSON.stringify(keyObj);

      // Try to reuse global persisted cluster group (survives component unmount)
      const globalStore = (typeof window !== 'undefined') ? (window as any).__CPP_RELATIONS_CLUSTER__ : null;
      if (globalStore && globalStore.group && globalStore.key === graphKey) {
        console.debug('[ForceGraph3DView] reuse persisted clusterGroup for key', graphKey);
        clusterGroupRef.current = globalStore.group;
        lastGraphKey.current = globalStore.key;
      } else {
        if (globalStore) console.debug('[ForceGraph3DView] persisted clusterKey mismatch or missing group; storedKey=', globalStore.key, 'currentKey=', graphKey);
      }

      // If a clusterGroupRef already exists and graphKey matches, just re-show it and restart updater
      if (clusterGroupRef.current && lastGraphKey.current === graphKey) {
        // reattach if removed
        try {
          const existing = scene.getObjectByName('__cluster_labels__');
          if (!existing) scene.add(clusterGroupRef.current);
          clusterGroupRef.current.visible = true;
        } catch (e) {}
        // start interval updater below (we'll set up sprites based on existing group)
        // rebuild sprites list from existing group's children userData
        try {
          const cg = clusterGroupRef.current;
          if (cg) {
            cg.children.forEach((child:any) => {
              try {
                if (child.type === 'Sprite' && child.userData && child.userData.ids) {
                  sprites.push({ sprite: child as THREE.Sprite, ids: child.userData.ids, color: child.userData.color || '#fff' });
                }
              } catch(e) {}
            });
          }
        } catch(e) {}
      } else {
        lastGraphKey.current = graphKey;
        const clusters = computeClusters(localGraph as any);
        if (!clusters || clusters.length === 0) return;

        // Prepare group
        clusterGroup = new THREE.Group();
        clusterGroup.name = '__cluster_labels__';

        // Limit labels (aggressive mode heavily restricts amount)
        const MAX_LABELS = PERF_MODE_AGGRESSIVE ? 20 : 200;
        const sorted = (clusters as any[]).sort((a,b) => (b.nodes?.length || 0) - (a.nodes?.length || 0));
        const limited = sorted.length > MAX_LABELS ? sorted.slice(0, MAX_LABELS) : sorted;
        if (sorted.length > MAX_LABELS) console.debug('[ForceGraph3DView] clusters=%d, limiting labels to %d', sorted.length, MAX_LABELS);

        for (const c of limited) {
          const mainNames = (c.mains || []).map((m: any) => m?.name || 'main');
          const safeNames = mainNames.map((n: string) => (n.length > 60 ? n.slice(0,57) + '...' : n));
          const label = safeNames.join('\n');
          const baseSize = Math.max(6, Math.min(18, (c.nodes.length || 1) * 0.6));
          const clusterColor = (c.mains[0] && c.mains[0].color) ? c.mains[0].color : '#ffffff';
          const key = `${label.slice(0,120)}|${clusterColor}|${Math.round(baseSize)}`;

          let sprite = labelSpriteCache.current.get(key);
          if (!sprite) {
            sprite = createLabelSprite(label.slice(0,120), clusterColor, baseSize);
            if (!sprite) continue;
            // cache control
            try { if (labelSpriteCache.current.size > 500) labelSpriteCache.current.clear(); } catch(e){}
            labelSpriteCache.current.set(key, sprite);
          }

          sprite.frustumCulled = false;
          (sprite as any).renderOrder = 1000000;
          // attach metadata so we can rebuild sprites list later without recomputing
          try { (sprite as any).userData = { ids: c.ids, color: clusterColor }; } catch(e) {}
          clusterGroup.add(sprite);
          sprites.push({ sprite, ids: c.ids, color: clusterColor });
        }

        // additionally create small per-node labels for important nodes (main-like or large)
        const totalNodes = (localGraph.nodes || []).length;
        const NODE_LABEL_LIMIT = PERF_MODE_AGGRESSIVE ? 30 : 500; // cap total node labels
        let createdNodeLabels = 0;
        for (const n of (localGraph.nodes || [])) {
          if (createdNodeLabels >= NODE_LABEL_LIMIT) break;
          const showLabel = (isMainNode(n) || (n.val || 0) > 10 || totalNodes < 300);
          if (!showLabel) continue;
          const nodeKey = `node|${n.id}|${n.name}`;
          let lbl = nodeLabelCache.current.get(nodeKey);
          if (!lbl) {
            const s = (n.name || n.id || '').toString().slice(0, 60);
            lbl = createLabelSprite(s, n.color || defaultColorForName(n.name), 4);
            if (!lbl) continue;
            lbl.frustumCulled = false;
            (lbl as any).renderOrder = 1000010;
            nodeLabelCache.current.set(nodeKey, lbl);
          }
          // position label near the node: will be positioned in interval updater as well
          clusterGroup.add(lbl);
          createdNodeLabels++;
        }

        // add to scene (remove old first)
        try { const old = scene.getObjectByName('__cluster_labels__'); if (old) scene.remove(old); } catch (e) {}
        try {
          clusterGroup.renderOrder = 1000000;
          clusterGroup.traverse((o:any) => {
            try { o.renderOrder = 1000000; if (o.material) { o.material.depthTest = false; o.material.depthWrite = false; o.material.transparent = true; o.material.needsUpdate = true; } } catch(e){}
          });
        } catch(e){}
        scene.add(clusterGroup);
        clusterGroupRef.current = clusterGroup;
        // persist globally so remounts can reuse the same group and avoid heavy rebuilds
        try {
          if (typeof window !== 'undefined') {
            (window as any).__CPP_RELATIONS_CLUSTER__ = { group: clusterGroup, key: graphKey };
            console.debug('[ForceGraph3DView] persisted clusterGroup key=', graphKey, 'sprites=', sprites.length);
          }
        } catch(e) {}
      }

      // Throttled updater (interval) to reduce CPU/GPU pressure
      const intervalMs = PERF_MODE_AGGRESSIVE ? 1000 : 250; // aggressive: 1s updates
      let lastPersist = Date.now();
      const PERSIST_INTERVAL = PERF_MODE_AGGRESSIVE ? 3000 : 2000; // persist less frequently in aggressive mode
      let lastPosHash = 0; // fingerprint of sampled node positions
      let lastCameraPos = { x: NaN, y: NaN, z: NaN };
      let updateCounter = 0;
      const UPDATE_EVERY_N = PERF_MODE_AGGRESSIVE ? 3 : 1; // batch camera/label updates

      const computePosHash = (nodes: any[]) => {
        if (!nodes || nodes.length === 0) return 0;
        // sample up to ~500 points to keep fingerprint fast
        const step = Math.max(1, Math.floor(nodes.length / 500));
        let h = 2166136261 | 0; // FNV-like start
        for (let i = 0; i < nodes.length; i += step) {
          const n = nodes[i];
          const x = Math.round((n?.x || 0) * 10);
          const y = Math.round((n?.y || 0) * 10);
          const z = Math.round((n?.z || 0) * 10);
          h ^= x; h = (h * 16777619) | 0;
          h ^= y; h = (h * 16777619) | 0;
          h ^= z; h = (h * 16777619) | 0;
        }
        return h;
      };

      // Ensure instanced mesh exists before starting updates
      try { createOrUpdateInstanced(); } catch(e) {}

      // --- NEW: Points + Troika labels setup (optional fast path)

      (async () => {
        try {
          if (performanceMode) {
            // If troika is available, we'll create GPU-accelerated labels for a small subset
            try {
              pointsSystem = createPointsSystem(localGraph.nodes || [], defaultColorForName);
              if (pointsSystem) scene.add(pointsSystem);
            } catch(e) { pointsSystem = null; }

            // Create labels only for main-like nodes (limited to first 20)
            const mainNodes = (localGraph.nodes || []).filter(isMainNode).slice(0, 20);
            for (let i = 0; i < mainNodes.length; i++) {
              const n = mainNodes[i];
              try {
                const lbl = await createTroikaLabel(n.name || n.id || '', n.color || defaultColorForName(n.name), 12);
                if (lbl) {
                  lbl.position.set(typeof n.x === 'number' ? n.x : 0, typeof n.y === 'number' ? n.y : 0, typeof n.z === 'number' ? n.z : 0);
                  scene.add(lbl);
                  try { (lbl as any).sync && (lbl as any).sync(); } catch(e) {}
                  troikaLabels.push({ label: lbl, id: n.id });
                  continue;
                }
              } catch(e) {}

              // fallback to canvas sprite if troika not available
              try {
                const sp = createLabelSprite((n.name || n.id || '').toString().slice(0, 60), n.color || defaultColorForName(n.name), 8);
                if (sp) {
                  sp.position.set(typeof n.x === 'number' ? n.x : 0, (typeof n.y === 'number' ? n.y : 0), typeof n.z === 'number' ? n.z : 0);
                  // tag sprite with node id so updater can find it
                  try { (sp as any).userData = (sp as any).userData || {}; (sp as any).userData.id = n.id; } catch(e) {}
                  scene.add(sp);
                  troikaFallbackSprites.push(sp);
                }
              } catch(e) {}
            }
          }
        } catch(e) { /* non-fatal */ }
      })();

      intervalId = window.setInterval(() => {
        updateCounter++;
        if (updateCounter % UPDATE_EVERY_N !== 0) return; // skip frames to batch updates
         try {
           const liveGraph = (fgRef.current && typeof fgRef.current.graphData === 'function') ? fgRef.current.graphData() : null;
           const liveNodes = (liveGraph && liveGraph.nodes) ? liveGraph.nodes : (localGraph.nodes || []);
           const nodeById = new Map<string, any>();
           for (let i = 0; i < (liveNodes || []).length; i++) { const ln = (liveNodes || [])[i]; nodeById.set(ln.id, ln); }
           const camera = getCamera();

          // Update instanced mesh positions/colors only when positions changed (cheap fingerprint)
          try {
            if (performanceMode && instancedMesh) {
              const posHash = computePosHash(liveNodes || []);
              if (posHash !== lastPosHash) {
                lastPosHash = posHash;
                const nodes = liveNodes || [];
                // Update only sampled/batched instanced matrices to reduce per-frame work
                for (let i = 0; i < nodes.length; i++) {
                  const n = nodes[i];
                  const idx = instIndexMap[n.id];
                  if (typeof idx !== 'number') continue;
                  tmpObj.position.set(typeof n.x === 'number' ? n.x : 0, typeof n.y === 'number' ? n.y : 0, typeof n.z === 'number' ? n.z : 0);
                  const scale = Math.max(0.5, (n.val || 3) * 0.3);
                  tmpObj.scale.setScalar(scale);
                  tmpObj.updateMatrix();
                  instancedMesh.setMatrixAt(idx, tmpObj.matrix);
                }
                try { (instancedMesh as any).instanceMatrix.needsUpdate = true; } catch(e) {}
                try { (instancedMesh as any).instanceColor && ((instancedMesh as any).instanceColor.needsUpdate = true); } catch(e) {}
              }
            }
          } catch(e) {}

          // --- NEW: update Points positions in bulk (cheap)
          try {
            if (pointsSystem) {
              const posAttr = (pointsSystem.geometry.getAttribute('position') as THREE.BufferAttribute);
              const arr = posAttr.array as Float32Array;
              for (let i = 0; i < (liveNodes || []).length; i++) {
                const n = liveNodes[i] || {};
                arr[i*3] = typeof n.x === 'number' ? n.x : 0;
                arr[i*3+1] = typeof n.y === 'number' ? n.y : 0;
                arr[i*3+2] = typeof n.z === 'number' ? n.z : 0;
              }
              posAttr.needsUpdate = true;
            }
          } catch(e) {}

          // Update troika labels / fallback sprites positions
          try {
            for (let i = 0; i < troikaLabels.length; i++) {
              const entry = troikaLabels[i];
              const node = nodeById.get(entry.id) || (localGraph.nodes || []).find((n:any) => n.id === entry.id);
              if (!node) continue;
              try { entry.label.position.set(node.x || 0, node.y || 0, node.z || 0); } catch(e) {}
            }
            for (let i = 0; i < troikaFallbackSprites.length; i++) {
              const sp = troikaFallbackSprites[i];
              const id = (sp as any).userData && (sp as any).userData.id;
              const node = nodeById.get(id) || (localGraph.nodes || []).find((n:any) => n.id === id);
              if (!node) continue;
              try { sp.position.set(node.x || 0, node.y || 0, node.z || 0); } catch(e) {}
            }
          } catch(e) {}

          // Update cluster sprites positions only when camera moved significantly or nodes changed
          let cameraMoved = false;
          try {
            if (camera && (camera as any).position) {
              const cp = (camera as any).position;
              const dx = (cp.x - lastCameraPos.x) || 0;
              const dy = (cp.y - lastCameraPos.y) || 0;
              const dz = (cp.z - lastCameraPos.z) || 0;
              const distSq = dx*dx + dy*dy + dz*dz;
              if (isNaN(lastCameraPos.x) || distSq > 100) { // threshold ~10 units
                cameraMoved = true;
                lastCameraPos.x = cp.x; lastCameraPos.y = cp.y; lastCameraPos.z = cp.z;
              }
            } else {
              cameraMoved = true;
            }
          } catch(e) { cameraMoved = true; }

          for (const it of sprites) {
            let sx = 0, sy = 0, sz = 0, cnt = 0;
            for (let i = 0; i < it.ids.length; i++) {
              const id = it.ids[i];
              const node = nodeById.get(id) || (localGraph.nodes || []).find((n:any) => n.id === id);
              if (!node) continue;
              if (typeof node.x === 'number' && typeof node.y === 'number') { sx += node.x; sy += node.y; sz += (typeof node.z === 'number' ? node.z : 0); cnt++; }
            }
            if (cnt === 0) continue;
            const px = sx / cnt, py = sy / cnt, pz = sz / cnt;
            try { if (cameraMoved) it.sprite.position.set(px, py, pz); } catch (e) {}

            // scale label only when camera moved (avoids constant updates)
            try {
              if (cameraMoved && camera && (camera as any).position) {
                const camPos = (camera as any).position;
                const dx = camPos.x - px, dy = camPos.y - py, dz = camPos.z - pz;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
                // LOD: hide very distant labels and clamp scale
                const MAX_DIST = PERF_MODE_AGGRESSIVE ? 1200 : 2000;
                if (dist > MAX_DIST) { it.sprite.visible = false; continue; }
                it.sprite.visible = true;
                const base = (it.sprite as any).__baseTextHeight || 8;
                const REF = 600;
                const sens = Math.max(0.1, Number(sensitivity) || 1);
                const scaled = Math.max(2, Math.min(PERF_MODE_AGGRESSIVE ? 50 : 200, base * (dist / REF) * sens));
                const canvasEl: HTMLCanvasElement | undefined = (it.sprite as any).__canvas;
                const aspect = canvasEl ? (canvasEl.width / canvasEl.height || 1) : (it.sprite.scale.x / (it.sprite.scale.y || 1));
                try { it.sprite.scale.set(aspect * scaled, scaled, 1); } catch (e) {}
              }
            } catch (e) {}
           }

          // update per-node labels positions if any
          try {
            nodeLabelCache.current.forEach((lbl, key) => {
              try {
                const parts = (key || '').split('|');
                const nodeId = parts[1];
                const node = nodeById.get(nodeId) || (localGraph.nodes || []).find((n:any) => n.id === nodeId);
                if (!node) return;
                const px = (typeof node.x === 'number') ? node.x : 0;
                const py = (typeof node.y === 'number') ? node.y : 0;
                const pz = (typeof node.z === 'number') ? node.z : 0;
                lbl.position.set(px, py +  (Math.max(0.6, (node.val || 3) * 0.3) + 2), pz);
                // scale by camera distance
                if (camera && (camera as any).position) {
                  const camPos = (camera as any).position;
                  const dx = camPos.x - px, dy = camPos.y - py, dz = camPos.z - pz;
                  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
                  const base = (lbl as any).__baseTextHeight || 4;
                  const REF = 600;
                  const sens = Math.max(0.1, Number(sensitivity) || 1);
                  const scaled = Math.max(1, Math.min(80, base * (dist / REF) * sens));
                  const canvasEl: HTMLCanvasElement | undefined = (lbl as any).__canvas;
                  const aspect = canvasEl ? (canvasEl.width / canvasEl.height || 1) : (lbl.scale.x / (lbl.scale.y || 1));
                  lbl.scale.set(aspect * scaled, scaled, 1);
                }
              } catch(e) {}
            });
          } catch(e) {}
        } catch(e) {}
        try {
          // Persist positions periodically so other components can reuse them immediately
          try {
            const now = Date.now();
            if (now - lastPersist > PERSIST_INTERVAL) {
              lastPersist = now;
              const live = (fgRef.current && typeof fgRef.current.graphData === 'function') ? fgRef.current.graphData() : null;
              const ln = live && live.nodes ? live.nodes : (localGraph.nodes || []);
              const posMap: Record<string, {x?: number; y?: number; z?: number}> = {};
              for (let i = 0; i < (ln || []).length; i++) {
                const n = ln[i]; if (!n || !n.id) continue; posMap[n.id] = { x: n.x, y: n.y, z: n.z };
              }
              try { if (typeof window !== 'undefined') { (window as any).__CPP_RELATIONS_NODE_POSITIONS__ = posMap; console.debug('[ForceGraph3DView] periodic persist positions, count=', Object.keys(posMap).length); } } catch(e) {}
              // persist camera as well
              try {
                const cam = getCamera();
                if (cam) {
                  const p = (cam as any).position;
                  const q = (cam as any).quaternion;
                  try { (window as any).__CPP_RELATIONS_CAMERA__ = { pos: { x: p.x, y: p.y, z: p.z }, quat: { x: q.x, y: q.y, z: q.z, w: q.w } }; } catch(e) {}
                }
              } catch(e) {}
            }
          } catch(e) {}
        } catch(e) {}
      }, intervalMs) as unknown as number;

    } catch (e) {
      console.warn('[ForceGraph3DView] computeClusters error:', e);
    }

    return () => {
      try { if (clusterGroupRef.current) clusterGroupRef.current.visible = false; } catch (e) {}
      // Persist current node positions so 2D view can reuse them and skip re-layout animation
      try {
        const liveGraph = (fgRef.current && typeof fgRef.current.graphData === 'function') ? fgRef.current.graphData() : (fgRef.current && fgRef.current.graphData);
        const nodes = liveGraph && liveGraph.nodes ? liveGraph.nodes : null;
        if (nodes && typeof window !== 'undefined') {
          const posMap: Record<string, {x?: number; y?: number; z?: number}> = {};
          for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            if (n && n.id) posMap[n.id] = { x: n.x, y: n.y, z: n.z };
          }
          try { (window as any).__CPP_RELATIONS_NODE_POSITIONS__ = posMap; } catch(e) {}
        }
      } catch(e) {}
      try { if (intervalId) window.clearInterval(intervalId); } catch(e) {}

      // --- NEW: cleanup points & troika labels
      try {
        const oldPoints = scene.getObjectByName('__points_nodes__');
        if (oldPoints) {
          try { scene.remove(oldPoints); (oldPoints as any).geometry && (oldPoints as any).geometry.dispose && (oldPoints as any).geometry.dispose(); } catch(e) {}
          try { (oldPoints as any).material && (oldPoints as any).material.dispose && (oldPoints as any).material.dispose(); } catch(e) {}
        }
      } catch(e) {}

      try {
        // remove troika labels if any
        try {
          troikaLabels.forEach((t) => { try { scene.remove(t.label); (t.label as any).dispose && (t.label as any).dispose(); } catch(e) {} });
        } catch(e) {}
        try { troikaFallbackSprites.forEach(s => { try { scene.remove(s); (s.material as any).map && (s.material as any).map.dispose && (s.material as any).map.dispose(); (s.material as any).dispose && (s.material as any).dispose(); } catch(e) {} }); } catch(e) {}
      } catch(e) {}
    };
  }, [showClusterLabels, localGraph, sensitivity]);

  // fallback color generator
  const colorFromName = (name: string) => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    const sat = 60 + (h % 20);
    const light = 45 + (h % 10);
    return `hsl(${hue} ${sat}% ${light}%)`;
  };

  const defaultColorForName = (name?: string) => {
    if (!name) return '#888888';
    const n = name.toLowerCase();
    const parts = n.split('/');
    const base = parts[parts.length - 1] || n;
    const ext = base.split('.').pop() || '';
    if (ext === 'h' || ext === 'hpp') return '#4169E1';
    if (ext === 'cpp' || ext === 'c' || ext === 'cc' || ext === 'cxx') return '#32CD32';
    if (ext === 'cmake' || base.toLowerCase() === 'cmakelists.txt') return '#22c55e';
    if (ext === 'json') return '#eab308';
    if (ext === 'glsl' || ext === 'vert' || ext === 'frag') return '#a855f7';
    return colorFromName(base);
  };

  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={localGraph}
      onNodeClick={onNodeClick}
      nodeOpacity={performanceMode ? 0 : 1}
      nodeAutoColorBy="group"
      linkDirectionalParticles={0}
      linkCurvature={0.2}
      nodeThreeObject={(node: any) => {
        // In aggressive/performance mode we use InstancedMesh; skip per-node Mesh creation
        if (performanceMode) return null;
        const nodeColor = node.color || defaultColorForName(node.name);
        let mat = materialCache.current.get(nodeColor);
        if (!mat) {
          mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(nodeColor) });
          mat.depthWrite = false;
          materialCache.current.set(nodeColor, mat);
        }
        const radius = Math.max(0.5, (node.val || 3) * 0.3);
        const mesh = new THREE.Mesh(sharedSphereGeom, mat);
        mesh.scale.setScalar(radius);
        mesh.userData = { id: node.id };

        // Attach a small label sprite for main-like nodes (cached)
        try {
          if (isMainNode(node)) {
            const nodeKey = `node|${node.id}|${node.name}`;
            let lbl = nodeLabelCache.current.get(nodeKey);
            if (!lbl) {
              const s = (node.name || node.id || '').toString().slice(0, 40);
              lbl = createLabelSprite(s, node.color || nodeColor, 3);
              if (lbl) {
                lbl.frustumCulled = true;
                (lbl as any).renderOrder = 1000010;
                nodeLabelCache.current.set(nodeKey, lbl);
              }
            }
            if (lbl) {
              lbl.position.set(0, radius + 1.5, 0);
              mesh.add(lbl);
            }
          }
        } catch (e) {}

        return mesh as any;
      }}
      rendererConfig={{ antialias: false, powerPreference: 'low-power' }}
      d3AlphaDecay={0.05}
      d3VelocityDecay={0.5}
      enableNodeDrag={false}
    />
  );
};

export default ForceGraph3DView;
