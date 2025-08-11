import * as THREE from 'three';
import { RoomShape, Door } from '../types';
import { CubeFloorRenderer } from './cubeFloorRenderer';

export interface RoomRenderOptions {
  cubeSize?: number;
  floorColor?: number;
  position?: THREE.Vector3;
}

export class RoomRenderer {
  /**
   * Renders a room using only cube floors (no walls)
   */
  static renderRoom(
    scene: THREE.Scene,
    roomShape: RoomShape,
    options: RoomRenderOptions = {}
  ): THREE.Group {
    const {
      cubeSize = 1,
      floorColor = 0x666666,
      position = new THREE.Vector3(0, 0, 0)
    } = options;

    // Create room group
    const roomGroup = new THREE.Group();
    roomGroup.name = 'Room';
    roomGroup.position.copy(position);

    // Render only cube floors (no walls)
    const floorGroup = this.renderCubeFloor(roomShape, cubeSize, floorColor);
    roomGroup.add(floorGroup);

    scene.add(roomGroup);
    return roomGroup;
  }

  /**
   * Renders cube floor tiles for the room area
   */
  private static renderCubeFloor(
    roomShape: RoomShape,
    cubeSize: number,
    floorColor: number
  ): THREE.Group {
    // For rectangular rooms, we'll render a grid of cube floors
    // Convert room dimensions to cube grid coordinates
    const cubesWidth = Math.floor(roomShape.width / cubeSize);
    const cubesHeight = Math.floor(roomShape.height / cubeSize);
    
    // Calculate starting position to center the room
    const startX = -Math.floor(cubesWidth / 2);
    const startY = -Math.floor(cubesHeight / 2);
    const endX = startX + cubesWidth - 1;
    const endY = startY + cubesHeight - 1;

    // Use the cube floor renderer utility
    const floorGroup = CubeFloorRenderer.renderCubeFloorArea(
      startX, 
      startY, 
      endX, 
      endY,
      {
        cubeSize,
        floorColor,
        yOffset: 0
      }
    );
    
    floorGroup.name = 'RoomFloor';
    return floorGroup;
  }

  /**
   * Alternative method to render room floor from world coordinates
   * Useful when you have specific world positions for the room
   */
  static renderRoomAtWorldPosition(
    scene: THREE.Scene,
    worldX: number,
    worldZ: number,
    width: number,
    height: number,
    options: RoomRenderOptions = {}
  ): THREE.Group {
    const {
      cubeSize = 1,
      floorColor = 0x666666
    } = options;

    // Create room group at world position
    const roomGroup = new THREE.Group();
    roomGroup.name = 'Room';
    roomGroup.position.set(worldX, 0, worldZ);

    // Convert world dimensions to cube grid
    const cubesWidth = Math.floor(width / cubeSize);
    const cubesHeight = Math.floor(height / cubeSize);
    
    // Render floor cubes starting from (0,0) relative to room position
    const floorGroup = CubeFloorRenderer.renderCubeFloorArea(
      0, 
      0, 
      cubesWidth - 1, 
      cubesHeight - 1,
      {
        cubeSize,
        floorColor,
        yOffset: 0
      }
    );
    
    floorGroup.name = 'RoomFloor';
    roomGroup.add(floorGroup);

    scene.add(roomGroup);
    return roomGroup;
  }

  /**
   * Removes all rooms from the scene
   */
  static clearRooms(scene: THREE.Scene): void {
    const roomsToRemove = scene.children.filter(child => child.name === 'Room');
    roomsToRemove.forEach(room => {
      scene.remove(room);
      // Dispose of geometries and materials to free memory
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
    console.log(`Removed ${roomsToRemove.length} room(s) from scene`);
    
    // Clean up shared cube renderer resources
    CubeFloorRenderer.dispose();
  }
}
