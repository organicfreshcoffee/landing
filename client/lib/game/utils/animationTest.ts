import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { ModelLoader } from '../utils';

/**
 * Animation test utility to verify that player animations are working
 */
export class AnimationTest {
  private static testPlayer: THREE.Object3D | null = null;
  private static testMixer: THREE.AnimationMixer | null = null;
  private static testAction: THREE.AnimationAction | null = null;

  /**
   * Create a test animated player at the spawn point
   */
  static async createTestRunner(scene: THREE.Scene): Promise<void> {
    try {
      console.log('🏃 Creating test runner for animation debugging...');
      
      // Load a completely fresh player model instance
      const playerData = await ModelLoader.loadPlayerModel();
      
      // Use the scene directly (it's already properly cloned by ModelLoader)
      const testPlayerScene = playerData.scene;
      
      console.log('🏃 Loaded fresh player model for test runner');
      
      // Debug: Check if we have skeleton structure
      let foundSkeleton = false;
      let skinnedMeshCount = 0;
      testPlayerScene.traverse((child: THREE.Object3D) => {
        if (child.type === 'Bone') {
          foundSkeleton = true;
        }
        if (child.type === 'SkinnedMesh') {
          skinnedMeshCount++;
          console.log(`Found SkinnedMesh:`, child.name, 'skeleton:', !!(child as THREE.SkinnedMesh).skeleton);
        }
      });
      console.log('Test runner skeleton info:', { foundSkeleton, skinnedMeshCount });
      
      // Position at spawn point (slightly elevated to be visible)
      testPlayerScene.position.set(0, 2, 0); // Reduced from 6 to 2 units above ground
      testPlayerScene.rotation.y = 0; // Face forward
      
      // Make it visually distinct (bright red)
      testPlayerScene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map(mat => {
              const clonedMat = mat.clone();
              clonedMat.color.setHex(0xff0000); // Bright red
              return clonedMat;
            });
          } else {
            const clonedMaterial = child.material.clone();
            clonedMaterial.color.setHex(0xff0000); // Bright red
            child.material = clonedMaterial;
          }
        }
      });
      
      // Set up animations
      if (playerData.animations.length > 0) {
        this.testMixer = new THREE.AnimationMixer(testPlayerScene);
        
        // Find the run animation
        const runClip = playerData.animations.find(clip => clip.name === 'StickMan_Run');
        if (runClip) {
          this.testAction = this.testMixer.clipAction(runClip);
          this.testAction.setLoop(THREE.LoopRepeat, Infinity);
          this.testAction.clampWhenFinished = true;
          this.testAction.weight = 1.0;
          this.testAction.timeScale = 300.0; // Speed up by factor of 300
          this.testAction.play();
          
          console.log('✅ Test runner animation started');
          console.log('Animation details:', {
            clipName: runClip.name,
            duration: runClip.duration,
            isRunning: this.testAction.isRunning(),
            timeScale: this.testAction.timeScale,
            enabled: this.testAction.enabled,
            paused: this.testAction.paused,
            time: this.testAction.time
          });
          
          // Force immediate mixer update to verify it works
          this.testMixer.update(0.016); // Simulate one frame
          console.log('📊 After first mixer update:', {
            time: this.testAction.time,
            isRunning: this.testAction.isRunning()
          });
        } else {
          console.error('❌ StickMan_Run animation not found in loaded model');
          console.log('Available animations:', playerData.animations.map(clip => clip.name));
        }
      } else {
        console.error('❌ No animations found in player model');
      }
      
      // Mark as test object
      testPlayerScene.userData.isTestRunner = true;
      testPlayerScene.userData.isPlayer = true; // Prevent clearing
      testPlayerScene.name = 'TestRunner';
      
      // Add to scene
      scene.add(testPlayerScene);
      this.testPlayer = testPlayerScene;
      
      console.log('🏃 Test runner created at position:', testPlayerScene.position.toArray());
      
    } catch (error) {
      console.error('❌ Failed to create test runner:', error);
    }
  }

  /**
   * Update the test runner animation
   */
  static updateTestRunner(delta: number): void {
    if (this.testMixer) {
      // Use the smoothed delta passed from MovementController for consistent animation
      this.testMixer.update(delta);
      
      // Add slow rotation to test runner for visibility
      if (this.testPlayer) {
        this.testPlayer.rotation.y += delta * 0.5; // Slow rotation
      }
    }
  }

  /**
   * Remove the test runner from the scene
   */
  static removeTestRunner(scene: THREE.Scene): void {
    if (this.testPlayer) {
      scene.remove(this.testPlayer);
      this.testPlayer = null;
    }
    
    if (this.testMixer) {
      this.testMixer.stopAllAction();
      this.testMixer = null;
    }
    
    this.testAction = null;
    console.log('🗑️ Test runner removed');
  }

  /**
   * Toggle test runner visibility
   */
  static toggleTestRunner(scene: THREE.Scene): void {
    if (this.testPlayer) {
      this.testPlayer.visible = !this.testPlayer.visible;
      console.log('👁️ Test runner visibility:', this.testPlayer.visible);
    }
  }

  /**
   * Get debug information about the test runner
   */
  static getDebugInfo(): any {
    return {
      hasTestPlayer: !!this.testPlayer,
      hasTestMixer: !!this.testMixer,
      hasTestAction: !!this.testAction,
      isActionRunning: this.testAction?.isRunning() || false,
      actionTimeScale: this.testAction?.timeScale || 0,
      actionPaused: this.testAction?.paused || false,
      playerPosition: this.testPlayer?.position.toArray() || null
    };
  }
}
