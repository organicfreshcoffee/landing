import * as THREE from 'three';
import { ServerHallway } from '../types/generator';
import { CubeFloorRenderer, CubePosition } from './cubeFloorRenderer';
import { HallwayGenerator, HallwayGenerationOptions } from '../generators/hallwayGenerator';
import { CubeConfig } from '../config/cubeConfig';

export interface HallwayRenderOptions extends HallwayGenerationOptions {
  cubeSize?: number;
  hallwayColor?: number;
  yOffset?: number;
}

/**
 * Renderer for hallway floors using cube system
 */
export class HallwayRenderer {
  private static readonly DEFAULT_OPTIONS: Required<HallwayRenderOptions> = {
    cubeSize: CubeConfig.getCubeSize(),
    hallwayColor: 0xff0000, // Red for hallways
    yOffset: 0,
    width: 2,
    cornerRadius: 1,
    minimizeOverlaps: true
  };

  /**
   * Render a single hallway floor
   */
  static renderHallway(
    scene: THREE.Scene,
    hallway: ServerHallway,
    options: HallwayRenderOptions = {}
  ): CubePosition[] {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    // Generate floor coordinates
    const coordinates = HallwayGenerator.generateHallwayFloor(hallway, {
      width: opts.width,
      cornerRadius: opts.cornerRadius,
      minimizeOverlaps: opts.minimizeOverlaps
    });
    
    if (coordinates.length === 0) {
      console.warn(`No coordinates generated for hallway ${hallway.name}`);
      return [];
    }
    
    // Register with cube renderer
    CubeFloorRenderer.registerCubes(coordinates, opts.hallwayColor, 'hallway');
    
    console.log(`🔴 Rendered hallway ${hallway.name} with ${coordinates.length} cubes`);
    return coordinates;
  }

  /**
   * Render multiple hallways
   */
  static renderMultipleHallways(
    scene: THREE.Scene,
    hallways: ServerHallway[],
    options: HallwayRenderOptions = {}
  ): Map<string, CubePosition[]> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const renderedHallways = new Map<string, CubePosition[]>();
    
    console.log(`🛤️ Rendering ${hallways.length} hallways...`);
    
    hallways.forEach(hallway => {
      const coordinates = this.renderHallway(scene, hallway, opts);
      renderedHallways.set(hallway.name, coordinates);
    });
    
    return renderedHallways;
  }

  /**
   * Render hallway connections and intersections
   */
  static renderHallwayConnections(
    scene: THREE.Scene,
    hallways: ServerHallway[],
    options: HallwayRenderOptions = {}
  ): CubePosition[] {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const connectionCoordinates: CubePosition[] = [];
    
    // Find intersection points where hallways meet
    const intersections = this.findHallwayIntersections(hallways);
    
    intersections.forEach(intersection => {
      const coords = HallwayGenerator.generateIntersectionFloor(
        intersection.position,
        opts.width,
        opts.cornerRadius
      );
      
      connectionCoordinates.push(...coords);
    });
    
    if (connectionCoordinates.length > 0) {
      // Register intersection cubes with slightly different color
      const intersectionColor = this.adjustColor(opts.hallwayColor, 0.8);
      CubeFloorRenderer.registerCubes(connectionCoordinates, intersectionColor, 'hallway');
      
      console.log(`🔗 Rendered ${intersections.length} hallway intersections`);
    }
    
    return connectionCoordinates;
  }

  /**
   * Find intersection points between hallways
   */
  private static findHallwayIntersections(hallways: ServerHallway[]): Array<{
    position: THREE.Vector2;
    hallwayNames: string[];
  }> {
    const intersections: Array<{
      position: THREE.Vector2;
      hallwayNames: string[];
    }> = [];
    
    // Simple intersection detection - can be enhanced for complex cases
    for (let i = 0; i < hallways.length; i++) {
      const hallwayA = hallways[i];
      if (!hallwayA.endPosition) continue;
      
      for (let j = i + 1; j < hallways.length; j++) {
        const hallwayB = hallways[j];
        if (!hallwayB.startPosition) continue;
        
        // Check if end of A meets start of B
        const distance = hallwayA.endPosition.distanceTo(hallwayB.startPosition);
        if (distance < 2) { // Within connection range
          intersections.push({
            position: hallwayA.endPosition.clone(),
            hallwayNames: [hallwayA.name, hallwayB.name]
          });
        }
      }
    }
    
    return intersections;
  }

  /**
   * Adjust color brightness
   */
  private static adjustColor(color: number, factor: number): number {
    const r = Math.floor((color >> 16) * factor);
    const g = Math.floor(((color >> 8) & 0xFF) * factor);
    const b = Math.floor((color & 0xFF) * factor);
    
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Create hallway debug visualization
   */
  static createHallwayDebugVisualization(
    scene: THREE.Scene,
    hallway: ServerHallway,
    options: HallwayRenderOptions = {}
  ): THREE.Group {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const debugGroup = new THREE.Group();
    debugGroup.name = `HallwayDebug_${hallway.name}`;
    
    if (!hallway.startPosition || !hallway.endPosition) {
      console.warn(`Cannot create debug visualization for hallway ${hallway.name} - missing positions`);
      return debugGroup;
    }
    
    // Create line showing hallway path
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(
        hallway.startPosition.x * opts.cubeSize,
        opts.yOffset + 0.5,
        hallway.startPosition.y * opts.cubeSize
      ),
      new THREE.Vector3(
        hallway.endPosition.x * opts.cubeSize,
        opts.yOffset + 0.5,
        hallway.endPosition.y * opts.cubeSize
      )
    ]);
    
    const material = new THREE.LineBasicMaterial({ 
      color: 0xffff00, // Yellow for debug
      linewidth: 3
    });
    
    const line = new THREE.Line(geometry, material);
    line.name = `HallwayPath_${hallway.name}`;
    debugGroup.add(line);
    
    // Add start/end markers
    const markerGeometry = new THREE.SphereGeometry(0.2);
    const startMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green
    const endMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red
    
    const startMarker = new THREE.Mesh(markerGeometry, startMaterial);
    startMarker.position.set(
      hallway.startPosition.x * opts.cubeSize,
      opts.yOffset + 1,
      hallway.startPosition.y * opts.cubeSize
    );
    startMarker.name = `HallwayStart_${hallway.name}`;
    debugGroup.add(startMarker);
    
    const endMarker = new THREE.Mesh(markerGeometry, endMaterial);
    endMarker.position.set(
      hallway.endPosition.x * opts.cubeSize,
      opts.yOffset + 1,
      hallway.endPosition.y * opts.cubeSize
    );
    endMarker.name = `HallwayEnd_${hallway.name}`;
    debugGroup.add(endMarker);
    
    scene.add(debugGroup);
    return debugGroup;
  }

  /**
   * Get hallway statistics for debugging
   */
  static getHallwayStats(hallways: ServerHallway[]): {
    totalHallways: number;
    totalLength: number;
    averageLength: number;
    hallwayNames: string[];
  } {
    const totalLength = hallways.reduce((sum, hallway) => sum + hallway.length, 0);
    
    return {
      totalHallways: hallways.length,
      totalLength,
      averageLength: hallways.length > 0 ? totalLength / hallways.length : 0,
      hallwayNames: hallways.map(h => h.name)
    };
  }
}
