import * as THREE from 'three';
import { RoomShape, Door } from '../types';

export interface RoomRenderOptions {
  cubeSize?: number;
  roomHeight?: number;
  wallColor?: number;
  floorColor?: number;
  position?: THREE.Vector3;
}

export class RoomRenderer {
  /**
   * Renders a room with walls and floor, leaving gaps for doors
   */
  static renderRoom(
    scene: THREE.Scene,
    roomShape: RoomShape,
    options: RoomRenderOptions = {}
  ): THREE.Group {
    const {
      cubeSize = 1,
      roomHeight = 5,
      wallColor = 0xcccccc,
      floorColor = 0x666666,
      position = new THREE.Vector3(0, 0, 0)
    } = options;

    // Create materials
    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const wallMaterial = new THREE.MeshLambertMaterial({ color: wallColor });
    const floorMaterial = new THREE.MeshLambertMaterial({ color: floorColor });

    // Create room group
    const roomGroup = new THREE.Group();
    roomGroup.name = 'Room';
    roomGroup.position.copy(position);

    // Render walls with door gaps
    const wallsGroup = this.renderWalls(roomShape, cubeGeometry, wallMaterial, cubeSize, roomHeight);
    roomGroup.add(wallsGroup);

    // Render floor
    const floor = this.renderFloor(roomShape, floorMaterial, cubeSize);
    roomGroup.add(floor);

    scene.add(roomGroup);
    return roomGroup;
  }

  /**
   * Renders walls with gaps for doors
   */
  private static renderWalls(
    roomShape: RoomShape,
    cubeGeometry: THREE.BoxGeometry,
    wallMaterial: THREE.MeshLambertMaterial,
    cubeSize: number,
    roomHeight: number
  ): THREE.Group {
    const wallsGroup = new THREE.Group();
    wallsGroup.name = 'Walls';

    // Build walls along each edge of the polygon
    for (let edgeIndex = 0; edgeIndex < roomShape.edges.length; edgeIndex++) {
      const edge = roomShape.edges[edgeIndex];
      
      // Find doors on this edge
      const doorsOnEdge = roomShape.doors.filter(door => door.edgeIndex === edgeIndex);
      
      // Calculate wall direction and length
      const wallDirection = new THREE.Vector2(
        edge.end.x - edge.start.x,
        edge.end.y - edge.start.y
      );
      const wallLength = wallDirection.length();
      wallDirection.normalize();
      
      // Calculate number of cubes needed for this wall
      const numCubes = Math.ceil(wallLength / cubeSize);
      
      // Create segments avoiding door positions
      const segments = this.calculateWallSegments(edge, doorsOnEdge, cubeSize, numCubes);
      
      // Place cubes for each segment
      segments.forEach(segment => {
        for (let cubeIndex = segment.startCube; cubeIndex <= segment.endCube; cubeIndex++) {
          for (let y = 0; y < roomHeight; y++) {
            const cube = new THREE.Mesh(cubeGeometry, wallMaterial);
            
            // Calculate position along the wall
            const t = (cubeIndex + 0.5) / numCubes;
            const cubeX = edge.start.x + wallDirection.x * wallLength * t;
            const cubeZ = edge.start.y + wallDirection.y * wallLength * t;
            
            cube.position.set(
              cubeX,
              (y * cubeSize) + (cubeSize / 2),
              cubeZ
            );
            cube.name = `Wall_${edgeIndex}_${cubeIndex}_${y}`;
            wallsGroup.add(cube);
          }
        }
      });
    }

    return wallsGroup;
  }

  /**
   * Calculates wall segments that avoid door positions
   */
  private static calculateWallSegments(
    edge: { start: THREE.Vector2; end: THREE.Vector2; length: number },
    doors: Door[],
    cubeSize: number,
    numCubes: number
  ): { startCube: number; endCube: number }[] {
    if (doors.length === 0) {
      return [{ startCube: 0, endCube: numCubes - 1 }];
    }

    const segments: { startCube: number; endCube: number }[] = [];
    
    // Sort doors by position along edge
    const sortedDoors = doors.sort((a, b) => a.position - b.position);
    
    let currentCube = 0;
    
    for (const door of sortedDoors) {
      // Calculate door world position
      const doorWorldPos = new THREE.Vector2(
        edge.start.x + (edge.end.x - edge.start.x) * door.position,
        edge.start.y + (edge.end.y - edge.start.y) * door.position
      );
      
      // Calculate door start and end in cube indices
      const doorStartT = (door.position - (door.width / 2) / edge.length);
      const doorEndT = (door.position + (door.width / 2) / edge.length);
      
      const doorStartCube = Math.floor(doorStartT * numCubes);
      const doorEndCube = Math.ceil(doorEndT * numCubes);
      
      // Add segment before door
      if (currentCube < doorStartCube) {
        segments.push({ startCube: currentCube, endCube: doorStartCube - 1 });
      }
      
      // Skip past door
      currentCube = Math.max(currentCube, doorEndCube);
    }
    
    // Add final segment after last door
    if (currentCube < numCubes) {
      segments.push({ startCube: currentCube, endCube: numCubes - 1 });
    }
    
    return segments.filter(segment => segment.startCube <= segment.endCube);
  }

  /**
   * Renders the floor for a room
   */
  private static renderFloor(
    roomShape: RoomShape,
    floorMaterial: THREE.MeshLambertMaterial,
    cubeSize: number
  ): THREE.Mesh {
    // For rectangular rooms, create a simple plane geometry
    // Since we know it's rectangular, we can use the width and height directly
    const width = roomShape.width + cubeSize; // Add cube size for extension to cover wall thickness
    const height = roomShape.height + cubeSize;
    
    // Create a plane geometry that lies in the XZ plane (horizontal)
    const floorGeometry = new THREE.PlaneGeometry(width, height);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    
    // Rotate the floor to be horizontal (XZ plane instead of XY plane)
    floor.rotation.x = -Math.PI / 2;
    
    // Position the floor at the base of the walls
    floor.position.y = 0; // At ground level where wall cubes start
    floor.name = 'Floor';
    
    return floor;
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
  }
}
