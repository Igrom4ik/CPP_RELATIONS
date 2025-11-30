import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Stars, Sphere } from '@react-three/drei';
import * as THREE from 'three';

interface Node {
  id: string;
  name?: string;
  val?: number;
  color?: string;
  type?: 'entry' | 'header' | 'source' | 'lib';
  x?: number;
  y?: number;
  z?: number;
}

// reusable glow texture
const makeGlowTexture = () => {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.4, 'rgba(255,200,50,0.15)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
};
const GLOW_TEXTURE = makeGlowTexture();

const GlowSprite: React.FC<{ position: [number,number,number]; size?: number; color?: string; visible?: boolean }> = ({ position, size = 30, color = '#FFD700', visible = true }) => {
  if (!GLOW_TEXTURE) return null;
  return (
    <sprite position={position as any} visible={visible} scale={[size, size, 1]}>
      <spriteMaterial map={GLOW_TEXTURE} color={color} blending={THREE.AdditiveBlending} transparent opacity={0.9} depthWrite={false} />
    </sprite>
  );
};

const Label3D: React.FC<{ position: [number,number,number]; text: string; baseSize?: number }> = ({ position, text, baseSize = 3 }) => {
  const ref = useRef<any>(null);
  const { camera } = useThree();
  useFrame(() => {
    if (!ref.current || !camera) return;
    const camPos = (camera as any).position;
    const dx = camPos.x - (position[0] || 0);
    const dy = camPos.y - (position[1] || 0);
    const dz = camPos.z - (position[2] || 0);
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
    const scale = Math.max(0.5, Math.min(6, (dist / 200) * baseSize));
    try { ref.current.scale.set(scale, scale, scale); } catch (e) {}
    try { ref.current.visible = dist < 2200; } catch (e) {}
  });

  return (
    <group ref={ref as any} position={position as any}>
      <Text fontSize={baseSize} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.25} outlineColor="#000">{text}</Text>
    </group>
  );
};

const getPlanetType = (node: Node) => {
  const name = (node.name || '').toLowerCase();
  const val = node.val || 5;
  if (name.includes('main')) return 'sun';
  if (name.endsWith('.h') || name.endsWith('.hpp')) return val > 15 ? 'ringed' : 'rocky';
  if (name.endsWith('.cpp') || name.endsWith('.cc')) return val > 20 ? 'gas-giant' : 'planet';
  if (name.includes('cmake') || name.endsWith('.json')) return 'asteroid';
  return 'planet';
};

const getColorForFile = (name?: string): string => {
  if (!name) return '#888888';
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') return '#32CD32';
  if (ext === 'h' || ext === 'hpp') return '#4169E1';
  if (ext === 'cmake') return '#22c55e';
  if (ext === 'json') return '#eab308';
  return '#888888';
};

const Planet: React.FC<{ node: Node; position: [number, number, number]; selected?: boolean; hovered?: boolean; segments?: number; onClick?: () => void; onHover?: (over: boolean) => void }> = ({ node, position, selected = false, hovered = false, segments = 18, onClick, onHover }) => {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const type = getPlanetType(node);
  const baseSize = Math.max(1.5, (node.val || 3) * 0.5);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += 0.002 + ((node.val || 0) * 0.0001);
    if (type === 'sun') {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      meshRef.current.scale.setScalar(baseSize * (selected ? 1.1 : scale));
    } else {
      const t = selected ? 1.03 : 1;
      meshRef.current.scale.setScalar(baseSize * t);
    }
  });

  const color = node.color || getColorForFile(node.name);
  const materialProps: any = { color, roughness: type === 'rocky' || type === 'asteroid' ? 0.8 : 0.5, metalness: type === 'rocky' ? 0.1 : 0.2 };

  const geometry = (() => {
    switch (type) {
      case 'sun': return <icosahedronGeometry args={[baseSize * 2.6, 2]} />;
      case 'asteroid': return <dodecahedronGeometry args={[baseSize * 0.6, 0]} />;
      default: return <sphereGeometry args={[baseSize, segments, segments]} />;
    }
  })();

  return (
    <group position={position}>
      <mesh ref={meshRef} onClick={onClick} castShadow receiveShadow>
        {geometry}
        {type === 'sun' ? (
          <meshStandardMaterial color="#FFD700" emissive="#FF8C00" emissiveIntensity={selected ? 2.5 : 1.5} toneMapped={false} />
        ) : (
          <meshStandardMaterial {...materialProps} emissive={selected ? new THREE.Color(color) : undefined} emissiveIntensity={selected ? 0.3 : 0} />
        )}
      </mesh>

      {(selected || hovered) && <GlowSprite position={position} size={baseSize * 8} color={color} visible={true} />}

      {/* invisible pointer mesh to capture hover events */}
      <mesh position={position as any} visible={false} onPointerOver={() => onHover && onHover(true)} onPointerOut={() => onHover && onHover(false)} />

      {type === 'ringed' && (
        <mesh rotation={[Math.PI / 2.3, 0, 0]}>
          <torusGeometry args={[baseSize * 1.8, baseSize * 0.2, 2, 64]} />
          <meshStandardMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {type === 'sun' && (
        <>
          <pointLight position={[0, 0, 0]} intensity={selected ? 2.5 : 1.6} distance={300} color="#FFD700" />
          <Sphere args={[baseSize * 3.6, 16, 16]}>
            <meshBasicMaterial color="#FFD700" transparent opacity={selected ? 0.16 : 0.1} toneMapped={false} />
          </Sphere>
        </>
      )}

      {type === 'gas-giant' && (
        <Sphere args={[baseSize * 1.2, 16, 16]}>
          <meshBasicMaterial color={color} transparent opacity={0.14} side={THREE.BackSide} />
        </Sphere>
      )}
    </group>
  );
};

const Nebula: React.FC = () => {
  const particlesCount = 2000;
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const positions = new Float32Array(particlesCount * 3);
    const colors = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount; i++) {
      const radius = Math.random() * 600 + 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
      const color = new THREE.Color();
      color.setHSL(0.6 + Math.random() * 0.2, 0.8, 0.45 + Math.random() * 0.1);
      colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
    }
    return { positions, colors };
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y += 0.0005;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.03) * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particlesCount} array={data.positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={particlesCount} array={data.colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={3} vertexColors transparent opacity={0.6} blending={THREE.AdditiveBlending} />
    </points>
  );
};

const OrbitalLinks: React.FC<{ links: any[]; nodes: Node[] }> = ({ links, nodes }) => {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const lines = useMemo(() => {
    const arr: React.ReactElement[] = [];
    links.forEach((link, idx) => {
      const s = nodeMap.get(link.source);
      const t = nodeMap.get(link.target);
      if (!s || !t) return;
      const positions = new Float32Array([s.x || 0, s.y || 0, s.z || 0, t.x || 0, t.y || 0, t.z || 0]);
      arr.push(
        <line key={`${link.source}-${link.target}-${idx}`}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={2} array={positions} itemSize={3} />
          </bufferGeometry>
          <lineBasicMaterial color="#1a4d7a" opacity={0.18} transparent blending={THREE.AdditiveBlending} />
        </line>
      );
    });
    return arr;
  }, [links, nodeMap]);

  return <>{lines}</>;
};

const PlanetLabels: React.FC<{ nodes: Node[] }> = ({ nodes }) => {
  const important = useMemo(() => nodes.filter(n => ((n.name || '').toLowerCase().includes('main') || (n.val || 0) > 15)).slice(0, 15), [nodes]);
  return (
    <>
      {important.map(node => (
        <Label3D key={node.id} position={[node.x || 0, (node.y || 0) + Math.max(5, (node.val || 3) * 0.5 + 3), node.z || 0]} text={(node.name || node.id).slice(0, 25)} baseSize={3} />
      ))}
    </>
  );
};

const SpaceGraph: React.FC<{ data: { nodes: Node[]; links: any[] }; onNodeClick?: (node: Node) => void }> = ({ data, onNodeClick }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const segments = data.nodes.length > 10000 ? 6 : data.nodes.length > 2000 ? 12 : 18;

  const handleClick = (node: Node) => {
    setSelectedId(node.id);
    onNodeClick && onNodeClick(node);
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 100, 400], fov: 60 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, scene }) => {
          try { (gl as any).toneMapping = (THREE as any).ACESFilmicToneMapping || (THREE as any).ReinhardToneMapping; } catch (e) {}
          try { (gl as any).outputEncoding = (THREE as any).sRGBEncoding; } catch (e) {}
          try { scene.background = new THREE.Color('#000510'); } catch (e) {}
        }}
      >
        <fog attach="fog" args={[new THREE.Color('#000510'), 400, 1200]} />
        <Stars radius={800} depth={100} count={8000} factor={6} fade speed={0.5} />
        <Nebula />
        <ambientLight intensity={0.35} />
        <directionalLight position={[50, 50, 50]} intensity={0.6} />
        <OrbitControls enableDamping dampingFactor={0.05} rotateSpeed={0.3} zoomSpeed={1} minDistance={50} maxDistance={1500} />
        {data.nodes.map((node, index) => {
          const n = data.nodes.length || 1;
          // сферическое распределение (равномерное)
          const phi = Math.acos(-1 + (2 * index) / n);
          const theta = Math.sqrt(n * Math.PI) * phi;

          const radius = 400; // увеличьте при необходимости

          const x = typeof node.x === 'number' ? node.x : radius * Math.cos(theta) * Math.sin(phi);
          const y = typeof node.y === 'number' ? node.y : radius * Math.sin(theta) * Math.sin(phi);
          const z = typeof node.z === 'number' ? node.z : radius * Math.cos(phi);

          return (
            <Planet
              key={node.id}
              node={node}
              position={[x, y, z]}
              selected={selectedId === node.id}
              hovered={hoveredId === node.id}
              segments={segments}
              onClick={() => handleClick(node)}
              onHover={(over) => setHoveredId(over ? node.id : null)}
            />
          );
        })}
        <OrbitalLinks links={data.links} nodes={data.nodes} />
        <PlanetLabels nodes={data.nodes} />
      </Canvas>
    </div>
  );
};

export default SpaceGraph;
