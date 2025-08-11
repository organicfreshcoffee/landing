import * as THREE from 'three';
import { ServerFloorGenerator, ServerFloorLayout } from './serverFloorGenerator';
import { ServerHallwayGenerator } from './serverHallwayGenerator';
import { RoomRenderer } from './roomRenderer';
import { HallwayRenderer } from './hallwayRenderer';

export interface ServerSceneryOptions {
  cubeSize?: number;
  roomHeight?: number;
  hallwayHeight?: number;
  wallColor?: number;
  floorColor?: number;
  hallwayWallColor?: number;
  hallwayFloorColor?: number;
}

export class ServerSceneryGenerator {
  /**
   * Generates a complete floor layout using server data
   * @param scene - The Three.js scene to add the floor to
   * @param serverAddress - The game server address to fetch data from
   * @param dungeonDagNodeName - The floor identifier from the server
   * @param options - Configuration options for rendering
   */
  static async generateServerFloor(
    scene: THREE.Scene,
    serverAddress: string,
    dungeonDagNodeName: string,
    options: ServerSceneryOptions = {}
  ): Promise<{
    floorLayout: ServerFloorLayout;
    hallwayNetwork: any;
    roomGroups: THREE.Group[];
    hallwayGroup: THREE.Group;
  }> {
    const {
      cubeSize = 1,
      roomHeight = 5,
      hallwayHeight = 5,
      wallColor = 0xcccccc,
      floorColor = 0x666666,
      hallwayWallColor = 0x888888,
      hallwayFloorColor = 0x444444
    } = options;

    console.log(`Starting server floor generation for: ${dungeonDagNodeName}`);

    console.log(`🏰 ServerSceneryGenerator: Starting floor generation for ${dungeonDagNodeName} from ${serverAddress}`);

    try {
      // Step 1: Get floor layout from server
      console.log(`📡 ServerSceneryGenerator: Fetching floor layout...`);
      const floorLayout = await ServerFloorGenerator.getFloorLayout(serverAddress, dungeonDagNodeName);

      // Step 2: Generate hallway network based on server room connections
      const hallwayNetwork = ServerHallwayGenerator.generateHallwayNetwork(
        floorLayout,
        3 // hallway width
      );

      // Step 3: Render all rooms
      const roomGroups: THREE.Group[] = [];
      floorLayout.rooms.forEach((room) => {
        // Convert server room to renderable shape
        const shape = this.convertServerRoomToShape(room);
        const roomGroup = RoomRenderer.renderRoom(scene, shape, {
          cubeSize,
          roomHeight,
          wallColor,
          floorColor,
          position: new THREE.Vector3(room.position.x, 0, room.position.y)
        });
        
        // Add stairs if present
        if (room.hasUpwardStair && room.stairLocationX !== undefined && room.stairLocationY !== undefined) {
          this.addStaircase(roomGroup, room.stairLocationX, room.stairLocationY, roomHeight, 'up');
        }
        if (room.hasDownwardStair && room.stairLocationX !== undefined && room.stairLocationY !== undefined) {
          this.addStaircase(roomGroup, room.stairLocationX, room.stairLocationY, roomHeight, 'down');
        }
        
        roomGroups.push(roomGroup);
      });

      // Step 4: Render hallway network
      const hallwayGroup = HallwayRenderer.renderHallwayNetwork(scene, hallwayNetwork, {
        cubeSize,
        hallwayHeight,
        wallColor: hallwayWallColor,
        floorColor: hallwayFloorColor
      });

      console.log(`Server floor generation finished for: ${dungeonDagNodeName}`);
      console.log(`Generated ${floorLayout.rooms.length} rooms and ${hallwayNetwork.segments.length} hallway segments`);

      return {
        floorLayout,
        hallwayNetwork,
        roomGroups,
        hallwayGroup
      };
    } catch (error) {
      console.error('Error generating server floor:', error);
      throw error;
    }
  }

  /**
   * Converts a server room to a shape format compatible with RoomRenderer
   */
  private static convertServerRoomToShape(room: any) {
    const halfWidth = room.width / 2;
    const halfHeight = room.height / 2;

    // Create rectangular vertices (centered at origin)
    const vertices = [
      new THREE.Vector2(-halfWidth, -halfHeight), // Bottom-left
      new THREE.Vector2(halfWidth, -halfHeight),  // Bottom-right
      new THREE.Vector2(halfWidth, halfHeight),   // Top-right
      new THREE.Vector2(-halfWidth, halfHeight)   // Top-left
    ];

    // Create edges
    const edges = [
      { start: vertices[0], end: vertices[1], length: room.width },   // Bottom
      { start: vertices[1], end: vertices[2], length: room.height },  // Right
      { start: vertices[2], end: vertices[3], length: room.width },   // Top
      { start: vertices[3], end: vertices[0], length: room.height }   // Left
    ];

    // Generate doors based on server data
    const doors = [];
    
    if (room.parentDoorOffset && room.doorSide) {
      let edgeIndex = 0;
      let position = 0.5;
      
      // Determine edge index based on door side
      switch (room.doorSide) {
        case "bottom":
          edgeIndex = 0;
          position = room.parentDoorOffset / room.width;
          break;
        case "right":
          edgeIndex = 1;
          position = room.parentDoorOffset / room.height;
          break;
        case "top":
          edgeIndex = 2;
          position = 1 - (room.parentDoorOffset / room.width);
          break;
        case "left":
          edgeIndex = 3;
          position = 1 - (room.parentDoorOffset / room.height);
          break;
      }
      
      // Ensure position is within valid range
      position = Math.max(0.1, Math.min(0.9, position));
      
      doors.push({
        edgeIndex,
        position,
        width: 2
      });
    } else {
      // Fallback: place door on bottom edge at center
      doors.push({
        edgeIndex: 0,
        position: 0.5,
        width: 2
      });
    }

    return {
      vertices,
      edges,
      doors,
      shapeType: 'rectangle' as const,
      width: room.width,
      height: room.height
    };
  }

  /**
   * Adds a staircase to a room
   */
  private static addStaircase(
    roomGroup: THREE.Group,
    x: number,
    y: number,
    roomHeight: number,
    direction: 'up' | 'down'
  ): void {
    // Create a simple staircase representation
    const stairGeometry = new THREE.BoxGeometry(2, roomHeight * 0.8, 2);
    const stairMaterial = new THREE.MeshLambertMaterial({ 
      color: direction === 'up' ? 0x00ff00 : 0xff0000 // Green for up, red for down
    });
    const staircase = new THREE.Mesh(stairGeometry, stairMaterial);
    
    staircase.position.set(x, roomHeight * 0.4, y);
    staircase.castShadow = true;
    staircase.receiveShadow = true;
    
    roomGroup.add(staircase);
    
    // Add a label for debugging
    console.log(`Added ${direction} staircase at (${x}, ${y})`);
  }

  /**
   * Clear all scenery from the scene while preserving important objects
   */
  static clearScene(scene: THREE.Scene): void {
    const objectsToRemove: THREE.Object3D[] = [];
    
    scene.traverse((child) => {
      // Preserve essential objects: scene, cameras, lights, and player models
      if (child !== scene && 
          child.type !== 'Camera' && 
          child.type !== 'Light' &&
          child.type !== 'AmbientLight' &&
          child.type !== 'DirectionalLight' &&
          child.type !== 'PointLight' &&
          child.type !== 'HemisphereLight' &&
          !child.userData.isPlayer) { // Preserve objects marked as players
        objectsToRemove.push(child);
      }
    });
    
    console.log(`🧹 Clearing ${objectsToRemove.length} scenery objects while preserving players and lighting`);
    
    objectsToRemove.forEach((obj) => {
      scene.remove(obj);
      // Dispose of geometries and materials to prevent memory leaks
      if ('geometry' in obj) {
        (obj as any).geometry?.dispose();
      }
      if ('material' in obj) {
        const material = (obj as any).material;
        if (Array.isArray(material)) {
          material.forEach((mat) => mat?.dispose());
        } else {
          material?.dispose();
        }
      }
    });
  }

  /**
   * Get the spawn location for new players
   */
  static async getSpawnLocation(serverAddress: string): Promise<string> {
    console.log(`🎯 ServerSceneryGenerator: Getting spawn location from ${serverAddress}`);
    return await ServerFloorGenerator.getSpawnLocation(serverAddress);
  }

  /**
   * Notify server that player moved to a new floor
   */
  static async notifyPlayerMovedFloor(serverAddress: string, newFloorName: string): Promise<void> {
    return await ServerFloorGenerator.notifyPlayerMovedFloor(serverAddress, newFloorName);
  }
}
