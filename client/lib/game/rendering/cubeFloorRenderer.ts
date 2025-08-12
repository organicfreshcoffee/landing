import * as THREE from 'three';
import { CubeConfig } from '../config/cubeConfig';

export interface CubeFloorOptions {
  cubeSize?: number;
  floorColor?: number;
  yOffset?: number;
}

export interface CubePosition {
  x: number;
  y: number;
}

export interface CubeInfo {
  position: CubePosition;
  color: number;
  type: 'room' | 'hallway' | 'overlap';
}

/**
 * Cube floor renderer with overlap detection and color coding
 */
export class CubeFloorRenderer {
  private static cubeRegistry = new Map<string, CubeInfo>();
  private static sceneGroups = new Map<THREE.Scene, THREE.Group>();

  private static getCubeKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  /**
   * Clear all registered cubes for a fresh start
   */
  static clearRegistry(): void {
    this.cubeRegistry.clear();
  }

  /**
   * Get all registered cube coordinates
   */
  static getAllCoordinates(): CubePosition[] {
    const coordinates: CubePosition[] = [];
    this.cubeRegistry.forEach((cubeInfo) => {
      coordinates.push(cubeInfo.position);
    });
    return coordinates;
  }

  /**
   * Register cubes for a specific type and color
   */
  static registerCubes(
    coordinates: CubePosition[],
    color: number,
    type: 'room' | 'hallway'
  ): void {
    coordinates.forEach(coord => {
      const key = this.getCubeKey(coord.x, coord.y);
      const existing = this.cubeRegistry.get(key);
      
      if (existing) {
        // Mark as overlap and set purple color
        this.cubeRegistry.set(key, {
          position: coord,
          color: 0x800080, // Purple for overlaps
          type: 'overlap'
        });
        console.log(`🟣 Overlap detected at (${coord.x}, ${coord.y})`);
      } else {
        // First time registration
        this.cubeRegistry.set(key, {
          position: coord,
          color,
          type
        });
      }
    });
  }

  /**
   * Render all registered cubes with proper colors
   */
  static renderAllCubes(
    scene: THREE.Scene,
    options: CubeFloorOptions = {}
  ): THREE.Group {
    const {
      cubeSize = CubeConfig.getCubeSize(),
      yOffset = 0
    } = options;

    // Create or get existing group for this scene
    let sceneGroup = this.sceneGroups.get(scene);
    if (!sceneGroup) {
      sceneGroup = new THREE.Group();
      sceneGroup.name = 'AllFloorCubes';
      this.sceneGroups.set(scene, sceneGroup);
      scene.add(sceneGroup);
    }

    // Clear existing cubes
    sceneGroup.clear();

    // Create materials for each color
    const materials = new Map<number, THREE.MeshLambertMaterial>();
    const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);

    // Count types for reporting
    let roomCount = 0;
    let hallwayCount = 0;
    let overlapCount = 0;

    // Render all registered cubes
    this.cubeRegistry.forEach((cubeInfo, key) => {
      // Get or create material for this color
      let material = materials.get(cubeInfo.color);
      if (!material) {
        material = new THREE.MeshLambertMaterial({ color: cubeInfo.color });
        materials.set(cubeInfo.color, material);
      }

      // Create cube mesh
      const cube = new THREE.Mesh(geometry, material);
      cube.position.set(
        cubeInfo.position.x * cubeSize,
        yOffset + cubeSize / 2,
        cubeInfo.position.y * cubeSize
      );
      cube.name = `FloorCube_${cubeInfo.type}_${cubeInfo.position.x}_${cubeInfo.position.y}`;
      cube.castShadow = true;
      cube.receiveShadow = true;

      sceneGroup.add(cube);

      // Count types
      switch (cubeInfo.type) {
        case 'room': roomCount++; break;
        case 'hallway': hallwayCount++; break;
        case 'overlap': overlapCount++; break;
      }
    });

    console.log(`🎨 Rendered floor cubes: ${roomCount} rooms (blue), ${hallwayCount} hallways (red), ${overlapCount} overlaps (purple)`);
    
    return sceneGroup;
  }

  /**
   * Get coordinates for a rectangular area
   */
  static getAreaCoordinates(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): CubePosition[] {
    const coordinates: CubePosition[] = [];
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        coordinates.push({ x, y });
      }
    }
    return coordinates;
  }

  /**
   * Generate coordinates along a path between two points
   */
  static getPathCoordinates(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number = 1
  ): CubePosition[] {
    const coordinates: CubePosition[] = [];
    
    // Calculate direction and length
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {
      // Single point
      coordinates.push({ x: Math.round(startX), y: Math.round(startY) });
      return coordinates;
    }
    
    // Normalize direction
    const dirX = dx / length;
    const dirY = dy / length;
    
    // Calculate perpendicular for width
    const perpX = -dirY;
    const perpY = dirX;
    
    // Number of steps along the path
    const steps = Math.ceil(length) + 1;
    
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const centerX = startX + dirX * length * t;
      const centerY = startY + dirY * length * t;
      
      // Add cubes for width
      for (let w = 0; w < width; w++) {
        const widthOffset = w - Math.floor(width / 2);
        const finalX = Math.round(centerX + perpX * widthOffset);
        const finalY = Math.round(centerY + perpY * widthOffset);
        
        coordinates.push({ x: finalX, y: finalY });
      }
    }
    
    // Remove duplicates
    const uniqueCoords = coordinates.filter((coord, index, arr) => 
      arr.findIndex(c => c.x === coord.x && c.y === coord.y) === index
    );
    
    return uniqueCoords;
  }

  /**
   * Clean up resources
   */
  static dispose(): void {
    this.cubeRegistry.clear();
    this.sceneGroups.forEach((group, scene) => {
      scene.remove(group);
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    });
    this.sceneGroups.clear();
  }
}
