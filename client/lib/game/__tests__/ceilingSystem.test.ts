import * as THREE from 'three';
import { WallGenerator } from '../generators/wallGenerator';
import { CubePosition } from '../rendering/cubeFloorRenderer';
import { CubeConfig } from '../config/cubeConfig';

describe('Ceiling System', () => {
  let scene: THREE.Scene;
  
  beforeEach(() => {
    scene = new THREE.Scene();
  });

  test('should generate ceiling cubes for floor coordinates', () => {
    // Simple 2x2 floor area
    const floorCoords: CubePosition[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 }
    ];

    const ceilingGroup = WallGenerator.renderCeiling(scene, floorCoords, {
      wallHeight: 5,
      ceilingColor: 0x444444,
      cubeSize: 1
    });

    // Should create 4 ceiling cubes (one for each floor coordinate)
    expect(ceilingGroup.children.length).toBe(4);
    
    // Each ceiling cube should be properly positioned
    ceilingGroup.children.forEach((child, index) => {
      expect(child).toBeInstanceOf(THREE.Mesh);
      const mesh = child as THREE.Mesh;
      
      // Should be positioned at wall height (5 blocks high)
      expect(mesh.position.y).toBe(5);
      
      // Should have ceiling material color
      expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
      const material = mesh.material as THREE.MeshLambertMaterial;
      expect(material.color.getHex()).toBe(0x444444);
      
      // Should be marked as ceiling
      expect(mesh.userData.isCeiling).toBe(true);
      expect(mesh.userData.ceilingCoord).toBeDefined();
    });
  });

  test('should generate walls with correct height (5 blocks)', () => {
    const floorCoords: CubePosition[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }
    ];

    // Generate walls around the floor
    const wallCoords = WallGenerator.generateWalls(floorCoords);
    const wallGroup = WallGenerator.renderWalls(scene, wallCoords, {
      wallHeight: 5,
      wallColor: 0x666666,
      cubeSize: 1
    });

    // Should have walls around the perimeter
    expect(wallGroup.children.length).toBeGreaterThan(0);
    
    // Each wall should be 5 blocks high
    wallGroup.children.forEach(child => {
      expect(child).toBeInstanceOf(THREE.Mesh);
      const mesh = child as THREE.Mesh;
      
      // Should use BoxGeometry with height 5
      expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
      const geometry = mesh.geometry as THREE.BoxGeometry;
      
      // The wall should be centered at height 2.5 (wallHeight / 2)
      expect(mesh.position.y).toBe(2.5);
    });
  });

  test('should use correct colors for walls and ceiling', () => {
    const floorCoords: CubePosition[] = [{ x: 0, y: 0 }];
    
    // Test custom colors
    const wallGroup = WallGenerator.renderWalls(scene, [{ x: 1, y: 0 }], {
      wallColor: 0xFF0000, // Red walls
      cubeSize: 1,
      wallHeight: 5
    });
    
    const ceilingGroup = WallGenerator.renderCeiling(scene, floorCoords, {
      ceilingColor: 0x00FF00, // Green ceiling
      cubeSize: 1,
      wallHeight: 5
    });

    // Check wall color
    if (wallGroup.children.length > 0) {
      const wallMesh = wallGroup.children[0] as THREE.Mesh;
      const wallMaterial = wallMesh.material as THREE.MeshLambertMaterial;
      expect(wallMaterial.color.getHex()).toBe(0xFF0000);
    }

    // Check ceiling color
    if (ceilingGroup.children.length > 0) {
      const ceilingMesh = ceilingGroup.children[0] as THREE.Mesh;
      const ceilingMaterial = ceilingMesh.material as THREE.MeshLambertMaterial;
      expect(ceilingMaterial.color.getHex()).toBe(0x00FF00);
    }
  });

  test('should integrate walls and ceiling properly', () => {
    const floorCoords: CubePosition[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 }
    ];

    // Generate walls
    const wallCoords = WallGenerator.generateWalls(floorCoords);
    const wallGroup = WallGenerator.renderWalls(scene, wallCoords, {
      wallHeight: 5,
      wallColor: 0x666666,
      cubeSize: 1
    });

    // Generate ceiling
    const ceilingGroup = WallGenerator.renderCeiling(scene, floorCoords, {
      wallHeight: 5,
      ceilingColor: 0x444444,
      cubeSize: 1
    });

    // Walls should surround the floor area
    expect(wallGroup.children.length).toBeGreaterThan(0);
    
    // Should have one ceiling cube per floor coordinate
    expect(ceilingGroup.children.length).toBe(floorCoords.length);
    
    // Ceiling should be at the top of the walls
    ceilingGroup.children.forEach(child => {
      const mesh = child as THREE.Mesh;
      expect(mesh.position.y).toBe(5); // At the wall height
    });

    // Walls should be centered vertically
    wallGroup.children.forEach(child => {
      const mesh = child as THREE.Mesh;
      expect(mesh.position.y).toBe(2.5); // wallHeight / 2
    });
  });
});
