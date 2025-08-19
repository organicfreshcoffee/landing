import * as THREE from 'three';
import { ServerHallway } from '../types/generator';
import { CubeFloorRenderer, CubePosition } from './cubeFloorRenderer';
import { CubeConfig } from '../config/cubeConfig';

export interface HallwayRenderOptions {
  cubeSize?: number;
  hallwayColor?: number;
  yOffset?: number;
  width?: number;
}

/**
 * Renderer for hallway floors using cube system
 * 
 * NOTE: This renderer is largely deprecated since server now provides 
 * pre-calculated tiles. Use DungeonFloorRenderer.renderFromServerTiles instead.
 */
export class HallwayRenderer {
  private static readonly DEFAULT_OPTIONS: Required<HallwayRenderOptions> = {
    cubeSize: CubeConfig.getCubeSize(),
    hallwayColor: 0xff0000, // Red for hallways
    yOffset: 0,
    width: 2
  };

  /**
   * Render a single hallway floor (LEGACY - for fallback only)
   * @deprecated Use server-provided tiles instead
   */
  static renderHallway(
    scene: THREE.Scene,
    hallway: ServerHallway,
    options: HallwayRenderOptions = {}
  ): CubePosition[] {
    console.warn('⚠️ HallwayRenderer.renderHallway is deprecated. Use server-provided tiles instead.');
    
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    // Simple coordinate generation from hallway segments
    const coordinates: CubePosition[] = [];
    
    if (hallway.segments && hallway.segments.length > 0) {
      hallway.segments.forEach(segment => {
        const dx = segment.end.x - segment.start.x;
        const dy = segment.end.y - segment.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.ceil(length));
        
        for (let i = 0; i <= steps; i++) {
          const t = steps > 0 ? i / steps : 0;
          const x = Math.round(segment.start.x + (dx * t));
          const y = Math.round(segment.start.y + (dy * t));
          
          coordinates.push({ x, y });
        }
      });
    }
    
    if (coordinates.length === 0) {
      console.warn(`No coordinates generated for hallway ${hallway.name}`);
      return [];
    }

    // Remove duplicates
    const uniqueCoords = new Map<string, CubePosition>();
    coordinates.forEach(coord => {
      const key = `${coord.x},${coord.y}`;
      uniqueCoords.set(key, coord);
    });

    const finalCoords = Array.from(uniqueCoords.values());
    
    // Register cubes for rendering
    CubeFloorRenderer.registerCubes(finalCoords, opts.hallwayColor, 'hallway');
    
    return finalCoords;
  }

  /**
   * Render multiple hallways (LEGACY - for fallback only)
   * @deprecated Use server-provided tiles instead
   */
  static renderMultipleHallways(
    scene: THREE.Scene,
    hallways: ServerHallway[],
    options: HallwayRenderOptions = {}
  ): CubePosition[] {
    console.warn('⚠️ HallwayRenderer.renderMultipleHallways is deprecated. Use server-provided tiles instead.');
    
    const allCoordinates: CubePosition[] = [];
    
    hallways.forEach(hallway => {
      const coords = this.renderHallway(scene, hallway, options);
      allCoordinates.push(...coords);
    });
    
    return allCoordinates;
  }

  /**
   * Clear all hallway cubes from the scene
   */
  static clearHallways(scene: THREE.Scene): void {
    // Note: CubeFloorRenderer doesn't have type-specific clearing
    // This would need to be implemented if needed
    console.warn('HallwayRenderer.clearHallways not fully implemented - use CubeFloorRenderer.clearRegistry()');
  }

  /**
   * Get simple coordinates for a hallway without rendering
   */
  static getHallwayCoordinates(hallway: ServerHallway): CubePosition[] {
    const coordinates: CubePosition[] = [];
    
    if (hallway.segments && hallway.segments.length > 0) {
      hallway.segments.forEach(segment => {
        const dx = segment.end.x - segment.start.x;
        const dy = segment.end.y - segment.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.ceil(length));
        
        for (let i = 0; i <= steps; i++) {
          const t = steps > 0 ? i / steps : 0;
          const x = Math.round(segment.start.x + (dx * t));
          const y = Math.round(segment.start.y + (dy * t));
          
          coordinates.push({ x, y });
        }
      });
    }

    // Remove duplicates
    const uniqueCoords = new Map<string, CubePosition>();
    coordinates.forEach(coord => {
      const key = `${coord.x},${coord.y}`;
      uniqueCoords.set(key, coord);
    });

    return Array.from(uniqueCoords.values());
  }
}
