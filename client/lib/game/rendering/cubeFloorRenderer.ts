import * as THREE from 'three';

export interface CubeFloorOptions {
  cubeSize?: number;
  floorColor?: number;
  yOffset?: number;
}

/**
 * Utility class for rendering cube-based floors
 */
export class CubeFloorRenderer {
  private static defaultCubeGeometry: THREE.BoxGeometry | null = null;
  private static defaultFloorMaterial: THREE.MeshLambertMaterial | null = null;

  /**
   * Get or create shared geometry for efficiency
   */
  private static getCubeGeometry(cubeSize: number): THREE.BoxGeometry {
    if (!this.defaultCubeGeometry) {
      this.defaultCubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    }
    return this.defaultCubeGeometry;
  }

  /**
   * Get or create shared material for efficiency
   */
  private static getFloorMaterial(color: number): THREE.MeshLambertMaterial {
    if (!this.defaultFloorMaterial) {
      this.defaultFloorMaterial = new THREE.MeshLambertMaterial({ color });
    }
    return this.defaultFloorMaterial;
  }

  /**
   * Renders a single cube floor tile at the specified x, y coordinates
   * @param x - X coordinate (world space)
   * @param y - Y coordinate (corresponds to Z in world space since floor is XZ plane)
   * @param options - Rendering options
   * @returns THREE.Mesh representing the floor cube
   */
  static renderCubeFloor(x: number, y: number, options: CubeFloorOptions = {}): THREE.Mesh {
    const {
      cubeSize = 1,
      floorColor = 0x666666,
      yOffset = 0
    } = options;

    const geometry = this.getCubeGeometry(cubeSize);
    const material = this.getFloorMaterial(floorColor);
    
    const cube = new THREE.Mesh(geometry, material);
    
    // Position the cube in world space
    // x maps to x, y maps to z (since floor is on XZ plane)
    cube.position.set(
      x * cubeSize,
      yOffset + cubeSize / 2, // Cube sits on top of y=0, so center is at cubeSize/2
      y * cubeSize
    );
    
    cube.name = `FloorCube_${x}_${y}`;
    cube.castShadow = true;
    cube.receiveShadow = true;
    
    return cube;
  }

  /**
   * Renders a rectangular area of floor cubes
   * @param startX - Starting X coordinate (inclusive)
   * @param startY - Starting Y coordinate (inclusive) 
   * @param endX - Ending X coordinate (inclusive)
   * @param endY - Ending Y coordinate (inclusive)
   * @param options - Rendering options
   * @returns THREE.Group containing all floor cubes
   */
  static renderCubeFloorArea(
    startX: number, 
    startY: number, 
    endX: number, 
    endY: number, 
    options: CubeFloorOptions = {}
  ): THREE.Group {
    const floorGroup = new THREE.Group();
    floorGroup.name = 'CubeFloorArea';

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const floorCube = this.renderCubeFloor(x, y, options);
        floorGroup.add(floorCube);
      }
    }

    return floorGroup;
  }

  /**
   * Renders floor cubes for a list of specific coordinates
   * @param coordinates - Array of {x, y} coordinate pairs
   * @param options - Rendering options
   * @returns THREE.Group containing all floor cubes
   */
  static renderCubeFloorCoordinates(
    coordinates: Array<{ x: number; y: number }>,
    options: CubeFloorOptions = {}
  ): THREE.Group {
    const floorGroup = new THREE.Group();
    floorGroup.name = 'CubeFloorCoordinates';

    coordinates.forEach(({ x, y }) => {
      const floorCube = this.renderCubeFloor(x, y, options);
      floorGroup.add(floorCube);
    });

    return floorGroup;
  }

  /**
   * Dispose of shared resources (call when done rendering)
   */
  static dispose(): void {
    if (this.defaultCubeGeometry) {
      this.defaultCubeGeometry.dispose();
      this.defaultCubeGeometry = null;
    }
    if (this.defaultFloorMaterial) {
      this.defaultFloorMaterial.dispose();
      this.defaultFloorMaterial = null;
    }
  }
}
