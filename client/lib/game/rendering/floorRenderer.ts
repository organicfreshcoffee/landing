import * as THREE from 'three';
import { DungeonApi } from '../network/dungeonApi';
import { 
  DungeonNode, 
  GeneratedFloorResponse,
  ServerGeneratedFloorData
} from '../types/api';
import {
  ServerRoom,
  ServerHallway,
  ServerFloorLayout
} from '../types/generator';
import { CubeFloorRenderer, CubePosition } from './cubeFloorRenderer';
import { RoomRenderer } from './roomRenderer';
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
  ): Promise<{ layout: ServerFloorLayout; stats: any }> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    // Fetch layout with server tiles
    const layout = await this.getFloorLayout(serverAddress, dungeonDagNodeName);
    
    // Use optimized server tile rendering if available
    if (this.hasServerTiles(layout)) {
      console.log('🚀 Using optimized server tile rendering');
      await this.renderFromServerTiles(scene, layout, opts);
    } else {
      console.log('⚙️ Using fallback legacy rendering');
      await this.renderFromLayout(scene, layout, opts);
    }

    return {
      layout,
      stats: this.getLayoutStats(layout)
    };
  }

  /**
   * Render using pre-calculated server tiles (OPTIMAL PATH)
   */
  static async renderFromServerTiles(
    scene: THREE.Scene,
    layout: ServerFloorLayout,
    options: FloorRenderOptions = {}
  ): Promise<void> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    if (!layout.serverFloorTiles) {
      throw new Error('No server tiles available');
    }

    console.log(`🎯 Rendering ${layout.serverFloorTiles.length} server-provided floor tiles`);
    
    // Get downward stair positions to exclude from floor rendering
    const downwardStairPositions = this.getDownwardStairPositions(layout);
    console.log(`🪜 Found ${downwardStairPositions.length} downward stair positions to exclude from floor`);
    
    // Convert server tiles to CubePosition format and filter out downward stairs
    const allFloorTiles: CubePosition[] = layout.serverFloorTiles.map(tile => ({
      x: tile.x,
      y: tile.y
    }));
    
    const floorTiles = this.filterOutStairPositions(allFloorTiles, downwardStairPositions);
    console.log(`🎯 Filtered floor tiles: ${allFloorTiles.length} -> ${floorTiles.length} (excluded ${allFloorTiles.length - floorTiles.length} stair positions)`);

    // Render different tile types with different colors
    const roomTiles: CubePosition[] = [];
    const hallwayTiles: CubePosition[] = [];
    
    // Categorize tiles if server provides room/hallway specific tiles (also filter out stairs)
    if (layout.serverRoomTiles) {
      Object.values(layout.serverRoomTiles).forEach(tiles => {
        tiles.forEach(tile => {
          const pos = { x: tile.x, y: tile.y };
          if (!this.isStairPosition(pos, downwardStairPositions)) {
            roomTiles.push(pos);
          }
        });
      });
    }
    
    if (layout.serverHallwayTiles) {
      Object.values(layout.serverHallwayTiles).forEach(tiles => {
        tiles.forEach(tile => {
          const pos = { x: tile.x, y: tile.y };
          if (!this.isStairPosition(pos, downwardStairPositions)) {
            hallwayTiles.push(pos);
          }
        });
      });
    }

    // Register cubes with appropriate colors (excluding stair positions)
    if (roomTiles.length > 0) {
      CubeFloorRenderer.registerCubes(roomTiles, opts.roomColor, 'room');
    }
    if (hallwayTiles.length > 0) {
      CubeFloorRenderer.registerCubes(hallwayTiles, opts.hallwayColor, 'hallway');
    }
    
    // If no categorized tiles, use all floor tiles with default color (already filtered)
    if (roomTiles.length === 0 && hallwayTiles.length === 0) {
      CubeFloorRenderer.registerCubes(floorTiles, opts.cubeColor, 'room');
    }

    // Actually render all the registered cubes to the scene
    console.log(`🎯 Rendering all registered floor cubes to scene...`);
    CubeFloorRenderer.renderAllCubes(scene, {
      cubeSize: opts.cubeSize,
      yOffset: opts.yOffset
    });

    // Render additional elements
    if (opts.showWalls) {
      this.renderWalls(scene, layout, opts, downwardStairPositions);
    }
    
    if (opts.showStairs) {
      this.renderStairs(scene, layout, opts);
    }
  }

  /**
   * Fallback rendering for legacy cases
   */
  static async renderFromLayout(
    scene: THREE.Scene,
    layout: ServerFloorLayout,
    options: FloorRenderOptions = {}
  ): Promise<void> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    console.log(`⚙️ Legacy rendering: ${layout.rooms.length} rooms, ${layout.hallways.length} hallways`);
    
    // Get downward stair positions to exclude from floor rendering
    const downwardStairPositions = this.getDownwardStairPositions(layout);
    console.log(`🪜 Found ${downwardStairPositions.length} downward stair positions to exclude from floor`);
    
    // Render rooms (excluding downward stair positions)
    const roomCoordinates: CubePosition[] = [];
    layout.rooms.forEach(room => {
      for (let x = 0; x < room.width; x++) {
        for (let y = 0; y < room.height; y++) {
          const pos = {
            x: room.position.x + x,
            y: room.position.y + y
          };
          // Don't render floor tile if there's a downward stair at this position
          if (!this.isStairPosition(pos, downwardStairPositions)) {
            roomCoordinates.push(pos);
          }
        }
      }
    });
    
    if (roomCoordinates.length > 0) {
      CubeFloorRenderer.registerCubes(roomCoordinates, opts.roomColor, 'room');
    }

    // Render hallways (they don't have stairs, so no filtering needed)
    const hallwayCoordinates: CubePosition[] = [];
    layout.hallways.forEach(hallway => {
      if (hallway.segments) {
        hallway.segments.forEach(segment => {
          const dx = segment.end.x - segment.start.x;
          const dy = segment.end.y - segment.start.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const steps = Math.max(1, Math.ceil(length));
          
          for (let i = 0; i <= steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = Math.round(segment.start.x + (dx * t));
            const y = Math.round(segment.start.y + (dy * t));
            hallwayCoordinates.push({ x, y });
          }
        });
      }
    });
    
    if (hallwayCoordinates.length > 0) {
      // Remove duplicates
      const uniqueCoords = new Map<string, CubePosition>();
      hallwayCoordinates.forEach(coord => {
        const key = `${coord.x},${coord.y}`;
        uniqueCoords.set(key, coord);
      });
      CubeFloorRenderer.registerCubes(Array.from(uniqueCoords.values()), opts.hallwayColor, 'hallway');
    }

    // Actually render all the registered cubes to the scene
    console.log(`🎯 Legacy: Rendering all registered floor cubes to scene...`);
    CubeFloorRenderer.renderAllCubes(scene, {
      cubeSize: opts.cubeSize,
      yOffset: opts.yOffset
    });

    // Render additional elements
    if (opts.showWalls) {
      this.renderWalls(scene, layout, opts, downwardStairPositions);
    }
    
    if (opts.showStairs) {
      this.renderStairs(scene, layout, opts);
    }
  }

  /**
   * Fetch floor layout from server (consolidates FloorGenerator functionality)
   */
  static async getFloorLayout(serverAddress: string, dungeonDagNodeName: string): Promise<ServerFloorLayout> {
    try {
      // First try the new server-side generated floor endpoint
      const response = await DungeonApi.getGeneratedFloor(serverAddress, dungeonDagNodeName);
      
      if (!response.success) {
        throw new Error('Failed to get generated floor layout from server');
      }

      return this.convertServerGeneratedData(response.data);
    } catch (error) {
      console.error('Error fetching generated floor layout:', error);
      console.log('🔄 Falling back to legacy DAG-based generation...');
      
      try {
        // Fall back to legacy endpoint and client-side generation
        const legacyResponse = await DungeonApi.getFloorLayout(serverAddress, dungeonDagNodeName);
        
        if (!legacyResponse.success) {
          throw new Error('Failed to get legacy floor layout from server');
        }

        return this.processServerResponse(legacyResponse.data);
      } catch (legacyError) {
        console.error('Legacy generation also failed:', legacyError);
        console.log('🔄 Falling back to sample data for development...');
        
        // Last resort: use sample data
        return this.getSampleFloorLayout(dungeonDagNodeName);
      }
    }
  }

  /**
   * Convert server-generated floor data to client format
   */
  static convertServerGeneratedData(data: ServerGeneratedFloorData): ServerFloorLayout {
    console.log(`🏗️ Converting server-generated floor data for ${data.dungeonDagNodeName}`);
    
    // Convert rooms
    const rooms: ServerRoom[] = data.rooms.map(room => ({
      id: room.id,
      name: room.name,
      position: new THREE.Vector2(room.position.x, room.position.y),
      width: room.width,
      height: room.height,
      hasUpwardStair: room.hasUpwardStair,
      hasDownwardStair: room.hasDownwardStair,
      stairLocationX: room.stairLocationX,
      stairLocationY: room.stairLocationY,
      children: room.children,
      parentDirection: room.parentDirection as "left" | "right" | "center" | undefined,
      parentDoorOffset: room.parentDoorOffset,
      doorPosition: new THREE.Vector2(room.doorPosition.x, room.doorPosition.y),
      doorSide: room.doorSide as "top" | "right" | "bottom" | "left"
    }));

    // Convert hallways
    const hallways: ServerHallway[] = data.hallways.map(hallway => ({
      id: hallway.id,
      name: hallway.name,
      length: hallway.length,
      parentDirection: hallway.parentDirection as "left" | "right" | "center" | undefined,
      parentDoorOffset: hallway.parentDoorOffset,
      children: hallway.children,
      startPosition: new THREE.Vector2(hallway.startPosition.x, hallway.startPosition.y),
      endPosition: new THREE.Vector2(hallway.endPosition.x, hallway.endPosition.y),
      direction: new THREE.Vector2(hallway.direction.x, hallway.direction.y),
      segments: hallway.segments.map(segment => ({
        start: new THREE.Vector2(segment.start.x, segment.start.y),
        end: new THREE.Vector2(segment.end.x, segment.end.y),
        direction: new THREE.Vector2(segment.direction.x, segment.direction.y),
        length: segment.length
      }))
    }));

    // Create node map for lookups
    const nodeMap = new Map<string, ServerRoom | ServerHallway>();
    rooms.forEach(room => nodeMap.set(room.name, room));
    hallways.forEach(hallway => nodeMap.set(hallway.name, hallway));

    console.log(`✅ Converted ${rooms.length} rooms and ${hallways.length} hallways from server data`);

    return {
      dungeonDagNodeName: data.dungeonDagNodeName,
      rooms,
      hallways,
      bounds: data.bounds,
      nodeMap,
      rootNode: data.rootNode,
      // Store the server's pre-calculated tiles for efficient rendering
      serverFloorTiles: data.floorTiles,
      serverRoomTiles: data.roomTiles,
      serverHallwayTiles: data.hallwayTiles
    };
  }

  /**
   * Check if the layout has server-generated tiles
   */
  static hasServerTiles(layout: ServerFloorLayout): boolean {
    return !!(layout.serverFloorTiles && layout.serverFloorTiles.length > 0);
  }

  /**
   * Get all floor tiles from the layout
   */
  static getAllFloorTiles(layout: ServerFloorLayout): Array<{ x: number; y: number }> {
    if (layout.serverFloorTiles && layout.serverFloorTiles.length > 0) {
      return layout.serverFloorTiles;
    }

    // Fallback generation
    const tiles: Array<{ x: number; y: number }> = [];
    
    layout.rooms.forEach(room => {
      for (let x = 0; x < room.width; x++) {
        for (let y = 0; y < room.height; y++) {
          tiles.push({
            x: room.position.x + x,
            y: room.position.y + y
          });
        }
      }
    });

    layout.hallways.forEach(hallway => {
      if (hallway.segments) {
        hallway.segments.forEach(segment => {
          const dx = segment.end.x - segment.start.x;
          const dy = segment.end.y - segment.start.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const steps = Math.max(1, Math.ceil(length));
          
          for (let i = 0; i <= steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = Math.round(segment.start.x + (dx * t));
            const y = Math.round(segment.start.y + (dy * t));
            tiles.push({ x, y });
          }
        });
      }
    });

    const uniqueTiles = new Map<string, { x: number; y: number }>();
    tiles.forEach(tile => {
      const key = `${tile.x},${tile.y}`;
      uniqueTiles.set(key, tile);
    });

    return Array.from(uniqueTiles.values());
  }

  /**
   * Render walls around the floor
   */
  private static renderWalls(scene: THREE.Scene, layout: ServerFloorLayout, opts: FloorRenderOptions, excludedStairPositions: CubePosition[] = []): void {
    try {
      // Get all floor coordinates for wall generation (including stair positions for ceiling)
      const allFloorCoords = this.getAllFloorTiles(layout).map(tile => ({
        x: tile.x,
        y: tile.y
      }));
      
      console.log(`🧱 Generating walls around ${allFloorCoords.length} floor tiles`);
      
      const wallOptions = {
        wallHeight: opts.wallHeight,
        wallColor: opts.wallColor,
        showCeiling: opts.showCeiling,
        ceilingColor: opts.ceilingColor,
        cubeSize: opts.cubeSize
      };
      
      // Generate wall coordinates (excluding stair positions so no walls block stairs)
      const wallCoords = WallGenerator.generateWalls(allFloorCoords, wallOptions, excludedStairPositions);
      
      // Actually render the walls to the scene
      if (wallCoords.length > 0) {
        console.log(`🏗️ Rendering ${wallCoords.length} walls to scene`);
        WallGenerator.renderWalls(scene, wallCoords, wallOptions);
      }
      
      // Render ceiling if enabled (over ALL floor positions including stairs)
      if (opts.showCeiling) {
        console.log(`🏠 Rendering ceiling over ${allFloorCoords.length} floor tiles (including above stairs)`);
        WallGenerator.renderCeiling(scene, allFloorCoords, wallOptions);
      }
    } catch (error) {
      console.warn('Failed to render walls:', error);
    }
  }

  /**
   * Render stairs in rooms
   */
  private static renderStairs(scene: THREE.Scene, layout: ServerFloorLayout, opts: FloorRenderOptions): void {
    try {
      const roomsWithStairs = layout.rooms.filter(room => 
        room.hasUpwardStair || room.hasDownwardStair
      );
      
      if (roomsWithStairs.length > 0) {
        StairRenderer.renderStairs(scene, roomsWithStairs, {
          cubeSize: opts.cubeSize,
          yOffset: opts.yOffset
        });
      }
    } catch (error) {
      console.warn('Failed to render stairs:', error);
    }
  }

  /**
   * Get statistics about the layout
   */
  private static getLayoutStats(layout: ServerFloorLayout): any {
    return {
      rooms: layout.rooms.length,
      hallways: layout.hallways.length,
      hasServerTiles: this.hasServerTiles(layout),
      totalFloorTiles: layout.serverFloorTiles?.length || 0,
      bounds: layout.bounds
    };
  }

  /**
   * Clear all rendered elements
   */
  static clearFloor(scene: THREE.Scene): void {
    CubeFloorRenderer.clearRegistry();
    
    // Clear walls, stairs, etc.
    const objectsToRemove: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (child.userData.type === 'wall' || child.userData.type === 'stair') {
        objectsToRemove.push(child);
      }
    });
    
    objectsToRemove.forEach(obj => {
      scene.remove(obj);
      if (obj instanceof THREE.Mesh && obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj instanceof THREE.Mesh && obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(mat => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }

  // Legacy support methods (simplified versions)
  
  /**
   * Get all downward stair positions from the layout
   */
  private static getDownwardStairPositions(layout: ServerFloorLayout): CubePosition[] {
    const stairPositions: CubePosition[] = [];
    
    layout.rooms.forEach(room => {
      if (room.hasDownwardStair && 
          room.stairLocationX !== undefined && 
          room.stairLocationY !== undefined) {
        stairPositions.push({
          x: room.position.x + room.stairLocationX,
          y: room.position.y + room.stairLocationY
        });
      }
    });
    
    return stairPositions;
  }

  /**
   * Filter out stair positions from an array of floor positions
   */
  private static filterOutStairPositions(floorTiles: CubePosition[], stairPositions: CubePosition[]): CubePosition[] {
    return floorTiles.filter(tile => !this.isStairPosition(tile, stairPositions));
  }

  /**
   * Check if a position matches any stair position
   */
  private static isStairPosition(position: CubePosition, stairPositions: CubePosition[]): boolean {
    return stairPositions.some(stair => stair.x === position.x && stair.y === position.y);
  }
}
