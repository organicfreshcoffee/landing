import * as THREE from 'three';
import { CubePosition, CubeFloorRenderer } from '../rendering/cubeFloorRenderer';
import { CubeConfig } from '../config/cubeConfig';

export interface WallGenerationOptions {
  wallHeight?: number;
  wallColor?: number;
  wallMaterial?: THREE.Material;
  cubeSize?: number;
  showCeiling?: boolean;
  ceilingColor?: number;
  ceilingMaterial?: THREE.Material;
}

/**
 * Generates walls around the perimeter of floor coordinates
 */
export class WallGenerator {
  private static readonly DEFAULT_OPTIONS: Required<WallGenerationOptions> = {
    wallHeight: CubeConfig.getWallHeight(),
    wallColor: 0x666666, // Gray walls
    wallMaterial: new THREE.MeshLambertMaterial({ color: 0x666666 }),
    cubeSize: CubeConfig.getCubeSize(),
    showCeiling: true,
    ceilingColor: 0x444444, // Darker gray ceiling
    ceilingMaterial: new THREE.MeshLambertMaterial({ color: 0x444444 })
  };

  /**
   * Generate walls around all floor coordinates
   */
  static generateWalls(
    allFloorCoords: CubePosition[],
    options: WallGenerationOptions = {}
  ): CubePosition[] {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    if (allFloorCoords.length === 0) {
      console.warn('No floor coordinates provided for wall generation');
      return [];
    }

    // Create a set of floor positions for quick lookup
    const floorSet = new Set<string>();
    allFloorCoords.forEach(coord => {
      floorSet.add(`${coord.x},${coord.y}`);
    });

    const wallCoords: CubePosition[] = [];

    // For each floor coordinate, check all 4 adjacent positions
    allFloorCoords.forEach(coord => {
      const adjacentPositions = [
        { x: coord.x + 1, y: coord.y },     // East
        { x: coord.x - 1, y: coord.y },     // West
        { x: coord.x, y: coord.y + 1 },     // North
        { x: coord.x, y: coord.y - 1 }      // South
      ];

      adjacentPositions.forEach(adjPos => {
        const adjKey = `${adjPos.x},${adjPos.y}`;
        
        // If adjacent position doesn't have a floor, place a wall there
        if (!floorSet.has(adjKey)) {
          // Check if we already have a wall at this position
          const wallKey = `${adjPos.x},${adjPos.y}`;
          if (!wallCoords.some(w => w.x === adjPos.x && w.y === adjPos.y)) {
            wallCoords.push({ x: adjPos.x, y: adjPos.y });
          }
        }
      });
    });

    console.log(`🧱 Generated ${wallCoords.length} wall positions around ${allFloorCoords.length} floor tiles`);
    return wallCoords;
  }

  /**
   * Render walls in the scene
   */
  static renderWalls(
    scene: THREE.Scene,
    wallCoords: CubePosition[],
    options: WallGenerationOptions = {}
  ): THREE.Group {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    const wallGroup = new THREE.Group();
    wallGroup.name = 'Walls';

    // Create geometry and material for walls
    const wallGeometry = new THREE.BoxGeometry(opts.cubeSize, opts.wallHeight, opts.cubeSize);
    const wallMaterial = opts.wallMaterial || new THREE.MeshLambertMaterial({ color: opts.wallColor });

    wallCoords.forEach(coord => {
      const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
      
      // Position the wall
      wallMesh.position.set(
        coord.x * opts.cubeSize,
        opts.wallHeight / 2, // Center the wall vertically
        coord.y * opts.cubeSize
      );

      // Mark as wall for identification and collision
      wallMesh.userData.isWall = true;
      wallMesh.userData.wallCoord = coord;
      wallMesh.userData.isCollidable = true;
      
      wallGroup.add(wallMesh);
    });

    scene.add(wallGroup);
    console.log(`🏗️ Rendered ${wallCoords.length} wall cubes in scene`);
    
    return wallGroup;
  }

  /**
   * Render ceiling over floor coordinates
   */
  static renderCeiling(
    scene: THREE.Scene,
    floorCoords: CubePosition[],
    options: WallGenerationOptions = {}
  ): THREE.Group {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    const ceilingGroup = new THREE.Group();
    ceilingGroup.name = 'Ceiling';

    // Create geometry and material for ceiling
    const ceilingGeometry = new THREE.BoxGeometry(opts.cubeSize, opts.cubeSize, opts.cubeSize);
    const ceilingMaterial = opts.ceilingMaterial || new THREE.MeshLambertMaterial({ color: opts.ceilingColor });

    floorCoords.forEach(coord => {
      const ceilingMesh = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
      
      // Position the ceiling at the top of the walls
      ceilingMesh.position.set(
        coord.x * opts.cubeSize,
        opts.wallHeight, // Place at top of walls
        coord.y * opts.cubeSize
      );

      // Mark as ceiling for identification and collision
      ceilingMesh.userData.isCeiling = true;
      ceilingMesh.userData.ceilingCoord = coord;
      ceilingMesh.userData.isCollidable = true;
      
      ceilingGroup.add(ceilingMesh);
    });

    scene.add(ceilingGroup);
    console.log(`🏠 Rendered ${floorCoords.length} ceiling cubes in scene`);
    
    return ceilingGroup;
  }

    /**
   * Generate and render walls and ceiling in one call
   */
  static generateAndRenderWalls(
    scene: THREE.Scene,
    cubeFloorRenderer: CubeFloorRenderer,
    options: WallGenerationOptions = {}
  ): { 
    wallGroup: THREE.Group; 
    ceilingGroup?: THREE.Group;
    wallCount: number; 
    ceilingCount: number;
  } {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    // Get floor coordinates from the renderer
    const floorCoords = CubeFloorRenderer.getAllCoordinates();
    
    // Generate wall coordinates
    const wallCoords = this.generateWalls(floorCoords);
    
    // Render walls
    const wallGroup = this.renderWalls(scene, wallCoords, opts);
    
    // Optionally render ceiling
    let ceilingGroup: THREE.Group | undefined;
    let ceilingCount = 0;
    
    if (opts.showCeiling) {
      ceilingGroup = this.renderCeiling(scene, floorCoords, opts);
      ceilingCount = floorCoords.length;
    }
    
    return { 
      wallGroup, 
      ceilingGroup,
      wallCount: wallCoords.length,
      ceilingCount
    };
  }

  /**
   * Get wall bounds for the generated walls
   */
  static calculateWallBounds(wallCoords: CubePosition[]): { 
    minX: number; 
    maxX: number; 
    minY: number; 
    maxY: number; 
    width: number; 
    height: number; 
  } {
    if (wallCoords.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = wallCoords[0].x;
    let maxX = wallCoords[0].x;
    let minY = wallCoords[0].y;
    let maxY = wallCoords[0].y;

    wallCoords.forEach(coord => {
      minX = Math.min(minX, coord.x);
      maxX = Math.max(maxX, coord.x);
      minY = Math.min(minY, coord.y);
      maxY = Math.max(maxY, coord.y);
    });

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  /**
   * Create a more advanced wall system with corner detection
   */
  static generateWallsWithCorners(
    allFloorCoords: CubePosition[],
    options: WallGenerationOptions = {}
  ): {
    straightWalls: CubePosition[];
    cornerWalls: CubePosition[];
    allWalls: CubePosition[];
  } {
    const wallCoords = this.generateWalls(allFloorCoords, options);
    
    // Create a set for quick wall lookup
    const wallSet = new Set<string>();
    wallCoords.forEach(coord => {
      wallSet.add(`${coord.x},${coord.y}`);
    });

    const straightWalls: CubePosition[] = [];
    const cornerWalls: CubePosition[] = [];

    wallCoords.forEach(coord => {
      // Check if this wall position has wall neighbors
      const neighbors = [
        { x: coord.x + 1, y: coord.y },     // East
        { x: coord.x - 1, y: coord.y },     // West
        { x: coord.x, y: coord.y + 1 },     // North
        { x: coord.x, y: coord.y - 1 }      // South
      ];

      const wallNeighborCount = neighbors.filter(neighbor => 
        wallSet.has(`${neighbor.x},${neighbor.y}`)
      ).length;

      // If it has 2+ wall neighbors, it's likely a corner or intersection
      if (wallNeighborCount >= 2) {
        cornerWalls.push(coord);
      } else {
        straightWalls.push(coord);
      }
    });

    console.log(`🧱 Wall analysis: ${straightWalls.length} straight walls, ${cornerWalls.length} corner walls`);

    return {
      straightWalls,
      cornerWalls,
      allWalls: wallCoords
    };
  }
}
