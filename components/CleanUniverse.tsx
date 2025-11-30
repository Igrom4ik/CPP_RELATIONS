import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Stars } from '@react-three/drei';
import * as THREE from 'three';

interface Node {
  id: string;
  name: string;
  val?: number;
  color?: string;
}

interface Link {
  source: string;
  target: string;
}

// === АНАЛИЗ СТРУКТУРЫ ===
const analyzeProjectStructure = (nodes: Node[]) => {
  const subsystems = new Map<string, Node[]>();

  nodes.forEach(node => {
    const name = node.name?.toLowerCase() || '';
    let system = 'misc';

    if (name.includes('engine')) system = 'engine';
    else if (name.includes('render')) system = 'renderer';
    else if (name.includes('physics')) system = 'physics';
    else if (name.includes('ui') || name.includes('gui')) system = 'ui';
    else if (name.includes('network')) system = 'network';
    else if (name.includes('audio')) system = 'audio';
    else if (name.includes('cmake') || name.includes('json')) system = 'config';
    else if (name.includes('test')) system = 'tests';

    if (!subsystems.has(system)) subsystems.set(system, []);
    subsystems.get(system)!.push(node);
  });

  return subsystems;
};

// === ЦВЕТА ФАЙЛОВ ===
const getColorForFile = (name?: string): string => {
  if (!name) return '#888888';
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'h' || ext === 'hpp') return '#4169E1';
  if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') return '#32CD32';
  if (ext === 'json') return '#eab308';
  return '#888888';
};

// === ПЛАНЕТА ===
const Planet: React.FC<{ node: Node; position: THREE.Vector3; size: number; onClick?: () => void }> = ({ node, position, size, onClick }) => {
  const ref = useRef<THREE.Mesh | null>(null);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.rotation.y += 0.006;
  });

  return (
    <mesh ref={ref} position={position as any} onClick={onClick} castShadow receiveShadow>
      <sphereGeometry args={[size, 12, 12]} />
      <meshStandardMaterial color={node.color || getColorForFile(node.name)} roughness={0.5} metalness={0.1} />
    </mesh>
  );
};

// === LINKS: оптимизированный рендер через LineSegments ===
const Links: React.FC<{ pairs: Array<[THREE.Vector3, THREE.Vector3]>; color?: string; opacity?: number }> = ({ pairs, color = '#1a6d7a', opacity = 0.15 }) => {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    pairs.forEach(([a, b]) => {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3));
    return g;
  }, [pairs]);

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial attach="material" color={color} transparent opacity={opacity} linewidth={1} />
    </lineSegments>
  );
};

// === GALAXY ===
const Galaxy: React.FC<{ name: string; nodes: Node[]; center: THREE.Vector3; onNodeClick?: (n: Node) => void }>
  = ({ name, nodes, center, onNodeClick }) => {
  // spiral params
  const arms = 3;
  const maxRadius = 90;
  const bulge = 10;

  // compute node positions in a spiral arm distribution
  const nodePlaces = useMemo(() => {
    const arr: { node: Node; pos: THREE.Vector3; size: number }[] = [];
    const n = Math.max(1, nodes.length);

    for (let i = 0; i < n; i++) {
      const t = i / n; // 0..1
      const armIndex = i % arms;
      // logarithmic spiral angle
      const angle = (t * Math.PI * 2 * 2.5) + (armIndex * (2 * Math.PI / arms));
      const radius = bulge + t * maxRadius + Math.sin(t * Math.PI * 4) * 6;
      const x = center.x + Math.cos(angle) * radius;
      const z = center.z + Math.sin(angle) * radius;
      const y = center.y + Math.sin(angle * 0.5) * 6;
      const node = nodes[i];
      const importance = (node.val || 3);
      const size = Math.max(0.8, Math.log(importance + 1) * 0.7);
      arr.push({ node, pos: new THREE.Vector3(x, y, z), size });
    }

    return arr;
  }, [nodes, center]);

  // internal links (connect neighbors along spiral)
  const internalPairs = useMemo(() => {
    const pairs: Array<[THREE.Vector3, THREE.Vector3]> = [];
    for (let i = 0; i < nodePlaces.length - 1; i++) {
      pairs.push([nodePlaces[i].pos, nodePlaces[i + 1].pos]);
    }
    return pairs;
  }, [nodePlaces]);

  // small rotation for the whole galaxy group
  const groupRef = useRef<THREE.Group | null>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += 0.0008;
  });

  return (
    <group ref={groupRef}>
      {/* central star of the galaxy */}
      <mesh position={center as any}>
        <sphereGeometry args={[3.5, 12, 12]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFB84D" emissiveIntensity={0.8} />
      </mesh>

      {/* planets */}
      {nodePlaces.map(({ node, pos, size }) => (
        <Planet key={node.id} node={node} position={pos} size={size} onClick={() => onNodeClick?.(node)} />
      ))}

      {/* internal spiral links */}
      <Links pairs={internalPairs} color="#2a6d7a" opacity={0.25} />

      {/* galaxy label */}
      <Text position={[center.x, center.y + 20, center.z]} fontSize={3} color="#FFD700" anchorX="center" anchorY="middle">
        {name}
      </Text>
    </group>
  );
};

// === CleanUniverse (главный компонент) ===
const getGalaxyCenters = (systems: string[]) => {
  const centers: Record<string, THREE.Vector3> = {};
  const total = systems.length;
  const baseRadius = 350;
  systems.forEach((name, i) => {
    const angle = (i / total) * Math.PI * 2;
    const radius = baseRadius + Math.sin(angle * 3) * 40;
    const height = Math.cos(angle * 2) * 60;
    centers[name] = new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
  });
  return centers;
};

const CleanUniverse: React.FC<{ data: { nodes: Node[]; links: Link[] }; onNodeClick?: (n: Node) => void }>
  = ({ data, onNodeClick }) => {
  const subsystems = useMemo(() => analyzeProjectStructure(data.nodes), [data.nodes]);
  const systemNames = useMemo(() => Array.from(subsystems.keys()), [subsystems]);
  const centers = useMemo(() => getGalaxyCenters(systemNames), [systemNames]);

  // build intergalactic connections between galaxy centers (if any cross-system links exist)
  const interPairs = useMemo(() => {
    const pairs: Array<[THREE.Vector3, THREE.Vector3]> = [];
    // map node id to system
    const nodeToSystem = new Map<string, string>();
    subsystems.forEach((nodes, system) => nodes.forEach(n => nodeToSystem.set(n.id, system)));

    const seen = new Set<string>();
    data.links.forEach(l => {
      const a = nodeToSystem.get(l.source);
      const b = nodeToSystem.get(l.target);
      if (!a || !b) return;
      if (a === b) return;
      const key = [a, b].sort().join('::');
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push([centers[a], centers[b]]);
    });

    return pairs;
  }, [data.links, subsystems, centers]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [0, 300, 800], fov: 60 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={["#000510"]} />
        <fog attach="fog" args={[new THREE.Color('#000510'), 600, 2600]} />

        <Stars radius={2000} depth={400} count={15000} factor={8} fade speed={0.1} />

        <ambientLight intensity={0.25} />
        <directionalLight position={[300, 400, 300]} intensity={0.6} />

        {/* central supermassive core */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[25, 16, 16]} />
          <meshStandardMaterial color="#FFD700" emissive="#FF6B00" emissiveIntensity={2} />
        </mesh>

        {/* galaxies */}
        {systemNames.map(system => (
          <Galaxy key={system} name={system.toUpperCase()} nodes={subsystems.get(system) || []} center={centers[system]} onNodeClick={onNodeClick} />
        ))}

        {/* intergalactic bridges */}
        <Links pairs={interPairs} color="#1a6d7a" opacity={0.18} />

        <OrbitControls enableDamping dampingFactor={0.05} rotateSpeed={0.3} minDistance={100} maxDistance={3000} />
      </Canvas>
    </div>
  );
};

export default CleanUniverse;

