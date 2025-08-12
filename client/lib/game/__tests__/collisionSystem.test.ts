import * as THREE from 'three';
import { CollisionSystem } from '../core/collisionSystem';
import { CubeFloorRenderer } from '../rendering/cubeFloorRenderer';

describe('CollisionSystem', () => {
  let collisionSystem: CollisionSystem;
  let scene: THREE.Scene;

  beforeEach(() => {
    collisionSystem = CollisionSystem.getInstance();
    scene = new THREE.Scene();
    
    // Clear any existing collision data
    collisionSystem.clear();
  });

  afterEach(() => {
    collisionSystem.clear();
  });

  describe('Floor collision detection', () => {
    test('should detect floor height correctly', () => {
      // Register a floor cube at position (0, 0)
      CubeFloorRenderer.clearRegistry();
      CubeFloorRenderer.registerCubes([{ x: 0, y: 0 }], 0x0000ff, 'room');
      
      // Update collision data
      collisionSystem.updateCollisionData(scene);
      
      // Test floor height at cube position
      const position = new THREE.Vector3(0, 0, 0);
      const floorHeight = collisionSystem.getFloorHeight(position);
      
      expect(floorHeight).toBe(5); // CubeConfig.CUBE_SIZE
    });

    test('should return ground level when no floor cube exists', () => {
      // Clear all floor data
      CubeFloorRenderer.clearRegistry();
      collisionSystem.updateCollisionData(scene);
      
      // Test floor height at empty position
      const position = new THREE.Vector3(10, 0, 10);
      const floorHeight = collisionSystem.getFloorHeight(position);
      
      expect(floorHeight).toBe(0); // Ground level
    });
  });

  describe('isOnGround detection', () => {
    test('should detect when player is on ground', () => {
      // Register a floor cube
      CubeFloorRenderer.clearRegistry();
      CubeFloorRenderer.registerCubes([{ x: 0, y: 0 }], 0x0000ff, 'room');
      collisionSystem.updateCollisionData(scene);
      
      // Player standing on floor
      const playerPosition = new THREE.Vector3(0, 5, 0); // At floor height
      const isOnGround = collisionSystem.isOnGround(playerPosition);
      
      expect(isOnGround).toBe(true);
    });

    test('should detect when player is not on ground', () => {
      // Register a floor cube
      CubeFloorRenderer.clearRegistry();
      CubeFloorRenderer.registerCubes([{ x: 0, y: 0 }], 0x0000ff, 'room');
      collisionSystem.updateCollisionData(scene);
      
      // Player floating above floor
      const playerPosition = new THREE.Vector3(0, 10, 0); // Above floor height
      const isOnGround = collisionSystem.isOnGround(playerPosition);
      
      expect(isOnGround).toBe(false);
    });
  });

  describe('Wall collision detection', () => {
    test('should detect collision with walls', () => {
      // Create a mock wall mesh
      const wallGeometry = new THREE.BoxGeometry(5, 25, 5);
      const wallMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
      const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
      
      // Position wall at grid position (1, 0)
      wallMesh.position.set(5, 12.5, 0);
      wallMesh.userData.isWall = true;
      wallMesh.userData.wallCoord = { x: 1, y: 0 };
      wallMesh.userData.isCollidable = true;
      
      scene.add(wallMesh);
      collisionSystem.updateCollisionData(scene);
      
      // Test collision when player tries to move into wall
      const playerPosition = new THREE.Vector3(3, 5, 0); // Near wall
      const collisionResult = collisionSystem.checkWallCollision(playerPosition);
      
      expect(collisionResult.collided).toBe(true);
      expect(collisionResult.collisionDirection).toBe('x');
    });

    test('should not detect collision when player is away from walls', () => {
      // Create a mock wall mesh
      const wallGeometry = new THREE.BoxGeometry(5, 25, 5);
      const wallMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
      const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
      
      wallMesh.position.set(20, 12.5, 20); // Far away
      wallMesh.userData.isWall = true;
      wallMesh.userData.wallCoord = { x: 4, y: 4 };
      wallMesh.userData.isCollidable = true;
      
      scene.add(wallMesh);
      collisionSystem.updateCollisionData(scene);
      
      // Test no collision when player is far from wall
      const playerPosition = new THREE.Vector3(0, 5, 0);
      const collisionResult = collisionSystem.checkWallCollision(playerPosition);
      
      expect(collisionResult.collided).toBe(false);
      expect(collisionResult.collisionDirection).toBe('none');
    });
  });

  describe('Comprehensive collision check', () => {
    test('should handle multiple collision types', () => {
      // Set up a complex scene with floors, walls, and ceiling
      CubeFloorRenderer.clearRegistry();
      CubeFloorRenderer.registerCubes([{ x: 0, y: 0 }], 0x0000ff, 'room');
      
      // Add wall
      const wallMesh = new THREE.Mesh(
        new THREE.BoxGeometry(5, 25, 5),
        new THREE.MeshBasicMaterial({ color: 0x666666 })
      );
      wallMesh.position.set(5, 12.5, 0);
      wallMesh.userData.isWall = true;
      wallMesh.userData.wallCoord = { x: 1, y: 0 };
      scene.add(wallMesh);
      
      collisionSystem.updateCollisionData(scene);
      
      // Test position that would collide with wall
      const collisionPosition = new THREE.Vector3(3, 5, 0);
      const result = collisionSystem.checkCollision(collisionPosition);
      
      expect(result.collided).toBe(true);
    });
  });
});
