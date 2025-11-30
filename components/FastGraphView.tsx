import React, { useEffect, useRef } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';

interface Node { id: string; name?: string; val?: number; color?: string; type?: string; x?: number; y?: number }
interface Link { source: string; target: string }

const getColorForFile = (name?: string) => {
  if (!name) return '#888';
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'cpp' || ext === 'cc') return '#32CD32';
  if (ext === 'h' || ext === 'hpp') return '#4169E1';
  if (ext === 'cmake') return '#22c55e';
  return '#888';
};

const FastGraphView: React.FC<{ data: { nodes: Node[]; links: Link[] }; onNodeClick?: (node: any) => void; showClusterLabels?: boolean; }> = ({ data, onNodeClick, showClusterLabels = true }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sigmaRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // create graphology graph
    const graph = new Graph();

    // populate nodes
    (data.nodes || []).forEach(n => {
      const id = n.id.toString();
      graph.addNode(id, {
        label: n.name || id,
        size: Math.max(3, (n.val || 5) * 0.5),
        color: n.color || getColorForFile(n.name),
        x: typeof n.x === 'number' ? n.x : Math.random() * 1000,
        y: typeof n.y === 'number' ? n.y : Math.random() * 1000,
      });
    });

    // populate edges
    (data.links || []).forEach(l => {
      try {
        graph.addEdge(l.source.toString(), l.target.toString());
      } catch (e) {
        // ignore duplicates
      }
    });

    // if positions persisted, restore them
    try {
      const persisted = (window as any).__CPP_RELATIONS_NODE_POSITIONS__;
      if (persisted && typeof persisted === 'object') {
        graph.forEachNode((node: string, attr: any) => {
          const p = persisted[node];
          if (p && typeof p.x === 'number' && typeof p.y === 'number') {
            graph.setNodeAttribute(node, 'x', p.x);
            graph.setNodeAttribute(node, 'y', p.y);
          }
        });
      }
    } catch (e) {}

    // run a short forceAtlas2 for layout if many nodes and no positions
    const needLayout = (data.nodes || []).every(n => typeof n.x !== 'number' || typeof n.y !== 'number');
    if (needLayout) {
      try {
        forceAtlas2.assign(graph, { iterations: 50, settings: { gravity: 1, scalingRatio: 10, slowDown: 1 } });
      } catch (e) {
        console.warn('ForceAtlas2 failed', e);
      }
    }

    // create sigma renderer
    const renderer = new Sigma(graph as any, containerRef.current as HTMLElement, {
      renderEdgeLabels: false,
      enableEdgeEvents: false,
      labelRenderedSizeThreshold: 5,
      labelDensity: 0.07,
      labelGridCellSize: 60,
      minCameraRatio: 0.1,
      maxCameraRatio: 10,
    } as any);

    // wire node click
    try {
      (renderer as any).on && (renderer as any).on('clickNode', ({ node }: any) => {
        if (!onNodeClick) return;
        const attrs = graph.getNodeAttributes(node);
        onNodeClick({ id: node, ...attrs });
      });
    } catch (e) {}

    sigmaRef.current = { renderer, graph };

    return () => {
      try { renderer.kill(); } catch (e) {}
      try { graph.clear(); } catch (e) {}
    };
  }, [data, onNodeClick, showClusterLabels]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#000' }} />;
};

export default FastGraphView;

