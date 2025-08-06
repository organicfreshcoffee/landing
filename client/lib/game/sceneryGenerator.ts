import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { ModelLoader } from './modelLoader';
import { FloorGenerator } from './floorGenerator';
import { RoomShapeGenerator } from './roomShapeGenerator';
import { HallwayGenerator } from './hallwayGenerator';
import { RoomRenderer } from './roomRenderer';
import { HallwayRenderer } from './hallwayRenderer';

export class SceneryGenerator {
  /**
   * Generates a complete floor layout with rooms and hallways
   * @param scene - The Three.js scene to add the floor to
   * @param options - Configuration options for generation
   */
  static generateCompleteFloor(
    scene: THREE.Scene,
    options: {
      minRooms?: number;
      maxRooms?: number;
      floorWidth?: number;
      floorHeight?: number;
      cubeSize?: number;
      roomHeight?: number;
      hallwayHeight?: number;
      wallColor?: number;
      floorColor?: number;
      hallwayWallColor?: number;
      hallwayFloorColor?: number;
    } = {}
  ): { 
    floorLayout: any; 
    roomShapes: Map<string, any>; 
    hallwayNetwork: any; 
    roomGroups: THREE.Group[];
    hallwayGroup: THREE.Group;
  } {
    const {
      minRooms = 3,
      maxRooms = 6,
      floorWidth = 80,
      floorHeight = 80,
      cubeSize = 1,
      roomHeight = 5,
      hallwayHeight = 5,
      wallColor = 0xcccccc,
      floorColor = 0x666666,
      hallwayWallColor = 0x888888,
      hallwayFloorColor = 0x444444
    } = options;

    console.log('Starting complete floor generation...');

    // Step 1: Generate floor layout with room positions
    const floorLayout = FloorGenerator.generateConnectedLayout(
      minRooms, maxRooms, floorWidth, floorHeight
    );

    // Step 2: Generate shapes for each room
    const roomShapes = new Map();
    floorLayout.rooms.forEach((room: any) => {
      const shape = RoomShapeGenerator.generateRoomShape(
        room.size.minWidth,
        room.size.maxWidth,
        room.size.minHeight,
        room.size.maxHeight,
        room.doorRange.min,
        room.doorRange.max
      );
      roomShapes.set(room.id, shape);
    });

    // Step 3: Generate hallway network connecting rooms
    const hallwayNetwork = HallwayGenerator.generateHallwayNetwork(
      floorLayout,
      roomShapes,
      3, // hallway width
      50, // max hallway length
      0.15 // dead end probability
    );

    // Step 4: Render all rooms
    const roomGroups: THREE.Group[] = [];
    floorLayout.rooms.forEach((room: any) => {
      const shape = roomShapes.get(room.id);
      if (shape) {
        const roomGroup = RoomRenderer.renderRoom(scene, shape, {
          cubeSize,
          roomHeight,
          wallColor,
          floorColor,
          position: new THREE.Vector3(room.position.x, 0, room.position.y)
        });
        roomGroups.push(roomGroup);
      }
    });

    // Step 5: Render hallway network
    const hallwayGroup = HallwayRenderer.renderHallwayNetwork(scene, hallwayNetwork, {
      cubeSize,
      hallwayHeight,
      wallColor: hallwayWallColor,
      floorColor: hallwayFloorColor
    });

    console.log('Complete floor generation finished');

    return {
      floorLayout,
      roomShapes,
      hallwayNetwork,
      roomGroups,
      hallwayGroup
    };
  }

  /**
   * Generates a single room (for testing purposes)
   */
  static generateSingleRoom(
    scene: THREE.Scene,
    cubeSize: number = 1,
    roomHeight: number = 5,
    minWidth: number = 8,
    maxWidth: number = 15,
    minHeight: number = 8,
    maxHeight: number = 15,
    wallColor: number = 0xcccccc,
    floorColor: number = 0x666666
  ): THREE.Group {
    const shape = RoomShapeGenerator.generateRoomShape(
      minWidth, maxWidth, minHeight, maxHeight, 1, 3
    );
    
    return RoomRenderer.renderRoom(scene, shape, {
      cubeSize,
      roomHeight,
      wallColor,
      floorColor
    });
  }

  /**
   * Clears all generated scenery from the scene
   */
  static clearScenery(scene: THREE.Scene): void {
    RoomRenderer.clearRooms(scene);
    HallwayRenderer.clearHallways(scene);
    
    // Also clear any remaining cube rooms from old system
    const oldRoomsToRemove = scene.children.filter(child => child.name === 'CubeRoom');
    oldRoomsToRemove.forEach(room => {
      scene.remove(room);
      room.traverse((child) => {
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
  }

  static async loadFantasyTownScenery(scene: THREE.Scene): Promise<void> {
    // Existing method for fantasy town assets
  }
}
