import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { generateGalaxyPositions } from './UniverseGenerator-Updated';

// Local graph node/link types (avoid DOM Node conflicts)
type GNode = { id: string; name?: string; val?: number; color?: string };

// Добавляем компонент Planet
const Planet: React.FC<{ position: THREE.Vector3; size: number; color: string; name?: string; onClick?: () => void; rotate?: boolean; rotationSpeed?: number; satellites?: number; satellitesOrbitSpeed?: number }> = ({ position, size, color, name, onClick, rotate = false, rotationSpeed = 0.002, satellites = 0, satellitesOrbitSpeed = 0.004 }) => {
  const [hover, setHover] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const { camera } = useThree();

  // Защита: иногда position приходит как plain object/array — приводим к Vector3
  const pos = position instanceof THREE.Vector3 ? position : new THREE.Vector3((position as any).x ?? (position as any)[0] ?? 0, (position as any).y ?? (position as any)[1] ?? 0, (position as any).z ?? (position as any)[2] ?? 0);

  // группа для вращения планеты и её атмосферы
  const groupRef = useRef<THREE.Group>(null);
  const satsRef = useRef<THREE.Group>(null);

  // генерация параметров спутников один раз
  const satellitesData = useMemo(() => {
    const arr: { angle: number; radius: number; size: number; phase: number }[] = [];
    // снизим safety cap чтобы избежать слишком больших кол-в спутников
    const maxSat = Math.min(satellites, 12);
    for (let i = 0; i < maxSat; i++) {
      const angle = Math.random() * Math.PI * 2;
      // радиус от поверхности планеты: базовый от размера + добавочный шаг
      const baseRadius = Math.max(1.6, 1.6 + (i + 1) * (0.6 + Math.random() * 0.6));
      const radius = baseRadius * (1 + (size - 1) * 0.25);
      // уменьшили базовый размер спутников: теперь они очень маленькие относительно планеты
      const satSize = Math.max(0.02, Math.min(0.3, size * (0.02 + Math.random() * 0.03)));
      const phase = Math.random() * Math.PI * 2;
      arr.push({ angle, radius, size: satSize, phase });
    }
    return arr;
  }, [satellites, size]);

  // проверяем расстояние до камеры и обновляем видимость подписи
  useFrame(() => {
    const dist = camera.position.distanceTo(pos);
    const threshold = Math.max(60, 40 * (size || 1)); // порог видимости подписи
    const shouldShow = dist < threshold;
    if (shouldShow !== showLabel) setShowLabel(shouldShow);

    // вращение планеты (если включено)
    if (rotate && groupRef.current) {
      groupRef.current.rotation.y += rotationSpeed;
    }

    // вращение группы спутников вокруг планеты — замедляем дополнительно здесь для видимости
    if (satsRef.current && satellitesData.length) {
      // multiply by small factor чтобы не было слишком быстрого движения
      satsRef.current.rotation.y += satellitesOrbitSpeed * 0.08;
    }
  });

  // курсор при ховере
  const onPointerOver = (e: any) => {
    e.stopPropagation();
    setHover(true);
    (document.body.style as any).cursor = 'pointer';
  };
  const onPointerOut = (e: any) => {
    e.stopPropagation();
    setHover(false);
    (document.body.style as any).cursor = '';
  };

  return (
    <group ref={groupRef} position={pos} scale={size} frustumCulled={false} renderOrder={500}>
      <mesh
        position={[0, 0, 0]}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        {/* Увеличенная детализация сферы чтобы она выглядела гладкой, не полигоной */}
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={color}
          roughness={hover ? 0.25 : 0.6}
          metalness={0.35}
          emissive={color}
          emissiveIntensity={hover ? 0.45 : 0.22}
          flatShading={false}
          dithering
        />
      </mesh>

      {/* Лёгкая атмосфера/ореол, немного побольше радиуса, чтобы создать эффект объёма */}
      <mesh position={[0, 0, 0]} scale={1.12} frustumCulled={false} renderOrder={490}>
        <sphereGeometry args={[1.02, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.09} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Спутники (визуальные) */}
      {satellitesData.length > 0 && (
        <group ref={satsRef}>
          {satellitesData.map((s, idx) => (
            <mesh key={idx} position={[Math.cos(s.angle) * s.radius, 0, Math.sin(s.angle) * s.radius]} renderOrder={480}>
              {/* у спутников ещё уменьшена детализация и размеры для непринужденной визуализации */}
              <sphereGeometry args={[Math.max(0.02, s.size), 6, 4]} />
              <meshStandardMaterial color={'#CCCCCC'} roughness={0.8} metalness={0.1} />
            </mesh>
          ))}
        </group>
      )}

      {showLabel && name && (
        <Text
          position={[0, Math.max(1.5, size) * 1.8, 0]}
          fontSize={Math.max(1.2, size * 0.8)}
          color="#ffffff"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.12}
          outlineColor="#000000"
          renderOrder={600}
        >
          {name}
        </Text>
      )}
    </group>
  );
};

// Добавляем getColorForFile
const getColorForFile = (name?: string): string => {
  if (!name) return '#888888';
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'h' || ext === 'hpp') return '#4169E1'; // голубой
  if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') return '#32CD32'; // зелёный
  if (ext === 'json') return '#eab308'; // жёлтый
  return '#888888';
};

// Улучшенные цвета туманности
const getNebulaColors = (systemName: string): string[] => {
  const colorMap: Record<string, string[]> = {
    'engine': ['#FF3D3D', '#FF6B35', '#FF8E53'],
    'renderer': ['#00C9A7', '#4ECDC4', '#7DDEF7'],
    'physics': ['#9D4EDD', '#C77DFF', '#E0AAFF'],
    'ui': ['#06FFA5', '#34D399', '#6EE7B7'],
    'network': ['#FFB703', '#FBBF24', '#FDE047'],
    'audio': ['#FF006E', '#F72585', '#FF70A6'],
    'tests': ['#D97706', '#F59E0B', '#FBBF24'],
    'config': ['#EC4899', '#F472B6', '#FBCFE8'],
    'misc': ['#6B7280', '#9CA3AF', '#D1D5DB']
  };
  return colorMap[systemName.toLowerCase()] || colorMap['misc'];
};

const SpiralArm: React.FC<{ center: THREE.Vector3; armIndex: number; totalArms: number; radius: number; color: string }> = ({ center, armIndex, totalArms, radius, color }) => {
  const particles = useMemo(() => {
    const count = 200;
    const positions = new Float32Array(count * 3);
    const angleOffset = (armIndex / totalArms) * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const angle = angleOffset + t * Math.PI * 4; // 2 turns
      const r = radius * 0.3 + t * radius * 0.7;
      const height = (Math.random() - 0.5) * 15;
      positions[i * 3] = center.x + Math.cos(angle) * r;
      positions[i * 3 + 1] = center.y + height;
      positions[i * 3 + 2] = center.z + Math.sin(angle) * r;
    }
    return positions;
  }, [center, armIndex, totalArms, radius]);

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particles.length / 3} array={particles} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={1.5} color={color} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
};

// Размер планеты: логарифмическое масштабирование от val (байты/значимость)
const getPlanetSize = (val?: number) => {
  const base = Math.max(256, val || 256);
  const size = 0.8 + Math.log10(base) * 0.45;
  return Math.max(0.5, Math.min(size, 6));
};

// helper: определяем количество спутников для планеты по её визуальному размеру
const getSatelliteCount = (size: number) => {
  // size — визуальный масштаб, 0.5..6
  if (!size || size < 1.3) return 0; // мелкие объекты — без спутников
  if (size < 2.0) return Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 2); // 0-1
  if (size < 3.0) return Math.floor(Math.random() * 3); // 0-2
  if (size < 4.0) return 1 + Math.floor(Math.random() * 4); // 1-4
  if (size < 5.0) return 1 + Math.floor(Math.random() * 6); // 1-6
  // very large: but keep safe upper bound
  return 2 + Math.floor(Math.random() * 9); // 2-10
};

const GalaxyGroup: React.FC<{
  name: string;
  nodes: GNode[];
  center: THREE.Vector3;
  onNodeClick?: (n: GNode) => void;
  rotate?: boolean;
  rotationSpeed?: number;
  planetRotate?: boolean;
  planetRotationSpeed?: number;
}> = ({ name, nodes, center, onNodeClick, rotate = false, rotationSpeed = 0.001, planetRotate = false, planetRotationSpeed = 0.002 }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (rotate && groupRef.current) groupRef.current.rotation.y += rotationSpeed;
  });

  const placed = useMemo(() => generateGalaxyPositions(nodes as any, center, { arms: 3 }), [nodes, center]);
  const nebulaColors = getNebulaColors(name);

  // Убедимся, что для каждого узла есть планета: если placed меньше nodes, создаём fallback-позиции
  const planetEntries = useMemo(() => {
    const n = nodes.length;
    const entries: any[] = [];
    for (let i = 0; i < n; i++) {
      const p = placed && placed[i];
      if (p && p.node) {
        entries.push(p);
        continue;
      }
      const angle = (i / Math.max(1, n)) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const r = 30 + Math.random() * 120;
      const x = center.x + Math.cos(angle) * r;
      const y = center.y + (Math.random() - 0.5) * 40;
      const z = center.z + Math.sin(angle) * r;
      const node = nodes[i];
      const computedSize = Math.max(0.6, 0.6 + (Math.log10((node?.val || 1024)) * 0.2));
      const satellites = getSatelliteCount(computedSize);
      entries.push({ node, pos: new THREE.Vector3(x, y, z), size: computedSize, satellites });
    }

    // ensure placed entries also get satellites if missing
    for (let j = 0; j < entries.length; j++) {
      if (entries[j] && typeof entries[j].satellites === 'undefined') {
        const sSize = entries[j].size || getPlanetSize(entries[j].node?.val as number);
        entries[j].satellites = getSatelliteCount(sSize);
      }
    }

    return entries;
  }, [placed, nodes, center]);

  return (
    <group ref={groupRef}>
      {/* === VOLMETRIC NEBULA (points fallback) === */}
      <points position={center} frustumCulled={false} renderOrder={50}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={600}
            array={(() => {
              const arr = new Float32Array(600 * 3);
              for (let i = 0; i < 600; i++) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = Math.cbrt(Math.random()) * 150;
                arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
                arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
                arr[i * 3 + 2] = r * Math.cos(phi);
              }
              return arr;
            })()}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.8} color={nebulaColors[0]} transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>

      <points position={center} frustumCulled={false} renderOrder={51}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={400}
            array={(() => {
              const arr = new Float32Array(400 * 3);
              for (let i = 0; i < 400; i++) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = Math.cbrt(Math.random()) * 100;
                arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
                arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
                arr[i * 3 + 2] = r * Math.cos(phi);
              }
              return arr;
            })()}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.7} color={nebulaColors[1]} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>

      {/* spiral arms */}
      {[0, 1, 2].map(i => (
        <SpiralArm key={i} center={center} armIndex={i} totalArms={3} radius={120} color={nebulaColors[1]} />
      ))}

      {/* BLACK HOLE (stable fallback) */}
      <mesh position={center} scale={1.5} renderOrder={100}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      <mesh position={center} scale={1.75} renderOrder={110}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.18} side={THREE.BackSide} />
      </mesh>

      <mesh position={center} rotation={[Math.PI / 2, 0, 0]} renderOrder={120}>
        <ringGeometry args={[2.2, 7, 64]} />
        <meshBasicMaterial color="#FFFACD" transparent opacity={0.9} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={center} rotation={[Math.PI / 2, 0, 0]} renderOrder={121}>
        <ringGeometry args={[7, 8, 64]} />
        <meshBasicMaterial color="#FFA500" transparent opacity={0.6} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* jets */}
      {[1, -1].map((direction, i) => (
        <mesh key={i} position={[center.x, center.y + direction * 4, center.z]} rotation={[direction > 0 ? Math.PI : 0, 0, 0]} renderOrder={130}>
          <coneGeometry args={[0.7, 12, 32]} />
          <meshBasicMaterial color="#76F2F2" transparent opacity={0.45} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}

      <pointLight position={center} intensity={5} distance={180} color="#FFA500" decay={2} />

      {/* planets */}
      {planetEntries.map((p: any, i: number) => {
        let pos: THREE.Vector3;
        if (!p || !p.pos) {
          pos = new THREE.Vector3(center.x + (Math.random() - 0.5) * 30, center.y + (Math.random() - 0.5) * 20, center.z + (Math.random() - 0.5) * 30);
        } else if (p.pos instanceof THREE.Vector3) {
          pos = p.pos;
        } else if (Array.isArray(p.pos)) {
          pos = new THREE.Vector3(p.pos[0] ?? 0, p.pos[1] ?? 0, p.pos[2] ?? 0);
        } else {
          pos = new THREE.Vector3(p.pos.x ?? 0, p.pos.y ?? 0, p.pos.z ?? 0);
        }

        const size = p.size ? p.size : getPlanetSize(p.node?.val as number);

        return (
          <Planet
            key={p.node?.id || i}
            position={pos}
            size={size}
            color={getColorForFile(p.node?.name)}
            name={p.node?.name}
            onClick={() => onNodeClick?.(p.node)}
            // прокидываем настройки вращения планет
            rotate={planetRotate}
            rotationSpeed={planetRotationSpeed}
            satellites={p.satellites || 0}
            // ещё более медленные орбиты: маленький диапазон скоростей
            satellitesOrbitSpeed={0.00015 + (Math.random() * 0.0006)}
          />
        );
      })}

      <Text position={[center.x, center.y + 160, center.z]} fontSize={6} color="#FFD700" anchorX="center" anchorY="middle" outlineWidth={0.3} outlineColor="#000000">
        {name}
      </Text>
    </group>
  );
};

// Простой ErrorBoundary для отображения рантайм ошибок в UI
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error('ErrorBoundary caught', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'white', padding: 20 }}>
          <h3>Unexpected error in Universe renderer</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children as any;
  }
}

export function Experience() {
  const [rotationSettings, setRotationSettings] = useState({
    galaxyRotationEnabled: false,
    galaxyRotationSpeed: 0.001,
    planetRotationEnabled: false,
    planetRotationSpeed: 0.002,
  });

  // Увеличим количество файлов на систему до 25-50
  const systemNames = useMemo(() =>
    Object.keys(systemsData).length
      ? Object.keys(systemsData)
      : ['engine','renderer','physics','ui','network','audio','config','tests','core','utils'],
    []
  );

  const systemsNodes = useMemo(() => {
    return systemNames.map((name) => {
      const sample = systemsData[name];
      if (sample && Array.isArray(sample.nodes)) return { name, nodes: sample.nodes };

      // УВЕЛИЧИЛИ КОЛИЧЕСТВО: от 25 до 50 файлов
      const fileCount = 25 + Math.floor(Math.random() * 26); // 25-50 файлов
      const nodeIds = Array.from({ length: fileCount }, (_, i) => `${name}-node-${i + 1}`);

      const extensions = ['cpp', 'hpp', 'cc', 'h', 'cxx', 'json', 'txt', 'md', 'cmake'];

      const nodes = nodeIds.map((id, i) => {
        const ext = extensions[Math.floor(Math.random() * extensions.length)];
        return {
          id,
          name: `${name}_${i + 1}.${ext}`,
          // Размер файлов: от 100 байт до 500 КБ
          val: Math.floor(100 + Math.random() * 500000),
          color: getColorForFile(`file.${ext}`)
        };
      });
      return { name, nodes };
    });
  }, [systemNames]);

  const handleNodeClick = (_node: GNode) => {
    console.log('Clicked:', _node?.name);
  };

  // Расположим галактики вокруг центра
  const galaxyPositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const total = systemsNodes.length;
    const ringRadius = 400; // увеличили расстояние между галактиками
    for (let i = 0; i < total; i++) {
      const angle = (i / total) * Math.PI * 2;
      const x = Math.cos(angle) * ringRadius;
      const z = Math.sin(angle) * ringRadius;
      const y = Math.sin(angle * 2) * 80;
      positions.push(new THREE.Vector3(x, y, z));
    }
    return positions;
  }, [systemsNodes]);

  return (
    <>
      <ErrorBoundary>
        <Canvas
          camera={{ position: [0, 200, 400], fov: 60, near: 0.1, far: 10000 }}
          gl={{ antialias: true, alpha: false }}
          style={{ background: '#000816' }}
        >
          <ambientLight intensity={0.15} />
          <pointLight position={[100, 200, 100]} intensity={1.2} color="#ffffff" />
          <Stars radius={800} depth={80} count={8000} factor={6} saturation={0.3} />

          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            minDistance={20}
            maxDistance={2500}
            rotateSpeed={0.5}
            zoomSpeed={0.8}
          />

          {/* Центральное ядро вселенной */}
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[8, 32, 32]} />
            <meshStandardMaterial
              color="#FFD700"
              emissive="#FFA500"
              emissiveIntensity={2}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
          <pointLight position={[0, 0, 0]} intensity={20} distance={600} color="#FFD700" />

          {/* Рендерим все галактики */}
          {systemsNodes.map((s, i) => (
            <GalaxyGroup
              key={s.name}
              name={s.name.toUpperCase()}
              nodes={s.nodes}
              center={galaxyPositions[i]}
              onNodeClick={handleNodeClick}
              rotate={rotationSettings.galaxyRotationEnabled}
              rotationSpeed={rotationSettings.galaxyRotationSpeed}
              planetRotate={rotationSettings.planetRotationEnabled}
              planetRotationSpeed={rotationSettings.planetRotationSpeed}
            />
          ))}
        </Canvas>

        {/* Rotation settings panel */}
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(0,0,0,0.7)',
          padding: '15px',
          borderRadius: '8px',
          color: '#fff',
          fontSize: '13px',
          fontFamily: 'monospace',
          minWidth: '200px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>
            Rotation settings
          </div>

          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rotationSettings.galaxyRotationEnabled}
              onChange={(e) => setRotationSettings(s => ({ ...s, galaxyRotationEnabled: e.target.checked }))}
              style={{ marginRight: '8px' }}
            />
            Galaxy rotation
          </label>

          <div style={{ marginLeft: '20px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>Speed</div>
            <input
              type="range"
              min="0"
              max="0.02"
              step="0.0001"
              value={rotationSettings.galaxyRotationSpeed}
              onChange={(e) => setRotationSettings(s => ({ ...s, galaxyRotationSpeed: Number(e.target.value) }))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '11px', opacity: 0.7 }}>{rotationSettings.galaxyRotationSpeed.toFixed(4)}</div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rotationSettings.planetRotationEnabled}
              onChange={(e) => setRotationSettings(s => ({ ...s, planetRotationEnabled: e.target.checked }))}
              style={{ marginRight: '8px' }}
            />
            Planet rotation
          </label>

          <div style={{ marginLeft: '20px' }}>
            <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>Speed</div>
            <input
              type="range"
              min="0"
              max="0.02"
              step="0.0001"
              value={rotationSettings.planetRotationSpeed}
              onChange={(e) => setRotationSettings(s => ({ ...s, planetRotationSpeed: Number(e.target.value) }))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '11px', opacity: 0.7 }}>{rotationSettings.planetRotationSpeed.toFixed(4)}</div>
          </div>
        </div>
      </ErrorBoundary>
    </>
  );
}

export default Experience;

// Данные систем (оставляем пустой объект — реальные данные приходят сверху)
const systemsData: Record<string, any> = {};
