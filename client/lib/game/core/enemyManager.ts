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

  // Store enemy references for accessing enemy data
  private static enemyReferences = new Map<string, Enemy>();

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

    console.log('🎨 Creating sprite model for enemy:', {
      id: enemy.id,
      enemyTypeName: enemyTypeName,
      position: enemy.position
    });

    // Create a group to hold the sprite
    const enemyGroup = new THREE.Group();
    
    // Create the sprite geometry and material
    const spriteGeometry = new THREE.PlaneGeometry(3.2, 4.8);
    
    // Determine initial direction and frame
    const direction = 'front';
    const frame = 1;
    
    // Pre-load all frame textures for animation
    const textureLoader = new THREE.TextureLoader();
    const frame1Path = `/assets/sprites/stendhal_animals/frames/${enemyTypeName}_${direction}_1.png`;
    const frame2Path = `/assets/sprites/stendhal_animals/frames/${enemyTypeName}_${direction}_2.png`;
    const frame3Path = `/assets/sprites/stendhal_animals/frames/${enemyTypeName}_${direction}_3.png`;
    
    console.log('🖼️ Loading enemy textures:', {
      id: enemy.id,
      frame1Path,
      frame2Path,
      frame3Path
    });
    
    const frame1Texture = textureLoader.load(frame1Path, 
      (texture) => {
        console.log(`✅ Loaded enemy frame 1: ${frame1Path} for ${enemy.id}`);
        console.log('📏 Texture dimensions:', { width: texture.image?.width, height: texture.image?.height });
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load enemy frame 1: ${frame1Path} for ${enemy.id}`, error);
      }
    );
    
    const frame2Texture = textureLoader.load(frame2Path, 
      (texture) => {
        console.log(`✅ Loaded enemy frame 2: ${frame2Path} for ${enemy.id}`);
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load enemy frame 2: ${frame2Path} for ${enemy.id}`, error);
      }
    );

    const frame3Texture = textureLoader.load(frame3Path, 
      (texture) => {
        console.log(`✅ Loaded enemy frame 3: ${frame3Path} for ${enemy.id}`);
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load enemy frame 3: ${frame3Path} for ${enemy.id}`, error);
      }
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
    
    console.log('🎨 Created sprite material:', {
      id: enemy.id,
      hasTexture: !!spriteMaterial.map,
      transparent: spriteMaterial.transparent,
      alphaTest: spriteMaterial.alphaTest,
      side: spriteMaterial.side
    });
    
    // Create the sprite mesh
    const spriteMesh = new THREE.Mesh(spriteGeometry, spriteMaterial);
    
    // Store mesh reference for texture updates
    this.spriteMeshReferences.set(enemy.id, spriteMesh);
    
    console.log('🔗 Stored sprite mesh reference:', {
      id: enemy.id,
      meshUuid: spriteMesh.uuid,
      geometryType: spriteMesh.geometry.type,
      materialType: spriteMesh.material.type
    });
    
    // Set sprite to always face the camera
    spriteMesh.lookAt(new THREE.Vector3(0, 0, 1));
    
    // Set position slightly above ground - half the sprite height to center it at ground level
    spriteMesh.position.y = 1;
    
    console.log('📐 Sprite mesh positioning:', {
      id: enemy.id,
      spriteLocalY: spriteMesh.position.y,
      spriteSize: { width: 3.2, height: 4.8 },
      note: 'Sprite positioned with Y offset to center at ground level'
    });
    
    // Add sprite to group
    enemyGroup.add(spriteMesh);
    
    // Store enemy metadata
    enemyGroup.userData = {
      isEnemy: true,
      enemyId: enemy.id,
      enemyType: enemy.enemyTypeName,
      enemyTypeID: enemy.enemyTypeID
    };
    
    console.log('✨ Created enemy group:', {
      id: enemy.id,
      groupChildren: enemyGroup.children.length,
      userData: enemyGroup.userData,
      groupPosition: enemyGroup.position
    });
    
    // Store enemy reference for later access
    this.enemyReferences.set(enemy.id, enemy);
    
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
  static updateEnemyPosition(enemy: Enemy, enemyData: EnemyUpdate, localPlayerPosition?: THREE.Vector3): void {
    if (!enemy.mesh) {
      console.warn('⚠️ Cannot update enemy position - no mesh:', enemy.id);
      return;
    }

    const targetPosition = new THREE.Vector3(
      enemyData.positionX,   // X coordinate from server
      enemy.position.y,      // Use the Y coordinate from the enemy object (set to player's ground level)
      enemyData.positionY    // Server's positionY maps to Three.js Z-axis
    );

    // Update position
    enemy.mesh.position.copy(targetPosition);

    // Don't update mesh rotation from server data - let the facing system handle it
    // Only store the rotation data for reference if needed
    if (enemyData.rotationY !== undefined) {
      // Store rotation in enemy data but don't apply to mesh
      enemy.rotation = {
        x: 0,
        y: enemyData.rotationY,
        z: 0
      };

      // Update sprite direction based on rotation and local player position
      if (localPlayerPosition) {
        this.updateEnemySpriteDirection(
          enemy.id,
          targetPosition,
          enemyData.rotationY,
          localPlayerPosition
        );
      }
    }

    // Update movement state
    enemy.isMoving = enemyData.isMoving;

    // Update sprite animation based on movement
    this.updateEnemyAnimation(enemy.id, enemyData);
  }

  /**
   * Update enemy sprite animation based on movement state and direction
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
      
      // Update texture based on current frame and direction
      this.updateEnemySpriteTexture(enemyId, animState.currentFrame, animState.direction);
    } else if (!animState.isMoving) {
      // Reset to frame 1 when not moving
      animState.currentFrame = 1;
      this.updateEnemySpriteTexture(enemyId, 1, animState.direction);
    }
  }

  /**
   * Update enemy sprite direction based on rotation and local player position
   */
  static updateEnemySpriteDirection(
    enemyId: string,
    enemyPosition: THREE.Vector3,
    enemyRotationY: number,
    localPlayerPosition: THREE.Vector3
  ): void {
    const animState = this.spriteAnimations.get(enemyId);
    if (!animState) return;

    // Calculate sprite direction similar to player system
    const newDirection = this.calculateEnemySpriteDirection(enemyPosition, enemyRotationY, localPlayerPosition);
    
    if (newDirection !== animState.direction) {      
      animState.direction = newDirection;
      this.spriteDirections.set(enemyId, newDirection);
      
      // Reload textures for new direction
      this.loadEnemySpriteTextures(enemyId, newDirection);
      
      // Update current texture immediately
      this.updateEnemySpriteTexture(enemyId, animState.currentFrame, newDirection);
    }
  }

  /**
   * Calculate enemy sprite direction based on rotation and local player position
   * Using same logic as player system for consistency
   */
  static calculateEnemySpriteDirection(
    enemyPosition: THREE.Vector3,
    enemyRotationY: number,
    localPlayerPosition: THREE.Vector3
  ): 'front' | 'back' | 'left' | 'right' {
    // Calculate direction from enemy to local player (same as player system)
    const toLocalPlayer = new THREE.Vector3()
      .subVectors(localPlayerPosition, enemyPosition)
      .normalize();
    
    // Convert to angle (same calculation as player system)
    const toLocalPlayerAngle = Math.atan2(toLocalPlayer.x, toLocalPlayer.z);
    
    // Enemy facing angle - convert rotation to radians
    const enemyFacingAngle = enemyRotationY  // THREE.MathUtils.degToRad(enemyRotationY);
    
    // Calculate relative angle (same as player system)
    let relativeAngle = toLocalPlayerAngle - enemyFacingAngle;
    
    // Normalize angle to [-π, π] range (same as player system)
    while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
    while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;
    
    // Determine sprite direction using same logic as player system
    if (relativeAngle >= -Math.PI / 4 && relativeAngle < Math.PI / 4) {
      return 'back'; // Player is in front of enemy (enemy shows back)
    } else if (relativeAngle >= Math.PI / 4 && relativeAngle < 3 * Math.PI / 4) {
      return 'left'; // Player is to the left from enemy's perspective
    } else if (relativeAngle >= 3 * Math.PI / 4 || relativeAngle < -3 * Math.PI / 4) {
      return 'front'; // Player is behind enemy (enemy shows front)
    } else {
      return 'right'; // Player is to the right from enemy's perspective
    }
  }

  /**
   * Load textures for a specific enemy sprite direction
   */
  static loadEnemySpriteTextures(enemyId: string, direction: 'front' | 'back' | 'left' | 'right'): void {
    const enemy = this.getEnemyFromSpriteId(enemyId);
    if (!enemy) return;

    const textureLoader = new THREE.TextureLoader();
    const frame1Path = `/assets/sprites/stendhal_animals/frames/${enemy.enemyTypeName}_${direction}_1.png`;
    const frame2Path = `/assets/sprites/stendhal_animals/frames/${enemy.enemyTypeName}_${direction}_2.png`;
    const frame3Path = `/assets/sprites/stendhal_animals/frames/${enemy.enemyTypeName}_${direction}_3.png`;
    
    const frame1Texture = textureLoader.load(frame1Path);
    const frame2Texture = textureLoader.load(frame2Path);
    const frame3Texture = textureLoader.load(frame3Path);
    
    // Configure textures
    [frame1Texture, frame2Texture, frame3Texture].forEach(texture => {
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
    });
    
    // Update stored textures
    this.spriteTextures.set(enemyId, {
      frame1: frame1Texture,
      frame2: frame2Texture,
      frame3: frame3Texture
    });
  }

  /**
   * Update enemy sprite texture based on frame and direction
   */
  static updateEnemySpriteTexture(enemyId: string, frame: number, direction: 'front' | 'back' | 'left' | 'right'): void {
    const spriteMesh = this.spriteMeshReferences.get(enemyId);
    const textures = this.spriteTextures.get(enemyId);
    
    if (!spriteMesh || !textures) return;

    const material = spriteMesh.material as THREE.MeshBasicMaterial;
    switch (frame) {
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
  }

  /**
   * Helper to get enemy data from sprite ID
   */
  static getEnemyFromSpriteId(enemyId: string): Enemy | null {
    return this.enemyReferences.get(enemyId) || null;
  }

  /**
   * Make all enemies face the local player (similar to player sprite rotation)
   */
  static updateAllEnemiesFacing(localPlayerPosition: THREE.Vector3): void {
    this.spriteMeshReferences.forEach((mesh, enemyId) => {
      // Get the enemy group (parent of sprite mesh)
      const enemyGroup = mesh.parent;
      if (!enemyGroup) return;

      // Calculate direction from enemy to local player
      const enemyPosition = enemyGroup.position;
      const direction = new THREE.Vector3()
        .subVectors(localPlayerPosition, enemyPosition)
        .normalize();

      // Calculate angle and make sprite face the local player (only Y rotation)
      const angle = Math.atan2(direction.x, direction.z);
      mesh.rotation.y = angle;
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
    
    // Clean up enemy reference
    this.enemyReferences.delete(enemyId);
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
