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
    totalFrames: number;
    animationType: string;
  }>();

  // Sprite mesh references for texture updates
  private static spriteMeshReferences = new Map<string, THREE.Mesh>();

  // Pre-loaded textures for sprite animation (now supports variable frame counts)
  private static spriteTextures = new Map<string, THREE.Texture[]>();

  // Store current sprite direction for each enemy
  private static spriteDirections = new Map<string, 'front' | 'back' | 'left' | 'right'>();

  // Store enemy references for accessing enemy data
  private static enemyReferences = new Map<string, Enemy>();

  // Health tracking for enemies (maps enemy ID to health info)
  private static enemyHealthData = new Map<string, { 
    health: number; 
    maxHealth: number; 
    lastHealth: number; // Track previous health for damage detection
  }>();

  // Health bar references (maps enemy ID to health bar mesh)
  private static healthBarReferences = new Map<string, {
    container: THREE.Group;
    background: THREE.Mesh;
    foreground: THREE.Mesh;
  }>();

  // Enemy type configurations
  private static readonly PIXEL_ADVENTURE_2_ENEMIES = new Set([
    'AngryPig', 'Bat', 'Bee', 'BlueBird', 'Bunny', 'Chameleon',
    'Chicken', 'Duck', 'FatBird', 'Ghost', 'Mushroom', 'Plant',
    'Radish', 'Rino', 'Rocks', 'Skull', 'Slime', 'Snail', 'Trunk', 'Turtle'
  ]);

  // Animation priority mapping for Pixel Adventure 2 enemies
  private static readonly PIXEL_ADVENTURE_2_ANIMATIONS = {
    'AngryPig': ['Run', 'Idle'],
    'Bat': ['Flying', 'Idle'],
    'Bee': ['Run', 'Idle'],
    'BlueBird': ['Flying', 'Idle'],
    'Bunny': ['Run', 'Idle'],
    'Chameleon': ['Run', 'Idle'],
    'Chicken': ['Run', 'Idle'],
    'Duck': ['Run', 'Idle'],
    'FatBird': ['Flying', 'Idle'],
    'Ghost': ['Idle'],
    'Mushroom': ['Run', 'Idle'],
    'Plant': ['Idle'],
    'Radish': ['Run', 'Idle'],
    'Rino': ['Run', 'Idle'],
    'Rocks': ['Rock1_Run', 'Rock1_Idle'],
    'Skull': ['Flying', 'Idle'],
    'Slime': ['Idle-Run'],
    'Snail': ['Walk', 'Idle'],
    'Trunk': ['Run', 'Idle'],
    'Turtle': ['Run', 'Idle']
  };

  private static readonly STENDHAL_ANIMALS = new Set([
    'bull', 'cow', 'lion', 'monkey', 'ram', 'tiger'
  ]);

  /**
   * Get the appropriate animation type for a Pixel Adventure 2 enemy
   */
  static getPixelAdventure2Animation(enemyTypeName: string): string {
    const animations = this.PIXEL_ADVENTURE_2_ANIMATIONS[enemyTypeName as keyof typeof this.PIXEL_ADVENTURE_2_ANIMATIONS];
    return animations?.[0] || 'Idle';
  }

  /**
   * Load textures for Pixel Adventure 2 enemies
   */
  static loadPixelAdventure2Textures(enemyId: string, enemyTypeName: string, animationType: string): number {
    const textureLoader = new THREE.TextureLoader();
    const basePath = `/assets/sprites/Pixel Adventure 2/parsed/${enemyTypeName}/${animationType}`;
    
    // Pre-determine frame count based on known enemy types and animations
    // This is more reliable than trying to load and catch errors
    const frameCount = this.getPixelAdventure2FrameCount(enemyTypeName, animationType);
    
    console.log(`🖼️ Loading ${frameCount} frames for ${enemyTypeName}/${animationType}`);
    
    const textures: THREE.Texture[] = [];
    
    for (let i = 1; i <= frameCount; i++) {
      const framePath = `${basePath}/${i}.png`;
      
      const texture = textureLoader.load(
        framePath,
        (loadedTexture) => {
          console.log(`✅ Loaded Pixel Adventure 2 frame ${i}: ${framePath} for ${enemyId}`);
          loadedTexture.magFilter = THREE.NearestFilter;
          loadedTexture.minFilter = THREE.NearestFilter;
          loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
          loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
        },
        undefined,
        (error) => {
          console.error(`❌ Failed to load Pixel Adventure 2 frame ${i}: ${framePath} for ${enemyId}`, error);
        }
      );
      
      textures.push(texture);
    }
    
    // Store textures
    this.spriteTextures.set(enemyId, textures);
    
    return frameCount;
  }

  /**
   * Get the frame count for a specific Pixel Adventure 2 enemy animation
   */
  static getPixelAdventure2FrameCount(enemyTypeName: string, animationType: string): number {
    // Frame counts determined by examining the actual sprite sheets
    const frameCounts: { [key: string]: { [key: string]: number } } = {
      'AngryPig': { 'Run': 12, 'Idle': 11, 'Walk': 16, 'Hit 1': 5, 'Hit 2': 5 },
      'Bat': { 'Flying': 7, 'Idle': 4, 'Hit': 5, 'Ceiling In': 8, 'Ceiling Out': 8 },
      'Bee': { 'Run': 8, 'Idle': 4, 'Hit': 5 },
      'BlueBird': { 'Flying': 9, 'Idle': 4 },
      'Bunny': { 'Run': 12, 'Idle': 4, 'Hit': 5, 'Jump': 8, 'Fall': 3 },
      'Chameleon': { 'Run': 8, 'Idle': 10, 'Hit': 5 },
      'Chicken': { 'Run': 14, 'Idle': 13, 'Hit': 5 },
      'Duck': { 'Run': 10, 'Idle': 10, 'Hit': 5, 'Jump': 8, 'Fall': 3 },
      'FatBird': { 'Flying': 8, 'Idle': 4, 'Hit': 5, 'Ground': 9, 'Fall': 4 },
      'Ghost': { 'Idle': 10, 'Hit': 5, 'Appear': 7, 'Desappear': 7 },
      'Mushroom': { 'Run': 16, 'Idle': 14, 'Hit': 5 },
      'Plant': { 'Idle': 11, 'Hit': 5, 'Attack': 8 },
      'Radish': { 'Run': 12, 'Idle': 10, 'Hit': 4 },
      'Rino': { 'Run': 6, 'Idle': 11, 'Hit': 5 },
      'Rocks': { 'Rock1_Run': 14, 'Rock1_Idle': 14, 'Rock2_Run': 14, 'Rock2_Idle': 14, 'Rock3_Run': 14, 'Rock3_Idle': 14 },
      'Skull': { 'Flying': 8, 'Idle': 4, 'Hit': 5 },
      'Slime': { 'Idle-Run': 10, 'Hit': 5 },
      'Snail': { 'Walk': 10, 'Idle': 9, 'Hit': 5, 'Shell Idle': 5, 'Shell Top Hit': 4, 'Shell Wall Hit': 4 },
      'Trunk': { 'Run': 18, 'Idle': 13, 'Hit': 5 },
      'Turtle': { 'Run': 14, 'Idle': 14, 'Hit': 8 }
    };

    const enemyFrames = frameCounts[enemyTypeName];
    if (enemyFrames && enemyFrames[animationType]) {
      return enemyFrames[animationType];
    }

    // Default fallback
    console.warn(`⚠️ Unknown frame count for ${enemyTypeName}/${animationType}, using default of 4`);
    return 4;
  }

  /**
   * Load textures for Stendhal animals (legacy system)
   */
  static loadStendhalAnimalTextures(enemyId: string, enemyTypeName: string, direction: string): number {
    const textureLoader = new THREE.TextureLoader();
    const frame1Path = `/assets/sprites/stendhal_animals/frames/${enemyTypeName}_${direction}_1.png`;
    const frame2Path = `/assets/sprites/stendhal_animals/frames/${enemyTypeName}_${direction}_2.png`;
    const frame3Path = `/assets/sprites/stendhal_animals/frames/${enemyTypeName}_${direction}_3.png`;
    
    console.log('🖼️ Loading stendhal animal textures:', {
      id: enemyId,
      frame1Path,
      frame2Path,
      frame3Path
    });
    
    const frame1Texture = textureLoader.load(frame1Path, 
      (texture) => {
        console.log(`✅ Loaded stendhal frame 1: ${frame1Path} for ${enemyId}`);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load stendhal frame 1: ${frame1Path} for ${enemyId}`, error);
      }
    );
    
    const frame2Texture = textureLoader.load(frame2Path, 
      (texture) => {
        console.log(`✅ Loaded stendhal frame 2: ${frame2Path} for ${enemyId}`);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load stendhal frame 2: ${frame2Path} for ${enemyId}`, error);
      }
    );

    const frame3Texture = textureLoader.load(frame3Path, 
      (texture) => {
        console.log(`✅ Loaded stendhal frame 3: ${frame3Path} for ${enemyId}`);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load stendhal frame 3: ${frame3Path} for ${enemyId}`, error);
      }
    );
    
    // Store textures as array
    this.spriteTextures.set(enemyId, [frame1Texture, frame2Texture, frame3Texture]);
    
    return 3; // Stendhal animals always have 3 frames
  }

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
    
    // Determine if this is a Pixel Adventure 2 enemy or stendhal animal
    const isPixelAdventure2 = this.PIXEL_ADVENTURE_2_ENEMIES.has(enemyTypeName);
    
    // Get the appropriate animation type and load textures
    let animationType: string;
    let totalFrames: number;
    
    if (isPixelAdventure2) {
      animationType = this.getPixelAdventure2Animation(enemyTypeName);
      totalFrames = this.loadPixelAdventure2Textures(enemy.id, enemyTypeName, animationType);
    } else {
      // Use old system for stendhal animals
      animationType = 'front';
      totalFrames = this.loadStendhalAnimalTextures(enemy.id, enemyTypeName, 'front');
    }
    
    // Get the first texture for initial display
    const textures = this.spriteTextures.get(enemy.id);
    if (!textures || textures.length === 0) {
      throw new Error(`Failed to load textures for enemy ${enemyTypeName}`);
    }
    
    // Create material with transparency using first frame
    const spriteMaterial = new THREE.MeshBasicMaterial({
      map: textures[0],
      transparent: true,
      alphaTest: 0.1, // Remove pixels with alpha below 0.1
      side: THREE.DoubleSide // Show sprite from both sides
    });
    
    console.log('🎨 Created sprite material:', {
      id: enemy.id,
      hasTexture: !!spriteMaterial.map,
      transparent: spriteMaterial.transparent,
      alphaTest: spriteMaterial.alphaTest,
      side: spriteMaterial.side,
      totalFrames: totalFrames,
      animationType: animationType
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
      direction: isPixelAdventure2 ? 'front' : 'front',
      totalFrames: totalFrames,
      animationType: animationType
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
      animState.currentFrame = (animState.currentFrame % animState.totalFrames) + 1; // Cycle through all available frames
      animState.lastFrameTime = now;
      
      // Update texture based on current frame
      this.updateEnemySpriteTexture(enemyId, animState.currentFrame);
    } else if (!animState.isMoving) {
      // Reset to frame 1 when not moving
      animState.currentFrame = 1;
      this.updateEnemySpriteTexture(enemyId, 1);
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
    const enemy = this.enemyReferences.get(enemyId);
    const animState = this.spriteAnimations.get(enemyId);
    if (!animState || !enemy) return;

    // For Pixel Adventure 2 enemies, direction doesn't matter since they don't have directional sprites
    // Only stendhal animals use directional sprites
    if (this.PIXEL_ADVENTURE_2_ENEMIES.has(enemy.enemyTypeName)) {
      return; // No direction changes needed for Pixel Adventure 2 enemies
    }

    // Calculate sprite direction for stendhal animals
    const newDirection = this.calculateEnemySpriteDirection(enemyPosition, enemyRotationY, localPlayerPosition);
    
    if (newDirection !== animState.direction) {
      console.log('🔄 Enemy sprite direction changed:', {
        enemyId,
        oldDirection: animState.direction,
        newDirection,
        enemyRotation: enemyRotationY
      });
      
      animState.direction = newDirection;
      this.spriteDirections.set(enemyId, newDirection);
      
      // Reload textures for new direction (stendhal animals only)
      this.loadStendhalAnimalTextures(enemyId, enemy.enemyTypeName, newDirection);
      
      // Update current texture immediately
      this.updateEnemySpriteTexture(enemyId, animState.currentFrame);
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

    // Only reload for stendhal animals
    if (this.STENDHAL_ANIMALS.has(enemy.enemyTypeName)) {
      this.loadStendhalAnimalTextures(enemyId, enemy.enemyTypeName, direction);
    }
  }

  /**
   * Update enemy sprite texture based on frame
   */
  static updateEnemySpriteTexture(enemyId: string, frame: number): void {
    const spriteMesh = this.spriteMeshReferences.get(enemyId);
    const textures = this.spriteTextures.get(enemyId);
    
    if (!spriteMesh || !textures || textures.length === 0) return;

    const material = spriteMesh.material as THREE.MeshBasicMaterial;
    
    // Use 0-based indexing for the texture array
    const frameIndex = Math.max(0, Math.min(frame - 1, textures.length - 1));
    material.map = textures[frameIndex];
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
   * Update enemy health data and create/update health bar if needed
   */
  static updateEnemyHealth(
    enemyId: string, 
    newHealth: number | undefined, 
    maxHealth: number | undefined,
    particleSystem?: any
  ): void {
    console.log('🔍 EnemyManager.updateEnemyHealth called:', {
      enemyId,
      newHealth,
      maxHealth,
      hasParticleSystem: !!particleSystem
    });

    // Skip if no health data provided
    if (newHealth === undefined) {
      console.log('⚠️ Skipping health update - no health value provided');
      return;
    }

    // If maxHealth is not provided, assume a default of 100
    const effectiveMaxHealth = maxHealth !== undefined ? maxHealth : 100;
    const currentHealthData = this.enemyHealthData.get(enemyId);
    const enemy = this.enemyReferences.get(enemyId);
    
    if (!enemy || !enemy.mesh) {
      console.log('⚠️ Skipping health update - enemy or mesh not found:', {
        hasEnemy: !!enemy,
        hasMesh: !!enemy?.mesh,
        enemyId
      });
      return;
    }

    // Check for damage (new health < old health)
    if (currentHealthData && newHealth < currentHealthData.lastHealth && particleSystem) {      
      // Create damage particle effect at enemy position (lowered Y offset)
      const enemyPosition = enemy.mesh.position.clone();
      enemyPosition.y += 0.5; // Reduced from 2 to 0.5 to be more inline with enemy
      particleSystem.createDamageEffect(enemyPosition);
    }

    // Update health data
    this.enemyHealthData.set(enemyId, {
      health: newHealth,
      maxHealth: effectiveMaxHealth,
      lastHealth: currentHealthData ? currentHealthData.health : newHealth
    });

    // Update enemy object
    enemy.health = newHealth;
    enemy.maxHealth = effectiveMaxHealth;

    // Create or update health bar only if health is below max (removed testing mode)
    if (newHealth < effectiveMaxHealth) {
      this.createOrUpdateHealthBar(enemyId, newHealth, effectiveMaxHealth, enemy.mesh);
    } else {
      // Remove health bar if at full health
      this.removeHealthBar(enemyId);
    }
  }

  /**
   * Create or update health bar for an enemy
   */
  static createOrUpdateHealthBar(
    enemyId: string, 
    health: number, 
    maxHealth: number, 
    enemyMesh: THREE.Object3D
  ): void {
    console.log('🔨 createOrUpdateHealthBar called:', {
      enemyId,
      health,
      maxHealth,
      healthPercentage: health / maxHealth
    });

    let healthBarData = this.healthBarReferences.get(enemyId);

    if (!healthBarData) {
      console.log('✨ Creating new health bar for enemy:', enemyId);
      
      // Create new health bar
      const container = new THREE.Group();
      
      // Background (red bar)
      const backgroundGeometry = new THREE.PlaneGeometry(3, 0.3);
      const backgroundMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x660000, 
        transparent: true, 
        opacity: 0.9,
        depthTest: false,
        depthWrite: false
      });
      const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
      
      // Foreground (green bar)
      const foregroundGeometry = new THREE.PlaneGeometry(3, 0.25);
      const foregroundMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00cc00, 
        transparent: true, 
        opacity: 1.0,
        depthTest: false,
        depthWrite: false
      });
      const foreground = new THREE.Mesh(foregroundGeometry, foregroundMaterial);
      
      // Position foreground slightly in front of background
      foreground.position.z = 0.001;
      
      container.add(background);
      container.add(foreground);
      
      // Position health bar above enemy (reduced from 4.5 to 3.0)
      container.position.y = 3.0;
      
      // Set render order to ensure health bars render on top
      container.renderOrder = 999;
      
      // Add to enemy mesh
      enemyMesh.add(container);
      
      healthBarData = {
        container,
        background,
        foreground
      };
      
      this.healthBarReferences.set(enemyId, healthBarData);
      
      console.log('✅ Created health bar for enemy:', {
        enemyId,
        containerUuid: container.uuid,
        parentUuid: enemyMesh.uuid,
        position: container.position,
        childrenCount: enemyMesh.children.length
      });
    } else {
      console.log('🔄 Updating existing health bar for enemy:', enemyId);
    }

    // Update health bar width based on health percentage
    const healthPercentage = Math.max(0, Math.min(1, health / maxHealth));
    const maxWidth = 3; // Same as background width (updated to match new size)
    const currentWidth = maxWidth * healthPercentage;
    
    console.log('📊 Health bar update details:', {
      enemyId,
      healthPercentage,
      maxWidth,
      currentWidth,
      scaleX: healthPercentage
    });
    
    // Update foreground width
    healthBarData.foreground.scale.x = healthPercentage;
    
    // Adjust position to keep bar left-aligned
    healthBarData.foreground.position.x = (maxWidth - currentWidth) / -2;
    
    // Change color based on health percentage
    const healthMaterial = healthBarData.foreground.material as THREE.MeshBasicMaterial;
    if (healthPercentage > 0.6) {
      healthMaterial.color.setHex(0x00cc00); // Green
    } else if (healthPercentage > 0.3) {
      healthMaterial.color.setHex(0xcccc00); // Yellow
    } else {
      healthMaterial.color.setHex(0xcc0000); // Red
    }
    
    console.log('🎨 Health bar color updated:', {
      enemyId,
      healthPercentage,
      color: healthMaterial.color.getHexString()
    });
  }

  /**
   * Remove health bar for an enemy
   */
  static removeHealthBar(enemyId: string): void {
    const healthBarData = this.healthBarReferences.get(enemyId);
    
    if (healthBarData) {
      // Remove from enemy mesh
      if (healthBarData.container.parent) {
        healthBarData.container.parent.remove(healthBarData.container);
      }
      
      // Dispose materials and geometry
      healthBarData.background.geometry.dispose();
      (healthBarData.background.material as THREE.Material).dispose();
      healthBarData.foreground.geometry.dispose();
      (healthBarData.foreground.material as THREE.Material).dispose();
      
      this.healthBarReferences.delete(enemyId);
    }
  }

  /**
   * Clear all enemy health data (called when changing floors)
   */
  static clearAllHealthData(): void {
    console.log('🧹 Clearing all enemy health data');
    
    // Remove all health bars
    this.healthBarReferences.forEach((healthBarData, enemyId) => {
      this.removeHealthBar(enemyId);
    });
    
    // Clear health tracking
    this.enemyHealthData.clear();
    this.healthBarReferences.clear();
  }

  /**
   * Update all health bars to face the camera
   */
  static updateAllHealthBarsFacing(cameraPosition: THREE.Vector3): void {
    this.healthBarReferences.forEach((healthBarData, enemyId) => {
      if (healthBarData.container && healthBarData.container.parent) {
        // Get world position of the health bar
        const worldPosition = new THREE.Vector3();
        healthBarData.container.getWorldPosition(worldPosition);
        
        // Calculate direction from health bar to camera
        const direction = new THREE.Vector3().subVectors(cameraPosition, worldPosition).normalize();
        
        // Make health bar face the camera
        healthBarData.container.lookAt(cameraPosition);
      }
    });
  }

  /**
   * Remove enemy and clean up health data
   */
  static removeEnemy(enemyId: string): void {
    // Remove health bar if exists
    this.removeHealthBar(enemyId);
    
    // Clear health data
    this.enemyHealthData.delete(enemyId);
    
    // Clear other enemy data
    this.spriteAnimations.delete(enemyId);
    this.spriteMeshReferences.delete(enemyId);
    this.spriteTextures.delete(enemyId);
    this.spriteDirections.delete(enemyId);
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
