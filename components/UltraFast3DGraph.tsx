import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

interface Node {
  id: string;
  name?: string;
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

const getColorForFile = (name?: string): string => {
  if (!name) return '#888888';
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') return '#32CD32';
  if (ext === 'h' || ext === 'hpp') return '#4169E1';
  if (ext === 'cmake') return '#22c55e';
  if (ext === 'json') return '#eab308';
  return '#888888';
};

// Компонент узлов (InstancedMesh - один draw call)
const Nodes: React.FC<{ nodes: Node[]; onNodeClick?: (node: Node) => void }> = ({ nodes, onNodeClick }) => {
   const meshRef = useRef<THREE.InstancedMesh | null>(null);
   const dummy = useMemo(() => new THREE.Object3D(), []);

   useEffect(() => {
     if (!meshRef.current) return;

     const colorArray = new Float32Array(nodes.length * 3);

     nodes.forEach((node, i) => {
       const x = node.x ?? (Math.random() - 0.5) * 500;
       const y = node.y ?? (Math.random() - 0.5) * 500;
       const z = node.z ?? (Math.random() - 0.5) * 500;
       const size = Math.max(1, (node.val || 3) * 0.4);

       dummy.position.set(x, y, z);
       dummy.scale.setScalar(size);
       dummy.updateMatrix();
       meshRef.current!.setMatrixAt(i, dummy.matrix);

       const color = new THREE.Color(node.color || getColorForFile(node.name));
      colorArray[i * 3] = color.r;
      colorArray[i * 3 + 1] = color.g;
      colorArray[i * 3 + 2] = color.b;
     });

     meshRef.current.instanceMatrix.needsUpdate = true;

     // Add instance color attribute
     try {
      // use instancedMesh.instanceColor which Mesh supports
      (meshRef.current as any).instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
      try { (meshRef.current as any).instanceColor.needsUpdate = true; } catch (err) {}
     } catch (e) {
       // ignore
     }
   }, [nodes, dummy]);

   return (
     <instancedMesh
       ref={meshRef as any}
       args={[undefined, undefined, nodes.length]}
       frustumCulled={false}
       onPointerDown={(e: any) => {
         try {
           const instanceId = typeof e.instanceId === 'number' ? e.instanceId : (e.face && e.face.a !== undefined ? e.face.a : undefined);
           if (typeof instanceId === 'number' && onNodeClick) {
             const node = nodes[instanceId];
             node && onNodeClick(node);
           }
         } catch (err) {}
       }}
     >
       <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial vertexColors={true} toneMapped={false} />
     </instancedMesh>
   );
};

// Компонент линий (LineSegments - один draw call)
const Links: React.FC<{ links: Link[]; nodes: Node[] }> = ({ links, nodes }) => {
  const positions = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const pos: number[] = [];

    links.forEach(link => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) return;

      pos.push(
        source.x ?? 0, source.y ?? 0, source.z ?? 0,
        target.x ?? 0, target.y ?? 0, target.z ?? 0
      );
    });

    return new Float32Array(pos);
  }, [links, nodes]);

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions as any} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#333" opacity={0.3} transparent />
    </lineSegments>
  );
};

// Labels только для main файлов
const Labels: React.FC<{ nodes: Node[] }> = ({ nodes }) => {
  const mainNodes = useMemo(() => nodes.filter(n => {
    const name = (n.name || '').toLowerCase();
    return name.includes('main') || (n.val || 0) > 20;
  }).slice(0, 20), [nodes]);

  return (
    <>
      {mainNodes.map(node => (
        <Text
          key={node.id}
          position={[node.x || 0, node.y || 0, node.z || 0] as any}
          fontSize={4}
          color={node.color || '#fff'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.2}
          outlineColor="#000"
        >
          {(node.name || node.id).slice(0, 30)}
        </Text>
      ))}
    </>
  );
};

const UltraFast3DGraph: React.FC<{
  data: { nodes: Node[]; links: Link[] };
  onNodeClick?: (node: Node) => void;
}> = ({ data, onNodeClick }) => {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 400], fov: 60 }}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
        dpr={1}
      >
        <color attach="background" args={["#000011"]} />

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={1.2}
          minDistance={50}
          maxDistance={2000}
        />

        <Nodes nodes={data.nodes} onNodeClick={onNodeClick} />
        <Links links={data.links} nodes={data.nodes} />
        <Labels nodes={data.nodes} />

        <ambientLight intensity={0.5} />
      </Canvas>
    </div>
  );
};

export default UltraFast3DGraph;
