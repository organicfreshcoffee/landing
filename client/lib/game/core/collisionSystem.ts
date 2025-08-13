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
    // Add a small epsilon to avoid floating point precision issues
    const epsilon = 0.001;
    
    return !(
      box1.max.x <= box2.min.x + epsilon || box1.min.x >= box2.max.x - epsilon ||
      box1.max.y <= box2.min.y + epsilon || box1.min.y >= box2.max.y - epsilon ||
      box1.max.z <= box2.min.z + epsilon || box1.min.z >= box2.max.z - epsilon
    );
  }

  /**
   * Get cube coordinates from world position
   */
  private worldToCubeCoords(worldPosition: THREE.Vector3): { x: number; y: number } {
    return {
      x: Math.floor(worldPosition.x / this.cubeSize + 0.5),
      y: Math.floor(worldPosition.z / this.cubeSize + 0.5)
    };
  }

  /**
   * Get all potentially colliding cubes around a position
   */
  private getCollisionCandidates(position: THREE.Vector3): { x: number; y: number }[] {
    const playerBox = this.getPlayerCollisionBox(position);
    const candidates: { x: number; y: number }[] = [];
    
    // Calculate the range of cube coordinates that could intersect with player
    const minCubeX = Math.floor((playerBox.min.x) / this.cubeSize);
    const maxCubeX = Math.floor((playerBox.max.x) / this.cubeSize);
    const minCubeY = Math.floor((playerBox.min.z) / this.cubeSize);
    const maxCubeY = Math.floor((playerBox.max.z) / this.cubeSize);
    
    for (let x = minCubeX; x <= maxCubeX; x++) {
      for (let y = minCubeY; y <= maxCubeY; y++) {
        candidates.push({ x, y });
      }
    }
    
    return candidates;
  }

  /**
   * Check collision with walls at a position
   */
  checkWallCollision(position: THREE.Vector3): CollisionResult {
    const playerBox = this.getPlayerCollisionBox(position);
    const candidates = this.getCollisionCandidates(position);
    
    let bestCorrection: CollisionResult | null = null;
    let minPenetration = Infinity;
    
    for (const candidate of candidates) {
      const key = `${candidate.x},${candidate.y}`;
      
      if (this.wallCubes.has(key)) {
        const wallBox = this.getCubeCollisionBox(candidate.x, candidate.y, 0, true);
        
        if (this.boxesIntersect(playerBox, wallBox)) {
          // Calculate penetration depths for both axes
          const overlapX = Math.min(playerBox.max.x - wallBox.min.x, wallBox.max.x - playerBox.min.x);
          const overlapZ = Math.min(playerBox.max.z - wallBox.min.z, wallBox.max.z - playerBox.min.z);
          
          // Choose the axis with minimum overlap (easiest to resolve)
          const minOverlap = Math.min(overlapX, overlapZ);
          
          if (minOverlap < minPenetration) {
            minPenetration = minOverlap;
            
            const correctedPosition = position.clone();
            const wallCenterX = candidate.x * this.cubeSize;
            const wallCenterZ = candidate.y * this.cubeSize;
            
            // Add a larger buffer to prevent edge cases and provide smoother collision
            const buffer = 0.1;
            const halfWallSize = this.cubeSize / 2;
            const halfPlayerWidth = (this.PLAYER_WIDTH * this.cubeSize) / 2;
            const halfPlayerDepth = (this.PLAYER_DEPTH * this.cubeSize) / 2;
            
            if (overlapX < overlapZ) {
              // Resolve X collision - push player away from wall in X direction
              if (position.x < wallCenterX) {
                // Player is to the left of wall, push left
                correctedPosition.x = wallCenterX - halfWallSize - halfPlayerWidth - buffer;
              } else {
                // Player is to the right of wall, push right
                correctedPosition.x = wallCenterX + halfWallSize + halfPlayerWidth + buffer;
              }
              
              bestCorrection = {
                collided: true,
                correctedPosition,
                collisionDirection: 'x'
              };
            } else {
              // Resolve Z collision - push player away from wall in Z direction
              if (position.z < wallCenterZ) {
                // Player is in front of wall, push forward
                correctedPosition.z = wallCenterZ - halfWallSize - halfPlayerDepth - buffer;
              } else {
                // Player is behind wall, push back
                correctedPosition.z = wallCenterZ + halfWallSize + halfPlayerDepth + buffer;
              }
              
              bestCorrection = {
                collided: true,
                correctedPosition,
                collisionDirection: 'z'
              };
            }
          }
        }
      }
    }
    
    return bestCorrection || {
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
   * Get floor height at a position - returns the Y position where the player origin should be placed
   */
  getFloorHeight(position: THREE.Vector3): number {
    const cubeCoords = this.worldToCubeCoords(position);
    const key = `${cubeCoords.x},${cubeCoords.y}`;
    
    // If there's a floor cube at this position, return the cube size (top of the floor cube)
    if (this.floorCubes.has(key)) {
      return this.cubeSize;
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
   * Sweep test collision check - validates movement from one position to another
   * This prevents fast movement from skipping through walls
   */
  sweepTestCollision(fromPosition: THREE.Vector3, toPosition: THREE.Vector3): CollisionResult {
    const direction = toPosition.clone().sub(fromPosition);
    const distance = direction.length();
    
    if (distance < 0.001) {
      return this.checkCollision(toPosition);
    }
    
    direction.normalize();
    
    // Sample points along the movement path more densely for better collision detection
    const stepSize = Math.min(this.cubeSize * 0.2, distance / 10); // Sample every 20% of cube size or 10% of movement
    const sampleCount = Math.max(5, Math.ceil(distance / stepSize));
    
    for (let i = 0; i <= sampleCount; i++) {
      const t = i / sampleCount;
      const samplePosition = fromPosition.clone().lerp(toPosition, t);
      
      const result = this.checkCollision(samplePosition);
      if (result.collided) {
        // If we hit something, try to find a safe position along the path
        // Go back a bit from the collision point to find a safe spot
        if (i > 0) {
          const safeTParam = Math.max(0, (i - 1) / sampleCount);
          const safePosition = fromPosition.clone().lerp(toPosition, safeTParam);
          const safeCheck = this.checkCollision(safePosition);
          
          if (!safeCheck.collided) {
            return {
              collided: true,
              correctedPosition: safePosition,
              collisionDirection: result.collisionDirection
            };
          }
        }
        
        return result;
      }
    }
    
    return {
      collided: false,
      correctedPosition: toPosition.clone(),
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
