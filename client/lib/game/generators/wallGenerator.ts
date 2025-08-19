import * as THREE from 'three';
import { CubePosition, CubeFloorRenderer } from '../rendering/cubeFloorRenderer';
import { CubeConfig } from '../config/cubeConfig';
import { TextureManager } from '../utils/textureManager';

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

    // Create geometry for walls
    const wallGeometry = new THREE.BoxGeometry(opts.cubeSize, opts.wallHeight, opts.cubeSize);

    wallCoords.forEach(coord => {
      // Create a material with wall texture
      const wallMaterial = TextureManager.createMaterialWithTexture('wall');
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
    console.log(`🏗️ Rendered ${wallCoords.length} wall cubes with textures in scene`);
    
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

    // Create geometry for ceiling
    const ceilingGeometry = new THREE.BoxGeometry(opts.cubeSize, opts.cubeSize, opts.cubeSize);

    floorCoords.forEach(coord => {
      // Create a material with ceiling texture
      const ceilingMaterial = TextureManager.createMaterialWithTexture('ceiling');
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
    console.log(`🏠 Rendered ${floorCoords.length} ceiling cubes with textures in scene`);
    
    return ceilingGroup;
  }
}
