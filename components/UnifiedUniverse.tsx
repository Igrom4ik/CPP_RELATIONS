import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';
import { galacticLayout } from './RealGalacticLayout';

interface Node {
  id: string;
  name: string;
  val?: number;
  color?: string;
  x?: number;
  y?: number;
  z?: number;
}

interface Link {
  source: string;
  target: string;
}

// === МЕТАГАЛАКТИЧЕСКИЙ ЛЭЙАУТ ===

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

// compute node degrees (importance) from links
const computeDegrees = (nodes: Node[], links: Link[]) => {
  const deg = new Map<string, number>();
  nodes.forEach(n => deg.set(n.id, 0));
  links.forEach(l => {
    if (deg.has(l.source)) deg.set(l.source, (deg.get(l.source) || 0) + 1);
    if (deg.has(l.target)) deg.set(l.target, (deg.get(l.target) || 0) + 1);
  });
  return deg;
};

// Позиционировать галактики вокруг центра (Орбитальная механика)
const getGalaxyPosition = (
  systemName: string,
  index: number,
  totalSystems: number
): THREE.Vector3 => {
  const angle = (index / totalSystems) * Math.PI * 2;
  const radius = 300 + Math.sin(angle * 3) * 100; // Волнистая орбита
  const height = Math.cos(angle * 2) * 150; // Вертикальные колебания

  return new THREE.Vector3(
    Math.cos(angle) * radius,
    height,
    Math.sin(angle) * radius
  );
};

// === ЗВЕЗДНАЯ СИСТЕМА (ГАЛАКТИКА) ===

const Galaxy: React.FC<{
  name: string;
  nodes: Node[];
  centerPosition: THREE.Vector3;
  onNodeClick?: (node: Node) => void;
  degreeMap?: Map<string, number>;
}> = ({ name, nodes, centerPosition, onNodeClick, degreeMap }) => {
  // Важность узлов
  const getImportance = (node: Node): number => {
    const isHeader = /\.(h|hpp)$/i.test(node.name || '');
    return (node.val || 3) * 5 + (isHeader ? 50 : 10);
  };

  // Использовать реалистичную галактическую компоновку для каждой ноды (позиция + скорость)
  const positions = useMemo(() => {
    return nodes.map((node, i) => {
      const baseImportance = getImportance(node);
      // include degree from parent map if provided
      const degree = (degreeMap && degreeMap.get(node.id)) || 0;
      const importance = baseImportance + degree * 3;

      const galPos = galacticLayout.getPosition(i, nodes.length, importance, node.id);
      return {
        node,
        pos: new THREE.Vector3(centerPosition.x + galPos.x, centerPosition.y + galPos.y, centerPosition.z + galPos.z),
        offset: new THREE.Vector3(galPos.x, galPos.y, galPos.z),
        velocity: { ...galPos.velocity },
        importance,
        distFromCenter: galPos.distFromCenter,
      };
    });
  }, [nodes, centerPosition, degreeMap]);

  // Внутренние связи (спиральные рукава)
  const internalLinks = useMemo(() => {
    return positions
      .slice(0, -1)
      .map((item, i) => {
        const next = positions[i + 1];
        return (
          <Line
            key={`${item.node.id}-${next.node.id}`}
            points={[item.pos as any, next.pos as any]}
            color="#2a6d7a"
            lineWidth={0.5}
            transparent
            opacity={0.3}
          />
        );
      });
  }, [positions]);

  // refs and animation for this galaxy
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);
  const instRef = useRef<THREE.InstancedMesh | null>(null);
  const localOffsets = useRef<THREE.Vector3[]>(positions.map(p => p.offset.clone()));
  const velocities = useRef(positions.map(p => ({ ...p.velocity })));

  useEffect(() => {
    localOffsets.current = positions.map(p => p.offset.clone());
    velocities.current = positions.map(p => ({ ...p.velocity }));
    meshRefs.current = meshRefs.current.slice(0, positions.length);
  }, [positions]);

  useFrame((_, delta) => {
    const G = 0.6;
    const damp = 0.995;
    const dummy = new THREE.Object3D();
    if (positions.length >= 200 && instRef.current) {
      for (let i = 0; i < positions.length; i++) {
        const off = localOffsets.current[i];
        const vel = velocities.current[i];
        const r = Math.max(1, off.length());
        const massFactor = Math.max(0.5, positions[i].importance / 50);
        const ax = -G * massFactor * (off.x / (r * r));
        const ay = -G * massFactor * (off.y / (r * r));
        const az = -G * massFactor * (off.z / (r * r));

        vel.x += ax * delta; vel.y += ay * delta; vel.z += az * delta;
        vel.x *= damp; vel.y *= damp; vel.z *= damp;
        off.x += vel.x * delta * 60; off.y += vel.y * delta * 60; off.z += vel.z * delta * 60;

        const worldX = centerPosition.x + off.x;
        const worldY = centerPosition.y + off.y;
        const worldZ = centerPosition.z + off.z;
        const size = Math.max(1, positions[i].importance * 0.08);
        dummy.position.set(worldX, worldY, worldZ);
        dummy.scale.setScalar(size);
        dummy.updateMatrix();
        instRef.current.setMatrixAt(i, dummy.matrix);
      }
      instRef.current.instanceMatrix.needsUpdate = true;
      instRef.current.rotation.y += 0.0006;
    } else {
      for (let i = 0; i < positions.length; i++) {
        const mesh = meshRefs.current[i];
        if (!mesh) continue;
        const off = localOffsets.current[i];
        const vel = velocities.current[i];
        const r = Math.max(1, off.length());
        const massFactor = Math.max(0.5, positions[i].importance / 50);
        const ax = -G * massFactor * (off.x / (r * r));
        const ay = -G * massFactor * (off.y / (r * r));
        const az = -G * massFactor * (off.z / (r * r));

        vel.x += ax * delta; vel.y += ay * delta; vel.z += az * delta;
        vel.x *= damp; vel.y *= damp; vel.z *= damp;
        off.x += vel.x * delta * 60; off.y += vel.y * delta * 60; off.z += vel.z * delta * 60;

        mesh.position.set(centerPosition.x + off.x, centerPosition.y + off.y, centerPosition.z + off.z);
      }
    }
  });

  // Центр галактики (звезда главной подсистемы)
  return (
    <group>
      {/* Центральная звезда */}
      <mesh position={centerPosition as any}>
        <sphereGeometry args={[4, 16, 16]} />
        <meshStandardMaterial
          color="#FFD700"
          emissive="#FF8C00"
          emissiveIntensity={2}
        />
      </mesh>

      {/* Свечение */}
      <pointLight
        position={centerPosition as any}
        intensity={1.5}
        distance={150}
        color="#FFD700"
      />

      {/* Планеты в спирали */}
      {positions.length >= 200 ? (
        <instancedMesh ref={instRef as any} args={[undefined, undefined, positions.length]} frustumCulled={false}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color="#999" />
        </instancedMesh>
      ) : (
        positions.map(({ node, pos, importance }, idx) => (
          <mesh key={node.id} ref={el => (meshRefs.current[idx] = el)} position={[pos.x, pos.y, pos.z]} onClick={() => onNodeClick?.(node)}>
            <sphereGeometry args={[Math.max(1, importance * 0.08), 12, 12]} />
            <meshStandardMaterial color={node.color || '#888888'} roughness={0.4} metalness={0.2} />
          </mesh>
        ))
      )}

      {/* Внутренние связи */}
      {internalLinks}

      {/* Label системы */}
      <Text
        position={[
          centerPosition.x,
          centerPosition.y + 120,
          centerPosition.z
        ]}
        fontSize={5}
        color="#FFD700"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.2}
        outlineColor="#000"
      >
        {name}
      </Text>
    </group>
  );
};

// === ГЛАВНАЯ ВСЕЛЕННАЯ ===

const UnifiedUniverse: React.FC<{
  data: { nodes: Node[]; links: Link[] };
  onNodeClick?: (node: Node) => void;
}> = ({ data, onNodeClick }) => {
  // Анализ структуры проекта
  const subsystems = useMemo(
    () => analyzeProjectStructure(data.nodes),
    [data.nodes]
  );

  // degree map for importance
  const degreeMap = useMemo(() => computeDegrees(data.nodes, data.links), [data.nodes, data.links]);

  // Позиции галактик вокруг центрального ядра
  const galaxyPositions = useMemo(() => {
    const positions: Record<string, THREE.Vector3> = {};
    let index = 0;

    subsystems.forEach((nodes, system) => {
      positions[system] = getGalaxyPosition(system, index, subsystems.size);
      index++;
    });

    return positions;
  }, [subsystems]);

  // МЕЖГАЛАКТИЧЕСКИЕ СВЯЗИ (основные зависимости)
  const intergalacticLinks = useMemo(() => {
    const positions = new Map<string, THREE.Vector3>();

    // Построить карту позиций всех узлов
    subsystems.forEach((nodes, system) => {
      const centerPos = galaxyPositions[system];
      nodes.forEach((node, i) => {
        const angle = (i / nodes.length) * Math.PI * 12;
        const radius = 20 + (i / nodes.length) * 80;
        const localX = Math.cos(angle) * radius;
        const localZ = Math.sin(angle) * radius;

        positions.set(node.id, new THREE.Vector3(
          centerPos.x + localX,
          centerPos.y,
          centerPos.z + localZ
        ));
      });
    });

    // Создать связи между галактиками (межсистемные зависимости)
    const systemConnections = new Map<string, Set<string>>();
    subsystems.forEach((_, system) => {
      systemConnections.set(system, new Set());
    });

    data.links.forEach(link => {
      const srcNode = data.nodes.find(n => n.id === link.source);
      const tgtNode = data.nodes.find(n => n.id === link.target);
      if (!srcNode || !tgtNode) return;

      // Определить системы узлов
      let srcSystem = 'misc', tgtSystem = 'misc';
      subsystems.forEach((nodes, system) => {
        if (nodes.find(n => n.id === srcNode.id)) srcSystem = system;
        if (nodes.find(n => n.id === tgtNode.id)) tgtSystem = system;
      });

      if (srcSystem !== tgtSystem) {
        systemConnections.get(srcSystem)?.add(tgtSystem);
      }
    });

    // Рендерить только межсистемные связи (ограничить для производительности)
    const links: React.ReactElement[] = [];
    systemConnections.forEach((targets, source) => {
      targets.forEach(target => {
        const srcPos = galaxyPositions[source];
        const tgtPos = galaxyPositions[target];

        if (srcPos && tgtPos) {
          links.push(
            <Line
              key={`${source}-${target}`}
              points={[srcPos as any, tgtPos as any]}
              color="#1a6d7a"
              lineWidth={1}
              transparent
              opacity={0.15}
            />
          );
        }
      });
    });

    return links;
  }, [subsystems, galaxyPositions, data.nodes, data.links]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 300, 600], fov: 60 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        {/* КОСМОС */}
        <color attach="background" args={["#000510"]} />
        <fog attach="fog" args={[new THREE.Color('#000510'), 500, 2500]} />

        {/* Звезды дальнего фона */}
        <Stars radius={2000} depth={300} count={15000} factor={8} fade speed={0.1} />

        {/* Освещение */}
        <ambientLight intensity={0.15} />
        <directionalLight position={[400, 400, 400]} intensity={0.3} />

        {/* === ЦЕНТРАЛЬНОЕ ЯДРО ВСЕЛЕННОЙ === */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[40, 3]} />
          <meshStandardMaterial
            color="#FFD700"
            emissive="#FF6B00"
            emissiveIntensity={5}
          />
          <pointLight
            position={[0, 0, 0]}
            intensity={4}
            distance={800}
            color="#FFD700"
            decay={2}
          />
        </mesh>

        {/* === ГАЛАКТИЧЕСКИЕ СИСТЕМЫ === */}
        {Array.from(subsystems.entries()).map(([system, nodes]) => {
          const pos = galaxyPositions[system];
          if (!pos || nodes.length === 0) return null;

          return (
            <Galaxy
              key={system}
              name={system.toUpperCase()}
              nodes={nodes}
              centerPosition={pos}
              onNodeClick={onNodeClick}
              degreeMap={degreeMap}
            />
          );
        })}

        {/* === МЕЖГАЛАКТИЧЕСКИЕ СВЯЗИ === */}
        {intergalacticLinks}

        {/* === УПРАВЛЕНИЕ === */}
        <OrbitControls
          enableDamping
          dampingFactor={0.04}
          rotateSpeed={0.3}
          minDistance={100}
          maxDistance={2500}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
};

// stub to avoid import errors (original file archived)
const Stub = () => null;
export default Stub;
