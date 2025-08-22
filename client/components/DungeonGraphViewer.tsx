import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VisitedNode } from '../lib/game/types/api';
import styles from '../styles/DungeonGraphViewer.module.css';

interface NodePosition {
  x: number;
  y: number;
}

interface GraphNode extends VisitedNode {
  position: NodePosition;
  level: number;
}

interface DungeonGraphViewerProps {
  nodes: VisitedNode[];
  isVisible: boolean;
  onClose: () => void;
}

export const DungeonGraphViewer: React.FC<DungeonGraphViewerProps> = ({
  nodes,
  isVisible,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Build the graph layout
  useEffect(() => {
    if (!nodes.length) return;

    // Create a map for quick lookup
    const nodeMap = new Map(nodes.map(node => [node.name, node]));
    
    // Build the graph structure and calculate positions
    const layoutNodes: GraphNode[] = [];
    const positioned = new Set<string>();
    
    // Find root nodes (nodes with no parents)
    const children = new Set(nodes.flatMap(node => node.children));
    const rootNodes = nodes.filter(node => !children.has(node.name));
    
    // Level-based layout
    const levels: string[][] = [];
    const queue: { name: string; level: number }[] = rootNodes.map(node => ({ name: node.name, level: 0 }));
    
    while (queue.length > 0) {
      const { name, level } = queue.shift()!;
      
      if (positioned.has(name)) continue;
      positioned.add(name);
      
      if (!levels[level]) levels[level] = [];
      levels[level].push(name);
      
      const node = nodeMap.get(name);
      if (node) {
        node.children.forEach(childName => {
          if (!positioned.has(childName)) {
            queue.push({ name: childName, level: level + 1 });
          }
        });
      }
    }
    
    // Calculate positions
    const nodeWidth = 120;
    const nodeHeight = 80;
    const levelHeight = 150;
    
    levels.forEach((levelNodes, levelIndex) => {
      const startX = -(levelNodes.length - 1) * nodeWidth / 2;
      
      levelNodes.forEach((nodeName, nodeIndex) => {
        const node = nodeMap.get(nodeName);
        if (node) {
          layoutNodes.push({
            ...node,
            position: {
              x: startX + nodeIndex * nodeWidth,
              y: levelIndex * levelHeight
            },
            level: levelIndex
          });
        }
      });
    });
    
    setGraphNodes(layoutNodes);
  }, [nodes]);

  // Handle canvas drawing
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply transformations
    ctx.save();
    ctx.translate(canvas.width / 2 + offset.x, 50 + offset.y);
    ctx.scale(scale, scale);
    
    // Draw connections first
    graphNodes.forEach(node => {
      node.children.forEach(childName => {
        const childNode = graphNodes.find(n => n.name === childName);
        if (childNode) {
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(node.position.x, node.position.y + 40);
          ctx.lineTo(childNode.position.x, childNode.position.y - 40);
          ctx.stroke();
        }
      });
    });
    
    // Draw nodes
    graphNodes.forEach(node => {
      const { x, y } = node.position;
      
      // Node background
      if (node.visitedBy) {
        ctx.fillStyle = node.isBossLevel ? '#ff6b6b' : '#4ecdc4';
      } else {
        ctx.fillStyle = '#888';
      }
      
      ctx.fillRect(x - 50, y - 30, 100, 60);
      
      // Node border
      ctx.strokeStyle = node.visitedBy ? '#fff' : '#666';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 50, y - 30, 100, 60);
      
      // Node text
      ctx.fillStyle = '#fff';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, x, y - 5);
      
      // Boss indicator
      if (node.isBossLevel) {
        ctx.font = '10px monospace';
        ctx.fillText('BOSS', x, y + 10);
      }
      
      // Visited indicator
      if (!node.visitedBy) {
        ctx.font = '10px monospace';
        ctx.fillStyle = '#ccc';
        ctx.fillText('UNVISITED', x, y + 15);
      }
    });
    
    ctx.restore();
  }, [graphNodes, scale, offset]);

  // Update canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const updateSize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      drawGraph();
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [drawGraph]);

  // Redraw when dependencies change
  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newScale = Math.max(0.5, Math.min(3, scale + (e.deltaY > 0 ? -0.1 : 0.1)));
    setScale(newScale);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'p') {
      onClose();
    }
  };

  useEffect(() => {
    if (isVisible) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.container} ref={containerRef}>
        <div className={styles.header}>
          <h2>Dungeon Graph</h2>
          <div className={styles.controls}>
            <span>Drag to pan • Scroll to zoom • ESC or P to close</span>
            <button onClick={onClose} className={styles.closeButton}>×</button>
          </div>
        </div>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.visited}`}></div>
            <span>Visited</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.boss}`}></div>
            <span>Boss Level</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.unvisited}`}></div>
            <span>Unvisited</span>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />
      </div>
    </div>
  );
};
