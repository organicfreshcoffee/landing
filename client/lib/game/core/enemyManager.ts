import * as THREE from 'three';
import { Enemy, EnemyUpdate } from '../types';

export class EnemyManager {
  // Sprite animation state tracking
  private static spriteAnimations = new Map<string, {
    mixer: THREE.AnimationMixer;
    currentFrame: number;
    lastFrameTime: number;
    isMoving: boolean;
    direction: 'front' | 'back' | 'left' | 'right';
  }>();

  // Sprite mesh references for texture updates
  private static spriteMeshReferences = new Map<string, THREE.Mesh>();

  // Pre-loaded textures for sprite animation
  private static spriteTextures = new Map<string, {
    frame1: THREE.Texture;
    frame2: THREE.Texture;
    frame3: THREE.Texture;
  }>();

  // Store current sprite direction for each enemy
  private static spriteDirections = new Map<string, 'front' | 'back' | 'left' | 'right'>();

  /**
   * Create sprite-based enemy model using enemy type data
   */
  static createSpriteEnemyModel(enemy: Enemy): { 
    model: THREE.Object3D; 
    mixer?: THREE.AnimationMixer; 
    actions?: { [key: string]: THREE.AnimationAction } 
  } {
    const enemyTypeName = enemy.enemyTypeName;
    if (!enemyTypeName) {
      throw new Error('Enemy must have enemyTypeName for sprite rendering');
    }

    // Create a group to hold the sprite
    const enemyGroup = new THREE.Group();
    
    // Create the sprite geometry and material - make enemies slightly smaller than players
    const spriteGeometry = new THREE.PlaneGeometry(0.8, 1.2);
    
    // Determine initial direction and frame
    const direction = 'front';
    const frame = 1;
    
    // Pre-load all frame textures for animation
    const textureLoader = new THREE.TextureLoader();
    const frame1Path = `/assets/sprites/stendhal_animals/frames/${enemyTypeName}_${direction}_1.png`;
    const frame2Path = `/assets/sprites/stendhal_animals/frames/${enemyTypeName}_${direction}_2.png`;
    const frame3Path = `/assets/sprites/stendhal_animals/frames/${enemyTypeName}_${direction}_3.png`;
    
    const frame1Texture = textureLoader.load(frame1Path, 
      () => console.log(`✅ Loaded enemy frame 1: ${frame1Path}`),
      undefined,
      (error) => console.error(`❌ Failed to load enemy frame 1: ${frame1Path}`, error)
    );
    
    const frame2Texture = textureLoader.load(frame2Path, 
      () => console.log(`✅ Loaded enemy frame 2: ${frame2Path}`),
      undefined,
      (error) => console.error(`❌ Failed to load enemy frame 2: ${frame2Path}`, error)
    );

    const frame3Texture = textureLoader.load(frame3Path, 
      () => console.log(`✅ Loaded enemy frame 3: ${frame3Path}`),
      undefined,
      (error) => console.error(`❌ Failed to load enemy frame 3: ${frame3Path}`, error)
    );
    
    // Configure textures
    [frame1Texture, frame2Texture, frame3Texture].forEach(texture => {
      texture.magFilter = THREE.NearestFilter; // Pixelated look for retro sprites
      texture.minFilter = THREE.NearestFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
    });
    
    // Store pre-loaded textures
    this.spriteTextures.set(enemy.id, {
      frame1: frame1Texture,
      frame2: frame2Texture,
      frame3: frame3Texture
    });

    // Store initial direction
    this.spriteDirections.set(enemy.id, direction);
    
    // Create material with transparency using frame 1 initially
    const spriteMaterial = new THREE.MeshBasicMaterial({
      map: frame1Texture,
      transparent: true,
      alphaTest: 0.1, // Remove pixels with alpha below 0.1
      side: THREE.DoubleSide // Show sprite from both sides
    });
    
    // Create the sprite mesh
    const spriteMesh = new THREE.Mesh(spriteGeometry, spriteMaterial);
    
    // Store mesh reference for texture updates
    this.spriteMeshReferences.set(enemy.id, spriteMesh);
    
    // Set sprite to always face the camera
    spriteMesh.lookAt(new THREE.Vector3(0, 0, 1));
    
    // Set position slightly above ground
    spriteMesh.position.y = 0.75; // Half the sprite height to center it
    
    // Add sprite to group
    enemyGroup.add(spriteMesh);
    
    // Store enemy metadata
    enemyGroup.userData = {
      isEnemy: true,
      enemyId: enemy.id,
      enemyType: enemy.enemyTypeName,
      enemyTypeID: enemy.enemyTypeID
    };
    
    // Initialize sprite animation state
    this.spriteAnimations.set(enemy.id, {
      mixer: new THREE.AnimationMixer(enemyGroup),
      currentFrame: 1,
      lastFrameTime: Date.now(),
      isMoving: enemy.isMoving,
      direction: direction
    });

    return {
      model: enemyGroup,
      mixer: this.spriteAnimations.get(enemy.id)?.mixer,
      actions: {} // No predefined actions for sprites
    };
  }

  /**
   * Update enemy position and rotation
   */
  static updateEnemyPosition(enemy: Enemy, enemyData: EnemyUpdate): void {
    if (!enemy.mesh) return;

    const targetPosition = new THREE.Vector3(
      enemyData.positionX,
      0, // Keep enemies on the ground
      enemyData.positionY
    );

    // Update position
    enemy.mesh.position.copy(targetPosition);

    // Update rotation if provided
    if (enemyData.rotationY !== undefined) {
      enemy.mesh.rotation.y = THREE.MathUtils.degToRad(enemyData.rotationY);
    }

    // Update movement state
    enemy.isMoving = enemyData.isMoving;

    // Update sprite animation based on movement
    this.updateEnemyAnimation(enemy.id, enemyData);
  }

  /**
   * Update enemy sprite animation based on movement state
   */
  static updateEnemyAnimation(enemyId: string, enemyData: EnemyUpdate): void {
    const animState = this.spriteAnimations.get(enemyId);
    const spriteMesh = this.spriteMeshReferences.get(enemyId);
    const textures = this.spriteTextures.get(enemyId);
    
    if (!animState || !spriteMesh || !textures) return;

    const now = Date.now();
    const deltaTime = now - animState.lastFrameTime;
    
    // Update movement state
    animState.isMoving = enemyData.isMoving;
    
    // Animate if moving (cycle through frames every 200ms)
    if (animState.isMoving && deltaTime > 200) {
      animState.currentFrame = (animState.currentFrame % 3) + 1; // Cycle 1, 2, 3, 1, 2, 3...
      animState.lastFrameTime = now;
      
      // Update texture based on current frame
      const material = spriteMesh.material as THREE.MeshBasicMaterial;
      switch (animState.currentFrame) {
        case 1:
          material.map = textures.frame1;
          break;
        case 2:
          material.map = textures.frame2;
          break;
        case 3:
          material.map = textures.frame3;
          break;
      }
      material.needsUpdate = true;
    } else if (!animState.isMoving) {
      // Reset to frame 1 when not moving
      animState.currentFrame = 1;
      const material = spriteMesh.material as THREE.MeshBasicMaterial;
      material.map = textures.frame1;
      material.needsUpdate = true;
    }
  }

  /**
   * Make all enemies face the local player
   */
  static updateAllEnemiesFacing(localPlayerPosition: THREE.Vector3): void {
    this.spriteMeshReferences.forEach((mesh, enemyId) => {
      // Calculate direction to player
      const enemyPosition = mesh.parent?.position || mesh.position;
      const direction = new THREE.Vector3()
        .subVectors(localPlayerPosition, enemyPosition)
        .normalize();
      
      // Make sprite face the player
      mesh.lookAt(
        enemyPosition.x + direction.x,
        enemyPosition.y,
        enemyPosition.z + direction.z
      );
    });
  }

  /**
   * Remove enemy and clean up resources
   */
  static removeEnemy(enemyId: string): void {
    // Clean up animation state
    this.spriteAnimations.delete(enemyId);
    
    // Clean up mesh reference
    this.spriteMeshReferences.delete(enemyId);
    
    // Clean up textures
    const textures = this.spriteTextures.get(enemyId);
    if (textures) {
      textures.frame1.dispose();
      textures.frame2.dispose();
      textures.frame3.dispose();
      this.spriteTextures.delete(enemyId);
    }
    
    // Clean up direction
    this.spriteDirections.delete(enemyId);
  }

  /**
   * Dispose of enemy mesh and its materials
   */
  static disposeEnemyMesh(mesh: THREE.Object3D): void {
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Dispose geometry
        if (child.geometry) {
          child.geometry.dispose();
        }
        
        // Dispose material
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => {
              if (material.map) material.map.dispose();
              material.dispose();
            });
          } else {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      }
    });
  }
}
