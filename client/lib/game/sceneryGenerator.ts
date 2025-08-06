import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { ModelLoader } from './modelLoader';

export class SceneryGenerator {
  /**
   * Generates a rectangular room with walls made of cubes
   * @param scene - The Three.js scene to add the room to
   * @param cubeSize - Size of each cube used for walls (default: 1)
   * @param roomHeight - Fixed height of the room (default: 5)
   * @param minWidth - Minimum width of the room (default: 10)
   * @param maxWidth - Maximum width of the room (default: 20)
   * @param minLength - Minimum length of the room (default: 10)
   * @param maxLength - Maximum length of the room (default: 20)
   * @param wallColor - Color of the wall cubes (default: light gray)
   * @param floorColor - Color of the floor (default: dark gray)
   */
  static generateRoom(
    scene: THREE.Scene,
    cubeSize: number = 1,
    roomHeight: number = 5,
    minWidth: number = 10,
    maxWidth: number = 20,
    minLength: number = 10,
    maxLength: number = 20,
    wallColor: number = 0xcccccc,
    floorColor: number = 0x666666
  ): { width: number; length: number; height: number } {
    // Generate random dimensions
    const roomWidth = Math.floor(Math.random() * (maxWidth - minWidth + 1)) + minWidth;
    const roomLength = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;

    // Create cube geometry and materials
    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const wallMaterial = new THREE.MeshLambertMaterial({ color: wallColor });
    const floorMaterial = new THREE.MeshLambertMaterial({ color: floorColor });

    // Create a group to hold all room elements
    const roomGroup = new THREE.Group();
    roomGroup.name = 'CubeRoom';

    // Generate floor
    const floorWidth = roomWidth * cubeSize;
    const floorLength = roomLength * cubeSize;
    const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorLength);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    floor.position.y = 0; // Position at same level as bottom of wall cubes
    floor.name = 'Floor';
    roomGroup.add(floor);

    // Generate walls made of cubes
    const wallsGroup = new THREE.Group();
    wallsGroup.name = 'Walls';

    // Calculate wall positions
    const halfWidth = (roomWidth * cubeSize) / 2;
    const halfLength = (roomLength * cubeSize) / 2;

    // Front wall (along Z-axis)
    for (let x = 0; x < roomWidth; x++) {
      for (let y = 0; y < roomHeight; y++) {
        const cube = new THREE.Mesh(cubeGeometry, wallMaterial);
        cube.position.set(
          (x * cubeSize) - halfWidth + (cubeSize / 2),
          (y * cubeSize) + (cubeSize / 2),
          halfLength - (cubeSize / 2)
        );
        cube.name = `FrontWall_${x}_${y}`;
        wallsGroup.add(cube);
      }
    }

    // Back wall (along Z-axis)
    for (let x = 0; x < roomWidth; x++) {
      for (let y = 0; y < roomHeight; y++) {
        const cube = new THREE.Mesh(cubeGeometry, wallMaterial);
        cube.position.set(
          (x * cubeSize) - halfWidth + (cubeSize / 2),
          (y * cubeSize) + (cubeSize / 2),
          -halfLength + (cubeSize / 2)
        );
        cube.name = `BackWall_${x}_${y}`;
        wallsGroup.add(cube);
      }
    }

    // Left wall (along X-axis, excluding corners to avoid overlap)
    for (let z = 1; z < roomLength - 1; z++) {
      for (let y = 0; y < roomHeight; y++) {
        const cube = new THREE.Mesh(cubeGeometry, wallMaterial);
        cube.position.set(
          -halfWidth + (cubeSize / 2),
          (y * cubeSize) + (cubeSize / 2),
          (z * cubeSize) - halfLength + (cubeSize / 2)
        );
        cube.name = `LeftWall_${z}_${y}`;
        wallsGroup.add(cube);
      }
    }

    // Right wall (along X-axis, excluding corners to avoid overlap)
    for (let z = 1; z < roomLength - 1; z++) {
      for (let y = 0; y < roomHeight; y++) {
        const cube = new THREE.Mesh(cubeGeometry, wallMaterial);
        cube.position.set(
          halfWidth - (cubeSize / 2),
          (y * cubeSize) + (cubeSize / 2),
          (z * cubeSize) - halfLength + (cubeSize / 2)
        );
        cube.name = `RightWall_${z}_${y}`;
        wallsGroup.add(cube);
      }
    }

    roomGroup.add(wallsGroup);

    // Add the room to the scene
    scene.add(roomGroup);

    console.log(`Generated cube room: ${roomWidth} x ${roomLength} x ${roomHeight} (${roomWidth * roomLength * roomHeight * 2 + roomWidth * roomLength} cubes)`);

    return {
      width: roomWidth * cubeSize,
      length: roomLength * cubeSize,
      height: roomHeight * cubeSize
    };
  }

  /**
   * Removes all cube rooms from the scene
   */
  static clearCubeRooms(scene: THREE.Scene): void {
    const roomsToRemove = scene.children.filter(child => child.name === 'CubeRoom');
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
    console.log(`Removed ${roomsToRemove.length} cube room(s) from scene`);
  }
}
