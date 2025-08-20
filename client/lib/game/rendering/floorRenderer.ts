import * as THREE from 'three';
import { DungeonApi } from '../network/dungeonApi';
import { 
  DungeonNode, 
  GeneratedFloorTilesResponse,
  StairTile,
  WallTile
} from '../types/api';
import { CubeFloorRenderer, CubePosition } from './cubeFloorRenderer';
import { WallGenerator } from '../generators/wallGenerator';
import { StairRenderer } from './stairRenderer';
import { CubeConfig } from '../config/cubeConfig';

export interface DungeonDagData {
  dungeonDagNodeName: string;
  nodes: DungeonNode[];
}

export interface FloorRenderOptions {
  cubeSize?: number;
  roomColor?: number;
  hallwayColor?: number;
  yOffset?: number;
  showDoors?: boolean;
  showStairs?: boolean;
  showWalls?: boolean;
  wallHeight?: number;
  wallColor?: number;
  showCeiling?: boolean;
  ceilingColor?: number;
  cubeColor?: number;
}

/**
 * Complete floor renderer - fetches data from server and renders efficiently
 * 
 * This consolidates the functionality of FloorGenerator, DungeonFloorRenderer, 
 * and HallwayRenderer into a single optimized class that:
 * 1. Fetches server-generated floor data with pre-calculated tiles
 * 2. Renders using efficient server tile method
 * 3. Provides fallback for legacy cases
 */
export class FloorRenderer {
  private static readonly DEFAULT_OPTIONS: Required<FloorRenderOptions> = {
    cubeSize: CubeConfig.getCubeSize(),
    roomColor: 0x0080ff, // Blue for rooms
    hallwayColor: 0xff0000, // Red for hallways
    yOffset: 0,
    showDoors: true,
    showStairs: false,
    showWalls: true,
    wallHeight: CubeConfig.getWallHeight(),
    wallColor: 0x666666, // Gray walls
    showCeiling: true,
    ceilingColor: 0x444444, // Darker gray ceiling
    cubeColor: 0x8B4513 // Brown floor
  };

  /**
   * Main method: Fetch floor data and render efficiently
   */
  static async renderFloor(
    scene: THREE.Scene,
    serverAddress: string,
    dungeonDagNodeName: string,
    options: FloorRenderOptions = {}
  ): Promise<GeneratedFloorTilesResponse> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    // Clear any existing floor elements before rendering new floor
    this.clearFloor(scene);

    // Fetch layout with server tiles
    const layout = await this.getFloorLayout(serverAddress, dungeonDagNodeName);

    // Use optimized server tile rendering if available
    await this.renderFromServerTiles(scene, layout, opts);

    return layout;
  }

  /**
   * Render using pre-calculated server tiles (OPTIMAL PATH)
   */
  static async renderFromServerTiles(
    scene: THREE.Scene,
    layout: GeneratedFloorTilesResponse,
    options: FloorRenderOptions = {}
  ): Promise<void> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    // Get downward stair positions to exclude from floor rendering
    const downwardStairPositions = layout.data.tiles.downwardStairTiles;

    // Render different tile types with different colors
    // filter layout.data.tiles.floorTiles by floorTiles.type
    const roomTiles: CubePosition[] = [];
    const hallwayTiles: CubePosition[] = [];

    layout.data.tiles.floorTiles.forEach(tile => {
      if (tile.type === 'room') {
        roomTiles.push({ x: tile.x, y: tile.y });
      } else if (tile.type === 'hallway') {
        hallwayTiles.push({ x: tile.x, y: tile.y });
      }
    });

    // Register cubes with appropriate colors (excluding stair positions)
    if (roomTiles.length > 0) {
      CubeFloorRenderer.registerCubes(roomTiles, opts.roomColor, 'room');
    }
    if (hallwayTiles.length > 0) {
      CubeFloorRenderer.registerCubes(hallwayTiles, opts.hallwayColor, 'hallway');
    }

    // Actually render all the registered cubes to the scene
    CubeFloorRenderer.renderAllCubes(scene, {
      cubeSize: opts.cubeSize,
      yOffset: opts.yOffset
    });

    // Render additional elements
    if (opts.showWalls) {
      this.renderWalls(scene, layout.data.tiles.wallTiles, opts, downwardStairPositions);
    }

    if (opts.showStairs) {
      this.renderStairs(scene, layout.data.tiles.upwardStairTiles, opts, "upward");
    }

    if (opts.showStairs) {
      this.renderStairs(scene, layout.data.tiles.downwardStairTiles, opts, "downward");
    }

    // Render ceiling if enabled (over ALL floor positions including stairs)
    if (opts.showCeiling) {
      // combine floor tiles with stair tiles to get all ceiling coords
      const allCeilingCoords = [
        ...layout.data.tiles.floorTiles.map(tile => ({ x: tile.x, y: tile.y, z: opts.wallHeight })),
        ...layout.data.tiles.upwardStairTiles.map(tile => ({ x: tile.x, y: tile.y, z: opts.wallHeight })),
        ...layout.data.tiles.downwardStairTiles.map(tile => ({ x: tile.x, y: tile.y, z: opts.wallHeight }))
      ];
      WallGenerator.renderCeiling(scene, allCeilingCoords, opts);
    }
  }

  /**
   * Fetch floor layout from server (consolidates FloorGenerator functionality)
   */
  static async getFloorLayout(serverAddress: string, dungeonDagNodeName: string): Promise<GeneratedFloorTilesResponse> {
    const response = await DungeonApi.getGeneratedFloorTiles(serverAddress, dungeonDagNodeName);

    if (!response.success) {
      throw new Error('Failed to get generated floor layout from server');
    }

    return response;
  }

  /**
   * Render walls around the floor
   */
  private static renderWalls(scene: THREE.Scene, wallCoords: WallTile[], opts: FloorRenderOptions, excludedStairPositions: CubePosition[] = []): void {
    try {    
      const wallOptions = {
        wallHeight: opts.wallHeight,
        wallColor: opts.wallColor,
        showCeiling: opts.showCeiling,
        ceilingColor: opts.ceilingColor,
        cubeSize: opts.cubeSize
      };

      // Actually render the walls to the scene
      if (wallCoords.length > 0) {
        WallGenerator.renderWalls(scene, wallCoords, wallOptions);
      }
    } catch (error) {
      console.warn('Failed to render walls:', error);
    }
  }

  /**
   * Render stairs in rooms
   */
  private static renderStairs(scene: THREE.Scene, stairTiles: StairTile[], opts: FloorRenderOptions, direction: "upward" | "downward"): void {
    try {
      StairRenderer.renderStairs(scene, stairTiles, {
        cubeSize: opts.cubeSize,
        yOffset: opts.yOffset,
        direction: direction
      });
    } catch (error) {
      console.warn('Failed to render stairs:', error);
    }
  }

  /**
   * Clear all rendered elements
   */
  static clearFloor(scene: THREE.Scene): void {

    // Clear CubeFloorRenderer registry first
    CubeFloorRenderer.clearRegistry();

    // Find and remove all floor-related objects
    const objectsToRemove: THREE.Object3D[] = [];
    scene.traverse((child) => {
      // Check for different types of floor-related objects
      const shouldRemove = 
      // Walls and ceilings
      child.userData.isWall || 
      child.userData.isCeiling ||
      child.userData.type === 'wall' || 
      child.userData.type === 'stair' ||
      child.userData.type === 'ceiling' ||
      // Named groups and objects
      child.name === 'AllFloorCubes' ||
      child.name === 'Walls' ||
      child.name === 'Ceiling' ||
      child.name === 'Stairs' ||
      // Floor cubes by name pattern
      (child.name && child.name.startsWith('FloorCube_')) ||
      // Wall and ceiling by name pattern
      (child.name && child.name.includes('Wall_')) ||
      (child.name && child.name.includes('Ceiling_')) ||
      (child.name && child.name.includes('Stair_'));
      
      if (shouldRemove) {
      objectsToRemove.push(child);
      }
    });

      
    // Remove all found objects and dispose resources
    objectsToRemove.forEach(obj => {
      // Remove from parent (which could be scene or a group)
      if (obj.parent) {
        obj.parent.remove(obj);
      } else {
        scene.remove(obj);
      }
      
      // Dispose geometry and materials to prevent memory leaks
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => mat.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
      
      // If it's a group, recursively dispose its children
      if (obj instanceof THREE.Group) {
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
        obj.clear();
      }
    });
  }
}
