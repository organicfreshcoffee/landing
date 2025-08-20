import * as THREE from 'three';
import { CubeConfig } from '../config/cubeConfig';
import { TextureManager, CubeType } from '../utils/textureManager';

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
  private static excludedCoordinates = new Set<string>();

  private static getCubeKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  /**
   * Clear all registered cubes for a fresh start
   */
  static clearRegistry(): void {
    this.cubeRegistry.clear();
    this.excludedCoordinates.clear();
  }

  /**
   * Set coordinates to exclude from rendering (e.g., for downward stairs)
   */
  static setExcludedCoordinates(coordinates: CubePosition[]): void {
    this.excludedCoordinates.clear();
    coordinates.forEach(coord => {
      const key = this.getCubeKey(coord.x, coord.y);
      this.excludedCoordinates.add(key);
    });
  }

  /**
   * Unregister specific coordinates from the cube registry
   */
  static unregisterCoordinates(coordinates: CubePosition[]): void {
    coordinates.forEach(coord => {
      const key = this.getCubeKey(coord.x, coord.y);
      this.cubeRegistry.delete(key);
    });
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
        
    let registeredCount = 0;
    let excludedCount = 0;
    
    coordinates.forEach(coord => {
      const key = this.getCubeKey(coord.x, coord.y);
      
      // Check if this coordinate is excluded (e.g., for downward stairs)
      if (this.excludedCoordinates.has(key)) {
        excludedCount++;
        return;
      }
      
      const existing = this.cubeRegistry.get(key);
      
      if (existing) {
        // Mark as overlap and set purple color
        this.cubeRegistry.set(key, {
          position: coord,
          color: 0x800080, // Purple for overlaps
          type: 'overlap'
        });
        registeredCount++;
      } else {
        // Register new cube
        this.cubeRegistry.set(key, {
          position: coord,
          color,
          type
        });
        registeredCount++;
      }
    });
    
      }

  /**
   * Render all registered cubes with proper textures
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
    if (!sceneGroup || !scene.children.includes(sceneGroup)) {
      // Group doesn't exist or was removed from scene during clearing
      sceneGroup = new THREE.Group();
      sceneGroup.name = 'AllFloorCubes';
      this.sceneGroups.set(scene, sceneGroup);
      scene.add(sceneGroup);
    }

    // Clear existing cubes
    sceneGroup.clear();
        
    // Verify the group is still in the scene
    const isInScene = scene.children.includes(sceneGroup);
    
    // Create geometry once for all cubes
    const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);

    // Count types for reporting
    let roomCount = 0;
    let hallwayCount = 0;
    let overlapCount = 0;

    // Render all registered cubes
    this.cubeRegistry.forEach((cubeInfo, key) => {
      // Skip excluded coordinates
      if (this.excludedCoordinates.has(key)) {
          return;
      }

      // Determine the cube type for texturing
      let cubeType: CubeType;
      let material: THREE.MeshLambertMaterial;

      if (cubeInfo.type === 'overlap') {
        // Use hallway floor texture for overlaps
        cubeType = 'hallway-floor';
        material = TextureManager.createMaterialWithTexture(cubeType);
        overlapCount++;
      } else if (cubeInfo.type === 'hallway') {
        cubeType = 'hallway-floor';
        material = TextureManager.createMaterialWithTexture(cubeType);
        hallwayCount++;
      } else { // room
        cubeType = 'room-floor';
        material = TextureManager.createMaterialWithTexture(cubeType);
        roomCount++;
      }

      // Create cube mesh
      const cube = new THREE.Mesh(geometry, material);
      const cubeWorldX = cubeInfo.position.x * cubeSize;
      const cubeWorldZ = cubeInfo.position.y * cubeSize;
      cube.position.set(
        cubeWorldX,
        yOffset + cubeSize / 2,
        cubeWorldZ
      );
      
      cube.name = `FloorCube_${cubeInfo.type}_${cubeInfo.position.x}_${cubeInfo.position.y}`;
      cube.castShadow = true;
      cube.receiveShadow = true;

      sceneGroup.add(cube);
    });
      console.log(`🔥 DEBUG: Final sceneGroup state:`, {
      childrenCount: sceneGroup.children.length,
      isInScene: scene.children.includes(sceneGroup),
      groupName: sceneGroup.name,
      groupVisible: sceneGroup.visible,
      sceneChildrenTotal: scene.children.length
    });
    
    return sceneGroup;
  }



  /**
   * Clean up resources
   */
  static dispose(): void {
    this.cubeRegistry.clear();
    this.excludedCoordinates.clear();
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
