import * as THREE from 'three';
import { TextureManager } from './textureManager';

/**
 * Test utility for verifying texture loading and application
 */
export class TextureTest {
  /**
   * Create a test scene with cubes of each texture type
   */
  static createTextureTestScene(scene: THREE.Scene): THREE.Group {
    const testGroup = new THREE.Group();
    testGroup.name = 'TextureTest';

    const cubeSize = 2;
    const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);

    // Test positions for each cube type
    const testPositions = [
      { type: 'ceiling' as const, position: new THREE.Vector3(-6, 3, 0), label: 'Ceiling' },
      { type: 'wall' as const, position: new THREE.Vector3(-2, 3, 0), label: 'Wall' },
      { type: 'hallway-floor' as const, position: new THREE.Vector3(2, 3, 0), label: 'Hallway Floor' },
      { type: 'room-floor' as const, position: new THREE.Vector3(6, 3, 0), label: 'Room Floor' }
    ];

    testPositions.forEach(({ type, position, label }) => {
      try {
        // Create cube with texture
        const material = TextureManager.createMaterialWithTexture(type);
        const cube = new THREE.Mesh(geometry, material);
        
        cube.position.copy(position);
        cube.name = `TestCube_${type}`;
        cube.castShadow = true;
        cube.receiveShadow = true;

        testGroup.add(cube);

        // Add text label above cube
        this.addTextLabel(testGroup, label, position.x, position.y + 1.5, position.z);

              } catch (error) {
        console.error(`❌ Failed to create test cube for ${type}:`, error);
      }
    });

    scene.add(testGroup);
        
    return testGroup;
  }

  /**
   * Add a simple text label using Three.js sprites
   */
  private static addTextLabel(parent: THREE.Group, text: string, x: number, y: number, z: number): void {
    // Create canvas for text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    // Draw text on canvas
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#000000';
    context.font = '20px Arial';
    context.textAlign = 'center';
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 7);

    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, y, z);
    sprite.scale.set(2, 0.5, 1);

    parent.add(sprite);
  }

  /**
   * Test specific texture loading
   */
  static testTextureLoading(): void {
        
    const testTypes: Array<{ type: 'ceiling' | 'wall' | 'hallway-floor' | 'room-floor', count: number }> = [
      { type: 'ceiling', count: 3 },
      { type: 'wall', count: 3 },
      { type: 'hallway-floor', count: 3 },
      { type: 'room-floor', count: 3 }
    ];

    testTypes.forEach(({ type, count }) => {
            for (let i = 0; i < count; i++) {
        try {
          const texture = TextureManager.getRandomTexture(type);
                  } catch (error) {
          console.error(`  ❌ Failed to load ${type} texture:`, error);
        }
      }
    });

    // Show cache stats
    const stats = TextureManager.getCacheStats();
          }

  /**
   * Remove test scene
   */
  static removeTextureTestScene(scene: THREE.Scene): void {
    const testGroup = scene.getObjectByName('TextureTest');
    if (testGroup) {
      scene.remove(testGroup);
      
      // Clean up materials and geometries
      testGroup.traverse((child) => {
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
      
          }
  }

  /**
   * Create a comprehensive test with all texture variations
   */
  static createComprehensiveTest(scene: THREE.Scene): THREE.Group {
    const testGroup = new THREE.Group();
    testGroup.name = 'ComprehensiveTextureTest';

    const cubeSize = 1.5;
    const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const spacing = 2;

    // Test each texture type with multiple random samples
    const types: Array<'ceiling' | 'wall' | 'hallway-floor' | 'room-floor'> = ['ceiling', 'wall', 'hallway-floor', 'room-floor'];
    
    types.forEach((type, typeIndex) => {
      for (let sample = 0; sample < 5; sample++) {
        try {
          const material = TextureManager.createMaterialWithTexture(type);
          const cube = new THREE.Mesh(geometry, material);
          
          cube.position.set(
            (typeIndex - 2) * spacing * 3,
            2,
            (sample - 2) * spacing
          );
          
          cube.name = `ComprehensiveTest_${type}_${sample}`;
          cube.castShadow = true;
          cube.receiveShadow = true;

          testGroup.add(cube);
        } catch (error) {
          console.error(`❌ Failed to create comprehensive test cube for ${type} sample ${sample}:`, error);
        }
      }

      // Add type label
      this.addTextLabel(
        testGroup, 
        type.replace('-', ' ').toUpperCase(), 
        (typeIndex - 2) * spacing * 3, 
        4, 
        0
      );
    });

    scene.add(testGroup);
        
    return testGroup;
  }
}
