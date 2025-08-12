import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { SkeletonUtils } from 'three-stdlib';
import { ModelData } from '../types';
import { CubeConfig } from '../config/cubeConfig';

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

    // Try to load the animated stickman model (GLB format)
    try {
      console.log('Attempting to load stickman.glb...');
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          '/assets/3d-models/stickman.glb',
          resolve,
          undefined,
          reject
        );
      });

      console.log('Successfully loaded stickman.glb with', gltf.animations?.length || 0, 'animations');

      // Use SkeletonUtils.clone to properly handle SkinnedMesh and skeleton data
      const freshScene = SkeletonUtils.clone(gltf.scene) as THREE.Group;
      
      // Debug: Log animation details
      if (gltf.animations && gltf.animations.length > 0) {
        gltf.animations.forEach((anim: any, index: number) => {
          console.log(`Animation ${index}: "${anim.name}" - Duration: ${anim.duration}s - Tracks: ${anim.tracks.length}`);
        });
      } else {
        console.warn('⚠️ No animations found in stickman.glb!');
      }
      
      // Scale the model appropriately for the game - make twice as big
      freshScene.scale.set(0.6, 0.6, 0.6);
      
      // Rotate 180 degrees around Y axis so the model faces away from the camera initially
      freshScene.rotation.y = Math.PI;
      
      // Get bounding box after scaling and rotation to calculate ground offset
      const box = new THREE.Box3().setFromObject(freshScene);
      const center = box.getCenter(new THREE.Vector3());
      
      console.log('Model bounds after scaling and rotation:', {
        min: box.min,
        max: box.max,
        center: center,
        size: box.getSize(new THREE.Vector3())
      });
      
      // Store the ground offset for later use but don't apply it to the template
      const groundOffset = {
        x: -center.x,
        z: -center.z,
        y: -box.min.y + CubeConfig.getCubeSize() // Position player above the floor cubes
      };
      
      // Reset position to origin for template - individual instances will apply offsets
      freshScene.position.set(0, 0, 0);
      
      console.log('Template model reset to origin, ground offset calculated (positioned above floor cubes):', groundOffset);
      
      // Debug: Check for bones/skeleton structure
      let foundSkeleton = false;
      freshScene.traverse((child: THREE.Object3D) => {
        if (child.type === 'Bone' || child.type === 'SkinnedMesh') {
          console.log(`Found ${child.type}:`, child.name, 'position:', child.position.toArray(), 'world position:', child.getWorldPosition(new THREE.Vector3()).toArray());
          foundSkeleton = true;
        }
      });
      console.log('Has skeleton/bones:', foundSkeleton);
      
      // Ensure all materials render properly and are visible
      freshScene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) {
            // Make sure material renders both sides
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                mat.side = THREE.DoubleSide;
                mat.transparent = false;
                mat.opacity = 1.0;
                mat.needsUpdate = true;
              });
            } else {
              child.material.side = THREE.DoubleSide;
              child.material.transparent = false;
              child.material.opacity = 1.0;
              child.material.needsUpdate = true;
            }
          }
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Check if geometry has proper normals
          if (child.geometry && !child.geometry.attributes.normal) {
            child.geometry.computeVertexNormals();
          }
        }
      });

      return {
        scene: freshScene,
        animations: gltf.animations || [],
        groundOffset
      };
    } catch (error) {
      console.log('StickMan GLB model not available, using fallback cube:', error);
      
      // Fallback to cube geometry with improved appearance
      const geometry = new THREE.BoxGeometry(0.5, 1.8, 0.3); // Human-like proportions, smaller size
      const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.9; // Half the height to center it at ground level
      mesh.castShadow = true;
      
      // Wrap mesh in a group to maintain consistent structure
      const group = new THREE.Group();
      group.add(mesh);
      
      return { 
        scene: group, 
        animations: [], 
        groundOffset: { 
          x: 0, 
          y: CubeConfig.getCubeSize(), // Position fallback player above floor cubes too
          z: 0 
        } 
      };
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
