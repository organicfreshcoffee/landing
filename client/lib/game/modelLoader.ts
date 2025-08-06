import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ModelData } from './types';

export class ModelLoader {
  private static loader: GLTFLoader | null = null;

  private static getLoader(): GLTFLoader {
    if (!this.loader) {
      this.loader = new GLTFLoader();
    }
    return this.loader;
  }

  static async loadPlayerModel(): Promise<ModelData> {
    const loader = this.getLoader();

    // Try to load the animated skeleton model (GLB format)
    try {
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          '/assets/3d-models/skeleton_walk.glb',
          resolve,
          undefined,
          reject
        );
      });

      console.log('✅ Loaded animated skeleton model successfully');

      // Clone the scene to create a fresh instance
      const clonedScene = gltf.scene.clone();
      
      // Calculate ground offset based on the skeleton's bounding box
      const bbox = new THREE.Box3().setFromObject(clonedScene);
      const groundOffset = {
        x: 0,
        y: -bbox.min.y, // Offset to put feet at ground level (y=0)
        z: 0
      };

      console.log('Model bounding box:', bbox);
      console.log('Ground offset calculated:', groundOffset);

      return {
        scene: clonedScene,
        animations: gltf.animations || [],
        groundOffset
      };
    } catch (error) {
      console.warn('⚠️ Failed to load skeleton_walk.glb, falling back to basic cube:', error);
      
      // Create fallback cube mesh with proper structure for consistency
      const geometry = new THREE.BoxGeometry(1, 2, 1);
      const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 1; // Center the cube above the ground
      
      // Wrap mesh in a group to maintain consistent structure
      const group = new THREE.Group();
      group.add(mesh);
      
      return { scene: group, animations: [], groundOffset: { x: 0, y: 0, z: 0 } };
    }
  }

  static async loadFantasyTownAsset(basePath: string, assetName: string): Promise<THREE.Group | null> {
    const loader = this.getLoader();
    
    try {
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          basePath + assetName,
          resolve,
          undefined,
          reject
        );
      });

      const model = gltf.scene.clone();
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      return model;
    } catch (error) {
      console.warn(`Failed to load ${assetName}:`, error);
      return null;
    }
  }
}
