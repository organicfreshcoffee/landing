import * as THREE from 'three';
import { FloorGenerator, DungeonDagData } from '../generators/floorGenerator';
import { HallwayRenderer } from './hallwayRenderer';
import { RoomRenderer } from './roomRenderer';
import { CubeFloorRenderer } from './cubeFloorRenderer';
import { WallGenerator } from '../generators/wallGenerator';
import { StairRenderer } from './stairRenderer';
import { ServerFloorLayout } from '../types/generator';
import { CubeConfig } from '../config/cubeConfig';

export interface DungeonRenderOptions {
  cubeSize?: number;
  roomColor?: number;
  hallwayColor?: number;
  yOffset?: number;
  hallwayWidth?: number;
  showDoors?: boolean;
  showStairs?: boolean;
  showStairModels?: boolean;
  showDebug?: boolean;
  showWalls?: boolean;
  wallHeight?: number;
  wallColor?: number;
  showCeiling?: boolean;
  ceilingColor?: number;
  cubeMaterial?: THREE.Material;
  cubeColor?: number;
}

/**
 * Complete dungeon floor renderer that handles DAG data
 */
export class DungeonFloorRenderer {
  private static readonly DEFAULT_OPTIONS: Required<DungeonRenderOptions> = {
    cubeSize: CubeConfig.getCubeSize(),
    roomColor: 0x0080ff, // Blue for rooms
    hallwayColor: 0xff0000, // Red for hallways
    yOffset: 0,
    hallwayWidth: 1,
    showDoors: true,
    showStairs: false,
    showStairModels: true,
    showDebug: false,
    showWalls: true,
    wallHeight: CubeConfig.getWallHeight(),
    wallColor: 0x666666, // Gray walls
    showCeiling: true,
    ceilingColor: 0x444444, // Darker gray ceiling
    cubeMaterial: new THREE.MeshLambertMaterial(),
    cubeColor: 0x8B4513 // Brown floor
  };

  /**
   * Render a complete dungeon floor from DAG data
   */
  static async renderDungeonFloor(
    scene: THREE.Scene,
    dungeonData: DungeonDagData,
    options: DungeonRenderOptions = {}
  ): Promise<{
    floorGroup: THREE.Group;
    wallGroup: THREE.Group | null;
    ceilingGroup: THREE.Group | null;
    stairGroup: THREE.Group | null;
    roomCount: number;
    hallwayCount: number;
    overlapCount: number;
    totalArea: number;
    wallCount: number;
    ceilingCount: number;
    stairCount: number;
    layout: ServerFloorLayout;
  }> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    console.log(`🏰 Starting dungeon floor rendering for ${dungeonData.dungeonDagNodeName}`);
    
    // Clear previous cube registrations
    CubeFloorRenderer.clearRegistry();
    
    // Process DAG data into positioned layout
    const layout = FloorGenerator.processServerResponse(dungeonData);
    
    // Render rooms first
    const roomCoordinates = RoomRenderer.renderMultipleRooms(scene, layout.rooms, {
      cubeSize: opts.cubeSize,
      roomColor: opts.roomColor,
      yOffset: opts.yOffset,
      showDoors: opts.showDoors,
      showStairs: opts.showStairs
    });
    
    // Render hallways
    const hallwayCoordinates = HallwayRenderer.renderMultipleHallways(scene, layout.hallways, {
      cubeSize: opts.cubeSize,
      hallwayColor: opts.hallwayColor,
      yOffset: opts.yOffset,
      width: opts.hallwayWidth,
      minimizeOverlaps: true
    });
    
    // Render hallway connections
    HallwayRenderer.renderHallwayConnections(scene, layout.hallways, {
      cubeSize: opts.cubeSize,
      hallwayColor: opts.hallwayColor,
      yOffset: opts.yOffset,
      width: opts.hallwayWidth
    });
    
    // Set excluded coordinates for downward stairs before rendering cubes
    const excludedCoords = StairRenderer.getExcludedFloorCoordinates(layout.rooms);
    CubeFloorRenderer.setExcludedCoordinates(excludedCoords);
    
    // Render all cubes to scene
    const floorGroup = CubeFloorRenderer.renderAllCubes(scene, {
      cubeSize: opts.cubeSize,
      yOffset: opts.yOffset
    });
    
    // Render stair models if enabled
    let stairGroup: THREE.Group | null = null;
    let stairCount = 0;
    if (opts.showStairModels) {
      try {
        stairGroup = await StairRenderer.renderStairs(scene, layout.rooms, {
          cubeSize: opts.cubeSize,
          yOffset: opts.yOffset
        });
        stairCount = stairGroup.children.length;
      } catch (error) {
        console.error('Failed to render stair models:', error);
      }
    }
    
    // Generate and render walls and ceiling around all floor coordinates
    let wallGroup: THREE.Group | null = null;
    let ceilingGroup: THREE.Group | null = null;
    let wallCount = 0;
    let ceilingCount = 0;
    if (opts.showWalls) {
      // Get all floor coordinates from the cube renderer
      const allFloorCoords = CubeFloorRenderer.getAllCoordinates();
      
      if (allFloorCoords.length > 0) {
        // Generate walls around perimeter
        const wallCoords = WallGenerator.generateWalls(allFloorCoords);
        
        // Render walls
        wallGroup = WallGenerator.renderWalls(scene, wallCoords, {
          wallHeight: opts.wallHeight,
          wallColor: opts.wallColor,
          cubeSize: opts.cubeSize
        });
        wallCount = wallCoords.length;
        
        // Optionally render ceiling
        if (opts.showCeiling) {
          ceilingGroup = WallGenerator.renderCeiling(scene, allFloorCoords, {
            wallHeight: opts.wallHeight,
            ceilingColor: opts.ceilingColor,
            cubeSize: opts.cubeSize
          });
          ceilingCount = allFloorCoords.length;
        }
        
        console.log(`🧱 Generated ${wallCount} walls around ${allFloorCoords.length} floor tiles`);
        if (ceilingGroup) {
          console.log(`🏠 Generated ${ceilingCount} ceiling cubes`);
        }
      }
    }
    
    // Calculate statistics
    const roomCount = layout.rooms.length;
    const hallwayCount = layout.hallways.length;
    const totalRoomCoords = Array.from(roomCoordinates.values()).flat().length;
    const totalHallwayCoords = Array.from(hallwayCoordinates.values()).flat().length;
    const totalArea = totalRoomCoords + totalHallwayCoords;
    
    // Count overlaps (purple cubes)
    let overlapCount = 0;
    floorGroup.children.forEach(child => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        if (child.material.color.getHex() === 0x800080) { // Purple overlaps
          overlapCount++;
        }
      }
    });
    
    // Add debug visualizations if requested
    if (opts.showDebug) {
      this.addDebugVisualization(scene, layout, opts);
    }
    
    console.log(`✅ Dungeon floor rendering complete:`);
    console.log(`   📊 ${roomCount} rooms, ${hallwayCount} hallways`);
    console.log(`   🎯 ${totalArea} total floor cubes`);
    console.log(`   🟣 ${overlapCount} overlapping cubes`);
    console.log(`   🧱 ${wallCount} wall cubes`);
    if (ceilingGroup) {
      console.log(`   🏠 ${ceilingCount} ceiling cubes`);
    }
    if (stairGroup) {
      console.log(`   🏗️ ${stairCount} stair models`);
    }
    console.log(`   📐 Bounds: ${layout.bounds.width}x${layout.bounds.height}`);
    
    return {
      floorGroup,
      wallGroup,
      ceilingGroup,
      stairGroup,
      roomCount,
      hallwayCount,
      overlapCount,
      totalArea,
      wallCount,
      ceilingCount,
      stairCount,
      layout
    };
  }

  /**
   * Render dungeon floor from server response
   */
  static async renderDungeonFloorFromServer(
    scene: THREE.Scene,
    serverAddress: string,
    dungeonDagNodeName: string,
    options: DungeonRenderOptions = {}
  ): Promise<{
    floorGroup: THREE.Group;
    wallGroup: THREE.Group | null;
    ceilingGroup: THREE.Group | null;
    stairGroup: THREE.Group | null;
    roomCount: number;
    hallwayCount: number;
    overlapCount: number;
    totalArea: number;
    wallCount: number;
    ceilingCount: number;
    stairCount: number;
    layout: ServerFloorLayout;
  }> {
    try {
      console.log(`🌐 Fetching dungeon layout from server: ${dungeonDagNodeName}`);
      
      const layout = await FloorGenerator.getFloorLayout(serverAddress, dungeonDagNodeName);
      
      // Convert to DAG data format for rendering
      const dagData: DungeonDagData = {
        dungeonDagNodeName: layout.dungeonDagNodeName,
        nodes: [] // Layout is already processed
      };
      
      return await this.renderDungeonFloorFromLayout(scene, layout, options);
      
    } catch (error) {
      console.error('Failed to render dungeon floor from server:', error);
      throw error;
    }
  }

  /**
   * Render dungeon floor from pre-processed layout
   */
  static async renderDungeonFloorFromLayout(
    scene: THREE.Scene,
    layout: ServerFloorLayout,
    options: DungeonRenderOptions = {}
  ): Promise<{
    floorGroup: THREE.Group;
    wallGroup: THREE.Group | null;
    ceilingGroup: THREE.Group | null;
    stairGroup: THREE.Group | null;
    roomCount: number;
    hallwayCount: number;
    overlapCount: number;
    totalArea: number;
    wallCount: number;
    ceilingCount: number;
    stairCount: number;
    layout: ServerFloorLayout;
  }> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    console.log(`🏗️ Rendering dungeon floor from layout: ${layout.dungeonDagNodeName}`);
    
    // Clear previous cube registrations
    CubeFloorRenderer.clearRegistry();
    
    // Render rooms
    const roomCoordinates = RoomRenderer.renderMultipleRooms(scene, layout.rooms, {
      cubeSize: opts.cubeSize,
      roomColor: opts.roomColor,
      yOffset: opts.yOffset,
      showDoors: opts.showDoors,
      showStairs: opts.showStairs
    });
    
    // Render hallways
    const hallwayCoordinates = HallwayRenderer.renderMultipleHallways(scene, layout.hallways, {
      cubeSize: opts.cubeSize,
      hallwayColor: opts.hallwayColor,
      yOffset: opts.yOffset,
      width: opts.hallwayWidth,
      minimizeOverlaps: true
    });
    
    // Render all cubes
    const floorGroup = CubeFloorRenderer.renderAllCubes(scene, {
      cubeSize: opts.cubeSize,
      yOffset: opts.yOffset
    });
    
    // Render stair models if enabled
    let stairGroup: THREE.Group | null = null;
    let stairCount = 0;
    if (opts.showStairModels) {
      try {
        stairGroup = await StairRenderer.renderStairs(scene, layout.rooms, {
          cubeSize: opts.cubeSize,
          yOffset: opts.yOffset
        });
        stairCount = stairGroup.children.length;
      } catch (error) {
        console.error('Failed to render stair models:', error);
      }
    }
    
    // Generate and render walls and ceiling around all floor coordinates
    let wallGroup: THREE.Group | null = null;
    let ceilingGroup: THREE.Group | null = null;
    let wallCount = 0;
    let ceilingCount = 0;
    if (opts.showWalls) {
      // Get all floor coordinates from the cube renderer
      const allFloorCoords = CubeFloorRenderer.getAllCoordinates();
      
      if (allFloorCoords.length > 0) {
        // Generate walls around perimeter
        const wallCoords = WallGenerator.generateWalls(allFloorCoords);
        
        // Render walls
        wallGroup = WallGenerator.renderWalls(scene, wallCoords, {
          wallHeight: opts.wallHeight,
          wallColor: opts.wallColor,
          cubeSize: opts.cubeSize
        });
        wallCount = wallCoords.length;
        
        // Optionally render ceiling
        if (opts.showCeiling) {
          ceilingGroup = WallGenerator.renderCeiling(scene, allFloorCoords, {
            wallHeight: opts.wallHeight,
            ceilingColor: opts.ceilingColor,
            cubeSize: opts.cubeSize
          });
          ceilingCount = allFloorCoords.length;
        }
        
        console.log(`🧱 Generated ${wallCount} walls around ${allFloorCoords.length} floor tiles`);
        if (ceilingGroup) {
          console.log(`🏠 Generated ${ceilingCount} ceiling cubes`);
        }
      }
    }
    
    // Calculate statistics
    const roomCount = layout.rooms.length;
    const hallwayCount = layout.hallways.length;
    const totalRoomCoords = Array.from(roomCoordinates.values()).flat().length;
    const totalHallwayCoords = Array.from(hallwayCoordinates.values()).flat().length;
    const totalArea = totalRoomCoords + totalHallwayCoords;
    
    let overlapCount = 0;
    floorGroup.children.forEach(child => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        if (child.material.color.getHex() === 0x800080) {
          overlapCount++;
        }
      }
    });
    
    if (opts.showDebug) {
      this.addDebugVisualization(scene, layout, opts);
    }
    
    return {
      floorGroup,
      wallGroup,
      ceilingGroup,
      stairGroup,
      roomCount,
      hallwayCount,
      overlapCount,
      totalArea,
      wallCount,
      ceilingCount,
      stairCount,
      layout
    };
  }

  /**
   * Add debug visualization to the scene
   */
  private static addDebugVisualization(
    scene: THREE.Scene,
    layout: ServerFloorLayout,
    options: DungeonRenderOptions
  ): void {
    console.log(`🐛 Adding debug visualization`);
    
    // Room debug boxes
    layout.rooms.forEach(room => {
      RoomRenderer.createRoomDebugVisualization(scene, room, {
        cubeSize: options.cubeSize,
        yOffset: options.yOffset
      });
    });
    
    // Hallway debug lines
    layout.hallways.forEach(hallway => {
      HallwayRenderer.createHallwayDebugVisualization(scene, hallway, {
        cubeSize: options.cubeSize,
        yOffset: options.yOffset
      });
    });
  }

  /**
   * Get comprehensive dungeon statistics
   */
  static getDungeonStats(layout: ServerFloorLayout): {
    rooms: ReturnType<typeof RoomRenderer.getRoomStats>;
    hallways: ReturnType<typeof HallwayRenderer.getHallwayStats>;
    totalNodes: number;
    bounds: { width: number; height: number };
    efficiency: {
      roomToHallwayRatio: number;
      averageRoomArea: number;
      averageHallwayLength: number;
    };
  } {
    const roomStats = RoomRenderer.getRoomStats(layout.rooms);
    const hallwayStats = HallwayRenderer.getHallwayStats(layout.hallways);
    
    return {
      rooms: roomStats,
      hallways: hallwayStats,
      totalNodes: layout.rooms.length + layout.hallways.length,
      bounds: layout.bounds,
      efficiency: {
        roomToHallwayRatio: layout.hallways.length > 0 ? layout.rooms.length / layout.hallways.length : 0,
        averageRoomArea: roomStats.averageArea,
        averageHallwayLength: hallwayStats.averageLength
      }
    };
  }

  /**
   * Clean up all dungeon rendering resources
   */
  static dispose(): void {
    CubeFloorRenderer.dispose();
    StairRenderer.dispose();
    console.log(`🧹 Dungeon floor renderer resources cleaned up`);
  }
}