import * as THREE from 'three';
import { FloorGenerator, DungeonDagData } from '../generators/floorGenerator';
import { HallwayRenderer } from './hallwayRenderer';
import { RoomRenderer } from './roomRenderer';
import { CubeFloorRenderer } from './cubeFloorRenderer';
import { ServerFloorLayout } from '../types/generator';

export interface DungeonRenderOptions {
  cubeSize?: number;
  roomColor?: number;
  hallwayColor?: number;
  yOffset?: number;
  hallwayWidth?: number;
  showDoors?: boolean;
  showStairs?: boolean;
  showDebug?: boolean;
}

/**
 * Complete dungeon floor renderer that handles DAG data
 */
export class DungeonFloorRenderer {
  private static readonly DEFAULT_OPTIONS: Required<DungeonRenderOptions> = {
    cubeSize: 1,
    roomColor: 0x0080ff, // Blue for rooms
    hallwayColor: 0xff0000, // Red for hallways
    yOffset: 0,
    hallwayWidth: 1,
    showDoors: true,
    showStairs: false,
    showDebug: false
  };

  /**
   * Render a complete dungeon floor from DAG data
   */
  static renderDungeonFloor(
    scene: THREE.Scene,
    dungeonData: DungeonDagData,
    options: DungeonRenderOptions = {}
  ): {
    floorGroup: THREE.Group;
    roomCount: number;
    hallwayCount: number;
    overlapCount: number;
    totalArea: number;
    layout: ServerFloorLayout;
  } {
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
    
    // Render all cubes to scene
    const floorGroup = CubeFloorRenderer.renderAllCubes(scene, {
      cubeSize: opts.cubeSize,
      yOffset: opts.yOffset
    });
    
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
    console.log(`   📐 Bounds: ${layout.bounds.width}x${layout.bounds.height}`);
    
    return {
      floorGroup,
      roomCount,
      hallwayCount,
      overlapCount,
      totalArea,
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
    roomCount: number;
    hallwayCount: number;
    overlapCount: number;
    totalArea: number;
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
      
      return this.renderDungeonFloorFromLayout(scene, layout, options);
      
    } catch (error) {
      console.error('Failed to render dungeon floor from server:', error);
      throw error;
    }
  }

  /**
   * Render dungeon floor from pre-processed layout
   */
  static renderDungeonFloorFromLayout(
    scene: THREE.Scene,
    layout: ServerFloorLayout,
    options: DungeonRenderOptions = {}
  ): {
    floorGroup: THREE.Group;
    roomCount: number;
    hallwayCount: number;
    overlapCount: number;
    totalArea: number;
    layout: ServerFloorLayout;
  } {
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
      roomCount,
      hallwayCount,
      overlapCount,
      totalArea,
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
    console.log(`🧹 Dungeon floor renderer resources cleaned up`);
  }
}