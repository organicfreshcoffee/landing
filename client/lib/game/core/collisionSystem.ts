import * as THREE from 'three';
import { CubeFloorRenderer, CubePosition } from '../rendering/cubeFloorRenderer';
import { CubeConfig } from '../config/cubeConfig';

export interface CollisionBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface CollisionResult {
  collided: boolean;
  correctedPosition: THREE.Vector3;
  collisionDirection: 'x' | 'z' | 'y' | 'none';
}

/**
 * Handles collision detection for players with cubes (floors, walls, ceilings)
 */
export class CollisionSystem {
  private static instance: CollisionSystem;
  private cubeSize: number;
  private wallHeight: number;
  private floorCubes = new Set<string>();
  private wallCubes = new Set<string>();
  private ceilingCubes = new Set<string>();

  // Player collision box dimensions (smaller than cube for better movement)
  private readonly PLAYER_WIDTH = 0.8; // 80% of cube size
  private readonly PLAYER_HEIGHT = 1.8; // Player height
  private readonly PLAYER_DEPTH = 0.8; // 80% of cube size

  private constructor() {
    this.cubeSize = CubeConfig.getCubeSize();
    this.wallHeight = CubeConfig.getWallHeight();
  }

  static getInstance(): CollisionSystem {
    if (!CollisionSystem.instance) {
      CollisionSystem.instance = new CollisionSystem();
    }
    return CollisionSystem.instance;
  }

  /**
   * Update collision data from scene
   */
  updateCollisionData(scene: THREE.Scene): void {
    this.floorCubes.clear();
    this.wallCubes.clear();
    this.ceilingCubes.clear();

    // Get floor coordinates from CubeFloorRenderer
    const floorCoords = CubeFloorRenderer.getAllCoordinates();
    floorCoords.forEach(coord => {
      this.floorCubes.add(`${coord.x},${coord.y}`);
    });

    // Find walls and ceilings in the scene
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.userData.isWall && child.userData.wallCoord) {
          const coord = child.userData.wallCoord;
          this.wallCubes.add(`${coord.x},${coord.y}`);
        }
        
        if (child.userData.isCeiling && child.userData.ceilingCoord) {
          const coord = child.userData.ceilingCoord;
          this.ceilingCubes.add(`${coord.x},${coord.y}`);
        }
      }
    });

    console.log(`🔄 Updated collision data: ${this.floorCubes.size} floors, ${this.wallCubes.size} walls, ${this.ceilingCubes.size} ceilings`);
  }

  /**
   * Get player collision box at a given position
   */
  private getPlayerCollisionBox(position: THREE.Vector3): CollisionBox {
    const halfWidth = (this.PLAYER_WIDTH * this.cubeSize) / 2;
    const halfDepth = (this.PLAYER_DEPTH * this.cubeSize) / 2;
    const height = this.PLAYER_HEIGHT * this.cubeSize;

    return {
      min: new THREE.Vector3(
        position.x - halfWidth,
        position.y,
        position.z - halfDepth
      ),
      max: new THREE.Vector3(
        position.x + halfWidth,
        position.y + height,
        position.z + halfDepth
      )
    };
  }

  /**
   * Get cube collision box at grid coordinates
   */
  private getCubeCollisionBox(gridX: number, gridY: number, yPosition: number, isWall = false): CollisionBox {
    const worldX = gridX * this.cubeSize;
    const worldZ = gridY * this.cubeSize;
    const halfSize = this.cubeSize / 2;
    
    const height = isWall ? this.wallHeight : this.cubeSize;

    return {
      min: new THREE.Vector3(
        worldX - halfSize,
        yPosition,
        worldZ - halfSize
      ),
      max: new THREE.Vector3(
        worldX + halfSize,
        yPosition + height,
        worldZ + halfSize
      )
    };
  }

  /**
   * Check if two collision boxes intersect
   */
  private boxesIntersect(box1: CollisionBox, box2: CollisionBox): boolean {
    return !(
      box1.max.x <= box2.min.x || box1.min.x >= box2.max.x ||
      box1.max.y <= box2.min.y || box1.min.y >= box2.max.y ||
      box1.max.z <= box2.min.z || box1.min.z >= box2.max.z
    );
  }

  /**
   * Get cube coordinates from world position
   */
  private worldToCubeCoords(worldPosition: THREE.Vector3): { x: number; y: number } {
    return {
      x: Math.round(worldPosition.x / this.cubeSize),
      y: Math.round(worldPosition.z / this.cubeSize)
    };
  }

  /**
   * Check collision with walls at a position
   */
  checkWallCollision(position: THREE.Vector3): CollisionResult {
    const playerBox = this.getPlayerCollisionBox(position);
    const cubeCoords = this.worldToCubeCoords(position);
    
    // Check surrounding wall cubes in a 3x3 grid
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const checkX = cubeCoords.x + dx;
        const checkY = cubeCoords.y + dy;
        const key = `${checkX},${checkY}`;
        
        if (this.wallCubes.has(key)) {
          const wallBox = this.getCubeCollisionBox(checkX, checkY, 0, true);
          
          if (this.boxesIntersect(playerBox, wallBox)) {
            // Calculate corrected position by moving player away from wall
            const correctedPosition = position.clone();
            
            // Determine collision direction and push back
            const playerCenterX = position.x;
            const playerCenterZ = position.z;
            const wallCenterX = checkX * this.cubeSize;
            const wallCenterZ = checkY * this.cubeSize;
            
            const deltaX = playerCenterX - wallCenterX;
            const deltaZ = playerCenterZ - wallCenterZ;
            
            // Push back in the direction with larger overlap
            if (Math.abs(deltaX) > Math.abs(deltaZ)) {
              // Horizontal collision
              const direction = deltaX > 0 ? 1 : -1;
              correctedPosition.x = wallCenterX + direction * (this.cubeSize / 2 + (this.PLAYER_WIDTH * this.cubeSize) / 2);
              return {
                collided: true,
                correctedPosition,
                collisionDirection: 'x'
              };
            } else {
              // Vertical collision
              const direction = deltaZ > 0 ? 1 : -1;
              correctedPosition.z = wallCenterZ + direction * (this.cubeSize / 2 + (this.PLAYER_DEPTH * this.cubeSize) / 2);
              return {
                collided: true,
                correctedPosition,
                collisionDirection: 'z'
              };
            }
          }
        }
      }
    }
    
    return {
      collided: false,
      correctedPosition: position.clone(),
      collisionDirection: 'none'
    };
  }

  /**
   * Check collision with ceiling at a position
   */
  checkCeilingCollision(position: THREE.Vector3): CollisionResult {
    const playerBox = this.getPlayerCollisionBox(position);
    const cubeCoords = this.worldToCubeCoords(position);
    
    // Check if there's a ceiling cube above us
    const key = `${cubeCoords.x},${cubeCoords.y}`;
    if (this.ceilingCubes.has(key)) {
      const ceilingBox = this.getCubeCollisionBox(cubeCoords.x, cubeCoords.y, this.wallHeight);
      
      if (this.boxesIntersect(playerBox, ceilingBox)) {
        const correctedPosition = position.clone();
        correctedPosition.y = this.wallHeight - this.PLAYER_HEIGHT * this.cubeSize;
        
        return {
          collided: true,
          correctedPosition,
          collisionDirection: 'y'
        };
      }
    }
    
    return {
      collided: false,
      correctedPosition: position.clone(),
      collisionDirection: 'none'
    };
  }

  /**
   * Get floor height at a position
   */
  getFloorHeight(position: THREE.Vector3): number {
    const cubeCoords = this.worldToCubeCoords(position);
    const key = `${cubeCoords.x},${cubeCoords.y}`;
    
    // If there's a floor cube at this position, return floor height
    if (this.floorCubes.has(key)) {
      return this.cubeSize; // Floor cubes are positioned with their top at cubeSize height
    }
    
    // No floor, return ground level
    return 0;
  }

  /**
   * Check if player is standing on solid ground
   */
  isOnGround(position: THREE.Vector3): boolean {
    const floorHeight = this.getFloorHeight(position);
    const playerBottomY = position.y;
    
    // Consider player on ground if they're within a small tolerance of floor height
    return Math.abs(playerBottomY - floorHeight) < 0.1;
  }

  /**
   * Comprehensive collision check for a new position
   */
  checkCollision(newPosition: THREE.Vector3): CollisionResult {
    // Check wall collisions
    const wallResult = this.checkWallCollision(newPosition);
    if (wallResult.collided) {
      return wallResult;
    }

    // Check ceiling collisions
    const ceilingResult = this.checkCeilingCollision(newPosition);
    if (ceilingResult.collided) {
      return ceilingResult;
    }

    return {
      collided: false,
      correctedPosition: newPosition.clone(),
      collisionDirection: 'none'
    };
  }

  /**
   * Clear all collision data
   */
  clear(): void {
    this.floorCubes.clear();
    this.wallCubes.clear();
    this.ceilingCubes.clear();
  }
}
