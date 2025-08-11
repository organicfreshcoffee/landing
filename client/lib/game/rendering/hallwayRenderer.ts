import * as THREE from 'three';
import { HallwayNetwork, HallwaySegment, HallwayIntersection, ServerHallway, FloorHallwaySegment } from '../types/generator';
import { CubeFloorRenderer } from './cubeFloorRenderer';

/**
 * Hallway Renderer - renders hallway paths using cube-based tiles with overlap detection
 */
export class HallwayRenderer {
  private scene: THREE.Scene;
  private hallwayGroups: Map<string, THREE.Group> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Register all hallway cubes for rendering (doesn't immediately render)
   */
  public registerHallwayNetwork(network: HallwayNetwork): void {
    let totalCubes = 0;

    // Register all segments
    network.segments.forEach(segment => {
      const coordinates = CubeFloorRenderer.getPathCoordinates(
        Math.round(segment.start.x),
        Math.round(segment.start.y),
        Math.round(segment.end.x),
        Math.round(segment.end.y),
        Math.max(1, Math.round(segment.width))
      );
      
      CubeFloorRenderer.registerCubes(coordinates, 0xff0000, 'hallway');
      totalCubes += coordinates.length;
    });

    // Register all intersections
    network.intersections.forEach(intersection => {
      const coordinates = this.getCircularCoordinates(
        Math.round(intersection.position.x),
        Math.round(intersection.position.y),
        Math.max(1, Math.round(intersection.radius))
      );
      
      CubeFloorRenderer.registerCubes(coordinates, 0xff0000, 'hallway');
      totalCubes += coordinates.length;
    });

    console.log(`🟥 Registered hallway network with ${totalCubes} cubes`);
  }

  /**
   * Register a single server hallway for rendering
   */
  public registerServerHallway(hallway: ServerHallway): void {
    if (!hallway.segments) {
      console.warn(`⚠️ Hallway ${hallway.id} has no segments to render`);
      return;
    }

    let totalCubes = 0;
    hallway.segments.forEach(segment => {
      const coordinates = CubeFloorRenderer.getPathCoordinates(
        Math.round(segment.start.x),
        Math.round(segment.start.y),
        Math.round(segment.end.x),
        Math.round(segment.end.y),
        1 // Default width of 1 for server hallways
      );
      
      CubeFloorRenderer.registerCubes(coordinates, 0xff0000, 'hallway');
      totalCubes += coordinates.length;
    });

    console.log(`🟥 Registered server hallway ${hallway.id} with ${totalCubes} cubes`);
  }

  /**
   * Render a complete hallway network (legacy method)
   */
  public renderHallwayNetwork(network: HallwayNetwork, color: number = 0xff0000): THREE.Group {
    const group = new THREE.Group();
    group.name = 'HallwayNetwork';

    // Register all segments and intersections
    this.registerHallwayNetwork(network);
    
    // Render all registered cubes
    const floorGroup = CubeFloorRenderer.renderAllCubes(this.scene);
    group.add(floorGroup);

    this.scene.add(group);
    return group;
  }

  /**
   * Render a single hallway segment (legacy method)
   */
  public renderHallwaySegment(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number = 1,
    color: number = 0xff0000
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `HallwaySegment_${startX}_${startY}_to_${endX}_${endY}`;

    const coordinates = CubeFloorRenderer.getPathCoordinates(
      startX, startY, endX, endY, width
    );
    
    CubeFloorRenderer.registerCubes(coordinates, color, 'hallway');
    const floorGroup = CubeFloorRenderer.renderAllCubes(this.scene);
    
    group.add(floorGroup);
    this.scene.add(group);
    
    return group;
  }

  /**
   * Get coordinates for a circular pattern (for intersections)
   */
  private getCircularCoordinates(centerX: number, centerY: number, radius: number) {
    const coordinates: { x: number; y: number }[] = [];
    
    // Generate a filled circle of coordinates
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      for (let y = centerY - radius; y <= centerY + radius; y++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (distance <= radius) {
          coordinates.push({ x, y });
        }
      }
    }
    
    return coordinates;
  }

  /**
   * Remove a specific hallway
   */
  public removeHallway(hallwayId: string): void {
    const group = this.hallwayGroups.get(hallwayId);
    if (group) {
      this.scene.remove(group);
      this.hallwayGroups.delete(hallwayId);
    }
  }

  /**
   * Clear all rendered hallways
   */
  public clearAllHallways(): void {
    this.hallwayGroups.forEach(group => this.scene.remove(group));
    this.hallwayGroups.clear();
    CubeFloorRenderer.clearRegistry();
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.clearAllHallways();
    CubeFloorRenderer.dispose();
  }
}
