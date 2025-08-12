import * as THREE from 'three';
import { ServerRoom } from '../types/generator';
import { CubeFloorRenderer, CubePosition } from './cubeFloorRenderer';
import { CubeConfig } from '../config/cubeConfig';

export interface RoomRenderOptions {
  cubeSize?: number;
  roomColor?: number;
  yOffset?: number;
  showDoors?: boolean;
  showStairs?: boolean;
  doorColor?: number;
  stairColor?: number;
}

/**
 * Renderer for room floors using cube system
 */
export class RoomRenderer {
  private static readonly DEFAULT_OPTIONS: Required<RoomRenderOptions> = {
    cubeSize: CubeConfig.getCubeSize(),
    roomColor: 0x0080ff, // Blue for rooms
    yOffset: 0,
    showDoors: true,
    showStairs: false,
    doorColor: 0x8B4513, // Brown for doors
    stairColor: 0x808080 // Gray for stairs
  };

  /**
   * Render a single room floor
   */
  static renderRoom(
    scene: THREE.Scene,
    room: ServerRoom,
    options: RoomRenderOptions = {}
  ): CubePosition[] {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    // Generate room floor coordinates
    const coordinates = this.generateRoomFloor(room);
    
    if (coordinates.length === 0) {
      console.warn(`No coordinates generated for room ${room.name}`);
      return [];
    }
    
    // Register with cube renderer
    CubeFloorRenderer.registerCubes(coordinates, opts.roomColor, 'room');
    
    // Handle doors
    if (opts.showDoors && room.doorPosition) {
      const doorCoords = this.generateDoorFloor(room);
      if (doorCoords.length > 0) {
        CubeFloorRenderer.registerCubes(doorCoords, opts.doorColor, 'room');
      }
    }
    
    // Handle stairs
    if (opts.showStairs && this.hasStairs(room)) {
      const stairCoords = this.generateStairFloor(room);
      if (stairCoords.length > 0) {
        CubeFloorRenderer.registerCubes(stairCoords, opts.stairColor, 'room');
      }
    }
    
    console.log(`🔵 Rendered room ${room.name} (${room.width}x${room.height}) with ${coordinates.length} cubes`);
    return coordinates;
  }

  /**
   * Render multiple rooms
   */
  static renderMultipleRooms(
    scene: THREE.Scene,
    rooms: ServerRoom[],
    options: RoomRenderOptions = {}
  ): Map<string, CubePosition[]> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const renderedRooms = new Map<string, CubePosition[]>();
    
    console.log(`🏠 Rendering ${rooms.length} rooms...`);
    
    rooms.forEach(room => {
      const coordinates = this.renderRoom(scene, room, opts);
      renderedRooms.set(room.name, coordinates);
    });
    
    return renderedRooms;
  }

  /**
   * Generate floor coordinates for a room
   */
  private static generateRoomFloor(room: ServerRoom): CubePosition[] {
    const coordinates: CubePosition[] = [];
    const { position, width, height } = room;
    
    // Generate coordinates for entire room area
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        coordinates.push({
          x: position.x + x,
          y: position.y + y
        });
      }
    }
    
    return coordinates;
  }

  /**
   * Generate door floor coordinates
   */
  private static generateDoorFloor(room: ServerRoom): CubePosition[] {
    if (!room.doorPosition) {
      return [];
    }
    
    const coordinates: CubePosition[] = [];
    const { doorPosition } = room;
    
    // Single door cube for now - could be expanded for larger doors
    coordinates.push({
      x: doorPosition.x,
      y: doorPosition.y
    });
    
    return coordinates;
  }

  /**
   * Generate stair floor coordinates
   */
  private static generateStairFloor(room: ServerRoom): CubePosition[] {
    const coordinates: CubePosition[] = [];
    
    if (room.stairLocationX !== undefined && room.stairLocationY !== undefined) {
      coordinates.push({
        x: room.position.x + room.stairLocationX,
        y: room.position.y + room.stairLocationY
      });
    }
    
    return coordinates;
  }

  /**
   * Check if room has stairs
   */
  private static hasStairs(room: ServerRoom): boolean {
    return room.hasUpwardStair || room.hasDownwardStair;
  }

  /**
   * Get room area coordinates for collision/overlap detection
   */
  static getRoomArea(room: ServerRoom): CubePosition[] {
    return this.generateRoomFloor(room);
  }

  /**
   * Calculate room bounds
   */
  static getRoomBounds(room: ServerRoom): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  } {
    const { position, width, height } = room;
    
    return {
      minX: position.x,
      maxX: position.x + width - 1,
      minY: position.y,
      maxY: position.y + height - 1,
      width,
      height
    };
  }

  /**
   * Check if two rooms overlap
   */
  static checkRoomOverlap(roomA: ServerRoom, roomB: ServerRoom): boolean {
    const boundsA = this.getRoomBounds(roomA);
    const boundsB = this.getRoomBounds(roomB);
    
    return !(
      boundsA.maxX < boundsB.minX ||
      boundsB.maxX < boundsA.minX ||
      boundsA.maxY < boundsB.minY ||
      boundsB.maxY < boundsA.minY
    );
  }

  /**
   * Get overlapping coordinates between two rooms
   */
  static getRoomOverlapCoordinates(roomA: ServerRoom, roomB: ServerRoom): CubePosition[] {
    if (!this.checkRoomOverlap(roomA, roomB)) {
      return [];
    }
    
    const boundsA = this.getRoomBounds(roomA);
    const boundsB = this.getRoomBounds(roomB);
    
    const overlapMinX = Math.max(boundsA.minX, boundsB.minX);
    const overlapMaxX = Math.min(boundsA.maxX, boundsB.maxX);
    const overlapMinY = Math.max(boundsA.minY, boundsB.minY);
    const overlapMaxY = Math.min(boundsA.maxY, boundsB.maxY);
    
    const coordinates: CubePosition[] = [];
    
    for (let x = overlapMinX; x <= overlapMaxX; x++) {
      for (let y = overlapMinY; y <= overlapMaxY; y++) {
        coordinates.push({ x, y });
      }
    }
    
    return coordinates;
  }

  /**
   * Create room debug visualization
   */
  static createRoomDebugVisualization(
    scene: THREE.Scene,
    room: ServerRoom,
    options: RoomRenderOptions = {}
  ): THREE.Group {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const debugGroup = new THREE.Group();
    debugGroup.name = `RoomDebug_${room.name}`;
    
    // Create wireframe box showing room bounds
    const geometry = new THREE.BoxGeometry(
      room.width * opts.cubeSize,
      opts.cubeSize,
      room.height * opts.cubeSize
    );
    
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xffff00, // Yellow for debug
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    
    const roomBox = new THREE.Mesh(geometry, material);
    roomBox.position.set(
      (room.position.x + room.width / 2) * opts.cubeSize,
      opts.yOffset + opts.cubeSize / 2,
      (room.position.y + room.height / 2) * opts.cubeSize
    );
    roomBox.name = `RoomBounds_${room.name}`;
    debugGroup.add(roomBox);
    
    // Add door marker
    if (room.doorPosition) {
      const doorGeometry = new THREE.SphereGeometry(0.3);
      const doorMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green
      
      const doorMarker = new THREE.Mesh(doorGeometry, doorMaterial);
      doorMarker.position.set(
        room.doorPosition.x * opts.cubeSize,
        opts.yOffset + 1.5,
        room.doorPosition.y * opts.cubeSize
      );
      doorMarker.name = `RoomDoor_${room.name}`;
      debugGroup.add(doorMarker);
    }
    
    // Add stair markers
    if (this.hasStairs(room) && room.stairLocationX !== undefined && room.stairLocationY !== undefined) {
      const stairGeometry = new THREE.ConeGeometry(0.2, 0.6);
      const stairMaterial = new THREE.MeshBasicMaterial({ 
        color: room.hasUpwardStair ? 0x0000ff : 0xff0000 // Blue for up, Red for down
      });
      
      const stairMarker = new THREE.Mesh(stairGeometry, stairMaterial);
      stairMarker.position.set(
        (room.position.x + room.stairLocationX) * opts.cubeSize,
        opts.yOffset + 1.5,
        (room.position.y + room.stairLocationY) * opts.cubeSize
      );
      stairMarker.name = `RoomStair_${room.name}`;
      debugGroup.add(stairMarker);
    }
    
    scene.add(debugGroup);
    return debugGroup;
  }

  /**
   * Get room statistics for debugging
   */
  static getRoomStats(rooms: ServerRoom[]): {
    totalRooms: number;
    totalArea: number;
    averageArea: number;
    largestRoom: { name: string; area: number } | null;
    smallestRoom: { name: string; area: number } | null;
    roomsWithStairs: number;
  } {
    if (rooms.length === 0) {
      return {
        totalRooms: 0,
        totalArea: 0,
        averageArea: 0,
        largestRoom: null,
        smallestRoom: null,
        roomsWithStairs: 0
      };
    }
    
    let totalArea = 0;
    let largestRoom = { name: rooms[0].name, area: rooms[0].width * rooms[0].height };
    let smallestRoom = { name: rooms[0].name, area: rooms[0].width * rooms[0].height };
    let roomsWithStairs = 0;
    
    rooms.forEach(room => {
      const area = room.width * room.height;
      totalArea += area;
      
      if (area > largestRoom.area) {
        largestRoom = { name: room.name, area };
      }
      
      if (area < smallestRoom.area) {
        smallestRoom = { name: room.name, area };
      }
      
      if (this.hasStairs(room)) {
        roomsWithStairs++;
      }
    });
    
    return {
      totalRooms: rooms.length,
      totalArea,
      averageArea: totalArea / rooms.length,
      largestRoom,
      smallestRoom,
      roomsWithStairs
    };
  }
}
