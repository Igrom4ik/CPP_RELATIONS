
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { GraphData, FileNode, SymbolDefinition } from '../types';

interface Props {
  data: GraphData;
  onNodeClick: (node: FileNode) => void;
  onLinkClick: (source: FileNode, target: FileNode) => void;
  onSymbolClick: (node: FileNode, symbol: SymbolDefinition) => void;
  searchTerm: string;
  linkStyle: 'bezier' | 'orthogonal';
  animateLinks: boolean;
}

const CARD_WIDTH = 240;
const CARD_HEADER_HEIGHT = 28;
const ROW_HEIGHT = 20;
const CARD_PADDING = 10;
const LAYER_GAP = 350;
const NODE_GAP = 40;

// Helper to create valid SVG IDs from file paths
const getSafeId = (id: string) => "link-" + id.replace(/[^a-zA-Z0-9-_]/g, '_');

const GraphVisualization: React.FC<Props> = ({ 
  data, 
  onNodeClick, 
  onLinkClick, 
  onSymbolClick, 
  searchTerm,
  linkStyle,
  animateLinks
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Handle Resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // --- LAYOUT ALGORITHM ---
  const layoutNodes = useMemo(() => {
    if (data.nodes.length === 0) return [];
    
    const nodeMap = new Map<string, any>();
    // Clone nodes to avoid mutating props directly, preserve x/y if existing
    data.nodes.forEach(n => nodeMap.set(n.id, { ...n, level: 0, height: 0, x: n.x || 0, y: n.y || 0 }));

    // Check if we need to run auto-layout (if positions are missing or all 0)
    const needsLayout = data.nodes.some(n => n.x === undefined || (n.x === 0 && n.y === 0));

    if (needsLayout) {
        let changed = true;
        let iterations = 0;
        // Simple topological level calculation
        while(changed && iterations < data.nodes.length) { 
            changed = false;
            data.links.forEach(l => {
                const src = nodeMap.get(l.source);
                const tgt = nodeMap.get(l.target);
                if (src && tgt && tgt.level < src.level + 1) {
                    tgt.level = src.level + 1;
                    changed = true;
                }
            });
            iterations++;
        }

        const levels: {[key: number]: any[]} = {};
        Array.from(nodeMap.values()).forEach(n => {
            if (!levels[n.level]) levels[n.level] = [];
            levels[n.level].push(n);
        });

        Object.keys(levels).forEach(lvlStr => {
            const lvl = parseInt(lvlStr);
            const nodesInLevel = levels[lvl];
            nodesInLevel.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));

            let currentY = 50;
            nodesInLevel.forEach(n => {
                const symbolCount = n.exportedSymbols ? n.exportedSymbols.length : 0;
                const contentHeight = Math.max(40, symbolCount * ROW_HEIGHT + CARD_PADDING * 2);
                n.height = CARD_HEADER_HEIGHT + contentHeight;
                
                // Assign positions
                if (n.x === 0) n.x = lvl * LAYER_GAP + 50;
                if (n.y === 0) n.y = currentY;
                
                currentY += n.height + NODE_GAP;
            });
        });
    } else {
        // Just verify heights
         Array.from(nodeMap.values()).forEach(n => {
            const symbolCount = n.exportedSymbols ? n.exportedSymbols.length : 0;
            const contentHeight = Math.max(40, symbolCount * ROW_HEIGHT + CARD_PADDING * 2);
            n.height = CARD_HEADER_HEIGHT + contentHeight;
         });
    }

    return Array.from(nodeMap.values());
  }, [data]);

  // Render D3
  useEffect(() => {
    // Prevent running D3 on invalid dimensions or empty data
    if (!layoutNodes.length || !svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // --- DEFS (Gradients & Markers) ---
    const defs = svg.append("defs");
    
    // Arrowheads
    const createArrow = (id: string, color: string) => {
        defs.append("marker")
            .attr("id", id)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 8).attr("refY", 0)
            .attr("markerWidth", 6).attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", color);
    };
    createArrow("arrow-gray", "#71717a"); // zinc-500
    createArrow("arrow-blue", "#3b82f6");
    createArrow("arrow-orange", "#f97316");
    createArrow("arrow-green", "#22c55e");
    createArrow("arrow-yellow", "#eab308");

    // Gradients for Electric Flow
    const createGradient = (id: string, color: string) => {
        const grad = defs.append("linearGradient")
            .attr("id", id)
            .attr("gradientUnits", "userSpaceOnUse");
        grad.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.3);
        grad.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 1);
    };
    createGradient("grad-source", "#3b82f6"); // Blue
    createGradient("grad-header", "#f97316"); // Orange
    createGradient("grad-cmake", "#22c55e");  // Green
    createGradient("grad-json", "#eab308");   // Yellow

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 2])
      .on("zoom", (event) => g.attr("transform", event.transform));
    
    svg.call(zoom);

    // --- LINKS ---
    // Prepare link data mapping
    const linksData = data.links.map(l => {
        const src = layoutNodes.find(n => n.id === l.source);
        const tgt = layoutNodes.find(n => n.id === l.target);
        if (!src || !tgt) return null;
        // Use getSafeId to ensure valid selectors
        // Add linkStyle to ID to force complete re-render of path and animation when style changes
        const safeBaseId = getSafeId(`${src.id}-${tgt.id}`);
        const uniqueId = `${safeBaseId}-${linkStyle}`;
        return { source: src, target: tgt, id: uniqueId, rawId: `${src.id}-${tgt.id}` };
    }).filter(Boolean) as {source: any, target: any, id: string, rawId: string}[];

    const linkPath = (d: any) => {
          const sx = d.source.x + CARD_WIDTH; 
          const sy = d.source.y + CARD_HEADER_HEIGHT / 2; 
          const tx = d.target.x; 
          const ty = d.target.y + CARD_HEADER_HEIGHT / 2;
          
          if (linkStyle === 'orthogonal') {
              const dx = tx - sx;
              const dy = ty - sy;
              const absY = Math.abs(dy);
              const signY = dy > 0 ? 1 : -1;
              const chamfer = 16; // 45-degree corner size
              
              // 1. If target is to the left (backward link) or very close horizontally
              // Fallback to simple curve to prevent complex overlap
              if (dx < 30) {
                   return `M ${sx} ${sy} C ${sx + 50} ${sy}, ${tx - 50} ${ty}, ${tx} ${ty}`;
              }

              // 2. Almost straight line (180 degrees)
              if (absY < 5) {
                   return `M ${sx} ${sy} L ${tx} ${ty}`;
              }

              const midX = sx + dx / 2;

              // 3. Small vertical difference: Use simple 90 degree step (Manhattan)
              // We need at least 2*chamfer height to make two nice 45deg turns
              if (absY < chamfer * 2) {
                   return `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ty} L ${tx} ${ty}`;
              }

              // 4. Electric Style (45 degrees)
              // Path: Start -> Horizontal to Break -> Diagonal -> Vertical -> Diagonal -> Horizontal to End
              return `
                M ${sx} ${sy} 
                L ${midX - chamfer} ${sy} 
                L ${midX} ${sy + chamfer * signY} 
                L ${midX} ${ty - chamfer * signY} 
                L ${midX + chamfer} ${ty} 
                L ${tx} ${ty}
              `.replace(/\s+/g, ' ');
          } else {
              // Bezier style
              const dx = tx - sx;
              const controlStrength = Math.max(Math.abs(dx) * 0.5, 80);
              return `M ${sx} ${sy} C ${sx + controlStrength} ${sy}, ${tx - controlStrength} ${ty}, ${tx} ${ty}`;
          }
    };

    const getLinkColor = (d: any) => {
        if (d.source.type === 'header') return "#f97316";
        if (d.source.type === 'cmake') return "#22c55e";
        if (d.source.type === 'json') return "#eab308";
        return "#3b82f6";
    };

    const getArrowId = (d: any) => {
        if (d.source.type === 'header') return "url(#arrow-orange)";
        if (d.source.type === 'cmake') return "url(#arrow-green)";
        if (d.source.type === 'json') return "url(#arrow-yellow)";
        return "url(#arrow-blue)";
    };

    // 1. Render Static Links (The Rails)
    const linkSelection = g.append("g").attr("class", "links")
        .selectAll("path")
        .data(linksData)
        .join("path")
        .attr("id", d => d.id) // Essential for mpath
        .attr("d", linkPath)
        .attr("stroke", getLinkColor)
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.3) // Dim rail
        .attr("fill", "none")
        .attr("marker-end", getArrowId)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            event.stopPropagation();
            onLinkClick(d.source, d.target);
        });

    // 2. Render Particles (The Electric Flow)
    if (animateLinks) {
        const particleGroup = g.append("g").attr("class", "particles");
        
        // Create 2 particles per link for continuous flow
        [0, 0.75].forEach(delay => {
             // Sanitize class name for selector (replace . with -)
             const safeDelayClass = `p-${String(delay).replace('.', '-')}`;
             
             particleGroup.selectAll(`.${safeDelayClass}`) 
            .data(linksData)
            .join("circle")
            .attr("class", safeDelayClass)
            .attr("r", 3)
            .attr("fill", getLinkColor)
            .style("filter", "drop-shadow(0 0 4px currentColor)")
            .append("animateMotion")
            .attr("dur", "1.5s")
            .attr("begin", `${delay}s`)
            .attr("repeatCount", "indefinite")
            .attr("rotate", "auto")
            .append("mpath")
            .attr("href", d => `#${d.id}`); // Link to the path ID
        });
    }

    // --- NODES ---
    const drag = d3.drag<SVGGElement, any>()
        // Filter out drag events from symbol buttons to allow clicking
        .filter(event => !event.target.closest('.no-drag'))
        .on("start", function(event, d) {
            d3.select(this).raise().attr("filter", "drop-shadow(0 0 8px rgba(255,255,255,0.5))");
        })
        .on("drag", function(event, d) {
            d.x += event.dx;
            d.y += event.dy;
            d3.select(this).attr("transform", `translate(${d.x}, ${d.y})`);
            // Update links (and thus particles follow)
            linkSelection.attr("d", linkPath);
        })
        .on("end", function(event, d) {
            d3.select(this).attr("filter", null);
        });

    const nodes = g.append("g").attr("class", "nodes")
      .selectAll("g")
      .data(layoutNodes)
      .join("g")
      .attr("transform", d => `translate(${d.x}, ${d.y})`)
      .call(drag as any)
      .on("click", (event, d) => {
          if (event.defaultPrevented) return; // Dragged
          event.stopPropagation();
          onNodeClick(d);
      })
      .style("cursor", "grab");

    // Node Body
    nodes.append("rect")
      .attr("width", CARD_WIDTH).attr("height", d => d.height)
      .attr("rx", 6).attr("fill", "#000").attr("fill-opacity", 0.5).attr("transform", "translate(4, 4)"); // Shadow

    nodes.append("rect")
      .attr("width", CARD_WIDTH).attr("height", d => d.height)
      .attr("rx", 6)
      .attr("fill", "#27272a") // zinc-800
      .attr("stroke", d => {
          if (searchTerm && d.name.toLowerCase().includes(searchTerm.toLowerCase())) return "#ef4444";
          if (d.type === 'header') return "#f97316";
          if (d.type === 'cmake') return "#22c55e";
          if (d.type === 'json') return "#eab308";
          return "#3b82f6";
      })
      .attr("stroke-width", d => (searchTerm && d.name.toLowerCase().includes(searchTerm.toLowerCase())) ? 3 : 1);

    // Node Header
    nodes.append("path")
      .attr("d", `M 0 6 A 6 6 0 0 1 6 0 L ${CARD_WIDTH - 6} 0 A 6 6 0 0 1 ${CARD_WIDTH} 6 L ${CARD_WIDTH} ${CARD_HEADER_HEIGHT} L 0 ${CARD_HEADER_HEIGHT} Z`)
      .attr("fill", d => {
          if (d.type === 'header') return "#f97316";
          if (d.type === 'cmake') return "#22c55e";
          if (d.type === 'json') return "#eab308";
          return "#3b82f6";
      })
      .attr("fill-opacity", 0.2);

    nodes.append("text")
      .text(d => d.name)
      .attr("x", 10).attr("y", 19)
      .attr("fill", "#fff")
      .style("font-family", "JetBrains Mono, monospace").style("font-weight", "600").style("font-size", "12px");
    
    // Symbols List
    nodes.each(function(d) {
        const el = d3.select(this);
        const symbols: SymbolDefinition[] = d.exportedSymbols || [];
        
        if (symbols.length > 0) {
            const symGroup = el.append("g").attr("class", "symbols");
            symbols.forEach((sym, i) => {
                const yPos = CARD_HEADER_HEIGHT + 16 + (i * ROW_HEIGHT);
                const item = symGroup.append("g")
                    .attr("class", "no-drag") // MARKER for drag filter
                    .style("cursor", "pointer")
                    .style("pointer-events", "all") // Ensure clicks register
                    .on("click", (e) => { 
                        e.stopPropagation(); 
                        onSymbolClick(d, sym); 
                    });
                
                // Invisible Hitbox for easier clicking
                item.append("rect")
                    .attr("x", 0)
                    .attr("y", yPos - 12)
                    .attr("width", CARD_WIDTH)
                    .attr("height", ROW_HEIGHT)
                    .attr("fill", "transparent");

                // Hover Highlight
                item.append("rect").attr("x", 4).attr("y", yPos - 10).attr("width", CARD_WIDTH - 8).attr("height", ROW_HEIGHT).attr("rx", 4).attr("fill", "#fff").attr("opacity", 0)
                   .on("mouseenter", function() { d3.select(this).attr("opacity", 0.1); })
                   .on("mouseleave", function() { d3.select(this).attr("opacity", 0); });

                item.append("circle").attr("cx", 14).attr("cy", yPos).attr("r", 2.5).attr("fill", sym.type !== 'function' ? "#f97316" : "#3b82f6");
                item.append("text").text(sym.name).attr("x", 24).attr("y", yPos + 4).attr("fill", "#d4d4d8").style("font-family", "JetBrains Mono, monospace").style("font-size", "10px");
            });
        }
    });

  }, [layoutNodes, dimensions, searchTerm, linkStyle, animateLinks]);

  // If dimensions are 0, return placeholder to avoid SVG errors
  if (dimensions.width === 0) {
      return <div ref={containerRef} className="w-full h-full bg-zinc-950" />;
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-zinc-950 overflow-hidden relative">
      <div className="absolute inset-0 opacity-5 pointer-events-none" 
        style={{ backgroundImage: 'linear-gradient(#52525b 1px, transparent 1px), linear-gradient(90deg, #52525b 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
      />
      {/* Use explicit pixels to prevent NotSupportedError on relative lengths */}
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="cursor-grab active:cursor-grabbing" />
    </div>
  );
};

export default GraphVisualization;