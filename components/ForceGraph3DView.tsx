import React, { useRef, useEffect, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';

interface Node {
  id: string;
  name: string;
  val?: number;
  color?: string;
  type?: 'entry' | 'header' | 'source' | 'lib';
}

interface Link {
  source: string;
  target: string;
  value?: number;
}

const createStarfield = (count = 800) => {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];

  for (let i = 0; i < count; i++) {
    vertices.push(
      Math.random() * 3000 - 1500,
      Math.random() * 3000 - 1500,
      Math.random() * 3000 - 1500
    );
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true });
  return new THREE.Points(geometry, material);
};

const ForceGraph3DView: React.FC<{ data: { nodes: Node[]; links: Link[] }; onNodeClick?: (n: any) => void }>
  = ({ data, onNodeClick }) => {
  // используем any реф — обёртка ForceGraph иногда экспонирует scene как функцию
  const fgRef = useRef<any>(null);

  // Клонируем данные, чтобы Three/ForceGraph3D не мутировал исходные объекты (это ломает 2D)
  // глубокий клон (без ссылок на оригинальные объекты) — безопасно для 3D модификаций
  const localGraph = useMemo(() => {
    try {
      // JSON-клон подходит, т.к. у нас простая структура nodes/links
      return JSON.parse(JSON.stringify(data || { nodes: [], links: [] }));
    } catch (e) {
      // fallback: shallow clone
      return {
        nodes: (data.nodes || []).map(n => ({ id: n.id, name: n.name, color: n.color, type: n.type, val: n.val })),
        links: (data.links || []).map(l => ({ source: (l as any).source, target: (l as any).target, value: (l as any).value }))
      };
    }
  }, [data]);

  useEffect(() => {
    if (!fgRef.current) return;

    // безопасно получить сцену: может быть объектом или функцией
    const getScene = () => {
      const cand = fgRef.current.scene;
      if (!cand) return undefined;
      if (typeof cand === 'function') return cand();
      return cand;
    };

    const scene = getScene() as THREE.Scene | undefined;

    // центрируем камеру на входном узле, если есть
    const mainNode = localGraph.nodes.find((n: any) => n.type === 'entry');
    if (mainNode && fgRef.current && typeof fgRef.current.cameraPosition === 'function') {
      try {
        // отложим центрирование на один кадр, чтобы движок инициализировался
        requestAnimationFrame(() => {
          try { fgRef.current.cameraPosition({ x: 0, y: 0, z: 800 }, mainNode, 800); } catch (e) {}
        });
      } catch (e) {
        // ignore
      }
    }

    let stars: THREE.Points | null = null;
    try {
      if (scene && typeof scene.add === 'function') {
        // уменьшено количество звёзд для производительности
        stars = createStarfield(300);
        stars.name = '__starfield__';
        scene.add(stars);
      }
    } catch (e) {
      stars = null;
    }

    return () => {
      try {
        const s = getScene();
        if (s && stars) {
          const old = s.getObjectByName && s.getObjectByName('__starfield__');
          if (old && typeof s.remove === 'function') s.remove(old);
        }
      } catch (e) {
        // ignore cleanup errors
      }
    };
  }, [localGraph]);

  // Визуальная схема: размеры/стили для типов
  const getNodeVisual = (node: any) => {
    const baseColor = node.color || '#888888';
    if (node.type === 'entry') return { size: 12, color: baseColor, emissive: baseColor };
    if (node.type === 'header') return { size: 7, color: baseColor }; // крупная планета
    if (node.type === 'source') return { size: 6, color: baseColor };
    return { size: 5, color: baseColor };
  };

  return (
    <div className="w-full h-full">
      <ForceGraph3D
        ref={fgRef}
        graphData={localGraph as any}
        nodeLabel="name"
        nodeVal={(n: any) => n.val || 1}
        nodeColor={(n: any) => n.color || '#888'}
        linkWidth={(l: any) => Math.max(0.5, (l.value || 1) * 0.6)}
        linkDirectionalParticles={0}
        linkDirectionalParticleSpeed={0.002}
        backgroundColor="#000011"
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        onNodeClick={onNodeClick}
        enableNodeDrag={false}
        cooldownTicks={30}
        rendererConfig={{ antialias: false, powerPreference: 'high-performance' }}
        nodeThreeObject={(node: any) => {
          const vis = getNodeVisual(node);

          // Для точки входа рисуем небольшую эмиссивную сферу + подпись
          if (node.type === 'entry') {
            // меньше сегментов у сферы — быстрее рендер
            const geom = new THREE.SphereGeometry(vis.size, 8, 6);
            const mat = new THREE.MeshStandardMaterial({ color: vis.color, emissive: vis.emissive || vis.color, emissiveIntensity: 0.6 });
            // не записываем в depth buffer, чтобы подписи/линии не пропадали
            mat.depthWrite = false;
            const mesh = new THREE.Mesh(geom, mat);
            mesh.castShadow = false;
            mesh.receiveShadow = false;

            // подпись спрайтом — убедимся, что материал прозрачный и корректно настроен
            const sprite = new SpriteText(node.name);
            sprite.color = '#ffffff';
            sprite.textHeight = Math.max(5, vis.size * 0.6);
            sprite.position.set(0, vis.size + 4, 0);
            try {
              const m = (sprite as any).material;
              if (m) {
                m.transparent = true;
                m.alphaTest = 0.05;
                m.depthWrite = false;
                m.depthTest = true;
                if (m.map) m.map.needsUpdate = true;
              }
              (sprite as any).renderOrder = 999;
            } catch (e) { /* ignore if sprite internals differ */ }

            const group = new THREE.Group();
            group.add(mesh as any);
            group.add(sprite as any);
            return group as any;
          }

          // Для остальных: показываем подпись только для header/entry, остальные — лёгкие сферы
          if (node.type === 'header' || (node.val && node.val > 50)) {
            const sprite = new SpriteText(node.name);
            sprite.color = '#ffffff';
            sprite.textHeight = Math.max(3.5, vis.size * 0.6);
            try {
              const m = (sprite as any).material;
              if (m) {
                m.transparent = true;
                m.alphaTest = 0.05;
                m.depthWrite = false;
                m.depthTest = true;
                if (m.map) m.map.needsUpdate = true;
              }
              (sprite as any).renderOrder = 999;
            } catch (e) {}
            return sprite as any;
          }

          // Для мелких узлов используем простую MeshBasicMaterial без записи в depth
          const geomSmall = new THREE.SphereGeometry(Math.max(0.8, vis.size * 0.45), 6, 4);
          const matSmall = new THREE.MeshBasicMaterial({ color: vis.color });
          matSmall.depthWrite = false;
          const meshSmall = new THREE.Mesh(geomSmall, matSmall);
          meshSmall.castShadow = false;
          meshSmall.receiveShadow = false;
          return meshSmall as any;
        }}
      />
    </div>
  );
};

export default ForceGraph3DView;
