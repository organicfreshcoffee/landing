import * as THREE from 'three';
import { Player, PlayerUpdate, ModelData, PlayerAnimationData, CharacterData } from '../types';
import { ModelLoader } from '../utils';

export class PlayerManager {
  // Sprite animation state tracking
  private static spriteAnimations = new Map<string, {
    mixer: THREE.AnimationMixer;
    currentFrame: number;
    lastFrameTime: number;
    isMoving: boolean;
    direction: 'fr' | 'bk' | 'lf' | 'rt';
  }>();

  // Sprite mesh references for texture updates
  private static spriteMeshReferences = new Map<string, THREE.Mesh>();

  // Pre-loaded textures for sprite animation
  private static spriteTextures = new Map<string, {
    frame1: THREE.Texture;
    frame2: THREE.Texture;
  }>();

  // Store current sprite direction for each player
  private static spriteDirections = new Map<string, 'fr' | 'bk' | 'lf' | 'rt'>();

  // Health tracking for players (maps player ID to health info)
  private static playerHealthData = new Map<string, { 
    health: number; 
    maxHealth: number; 
    lastHealth: number; // Track previous health for damage detection
  }>();

  // Health bar references (maps player ID to health bar mesh)
  private static healthBarReferences = new Map<string, {
    container: THREE.Group;
    background: THREE.Mesh;
    foreground: THREE.Mesh;
  }>();

  // Store player references for accessing player data
  private static playerReferences = new Map<string, Player>();

  static generatePlayerColor(playerId: string): string {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', 
      '#ffeaa7', '#dda0dd', '#98d8c8', '#f7dc6f'
    ];
    const hash = playerId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Create sprite-based player model using character data
   */
  static createSpritePlayerModel(player: Player, isLocalPlayer: boolean = false): { 
    model: THREE.Object3D; 
    mixer?: THREE.AnimationMixer; 
    actions?: { [key: string]: THREE.AnimationAction } 
  } {
    const character = player.character;
    if (!character) {
      throw new Error('Player must have character data for sprite rendering');
    }

    // Create a group to hold the sprite
    const playerGroup = new THREE.Group();
    
    // Create the sprite geometry and material
    const spriteGeometry = new THREE.PlaneGeometry(1, 1.5); // Slightly taller than wide
    
    // Determine initial direction and frame
    const direction = isLocalPlayer ? 'bk' : 'fr'; // Local player shows back, others show front
    const frame = 1;
    
    // Pre-load both frame textures for animation
    const textureLoader = new THREE.TextureLoader();
    const frame1Path = `/assets/sprites/last-guardian-sprites/png/${character.type}${character.style}_${direction}1.png`;
    const frame2Path = `/assets/sprites/last-guardian-sprites/png/${character.type}${character.style}_${direction}2.png`;
    
    const frame1Texture = textureLoader.load(frame1Path, 
      () => {},
      undefined,
      (error) => console.error(`❌ Failed to load frame 1: ${frame1Path}`, error)
    );
    
    const frame2Texture = textureLoader.load(frame2Path, 
      () => {},
      undefined,
      (error) => console.error(`❌ Failed to load frame 2: ${frame2Path}`, error)
    );
    
    // Configure textures
    [frame1Texture, frame2Texture].forEach(texture => {
      texture.magFilter = THREE.NearestFilter; // Pixelated look for retro sprites
      texture.minFilter = THREE.NearestFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
    });
    
    // Store pre-loaded textures
    this.spriteTextures.set(player.id, {
      frame1: frame1Texture,
      frame2: frame2Texture
    });

    // Store initial direction
    this.spriteDirections.set(player.id, direction);
    
    // Create material with transparency using frame 1 initially
    const spriteMaterial = new THREE.MeshBasicMaterial({
      map: frame1Texture,
      transparent: true,
      alphaTest: 0.1, // Remove pixels with alpha below 0.1
      side: THREE.DoubleSide // Make sprite visible from both sides
    });
    
    // Create the sprite mesh
    const spriteMesh = new THREE.Mesh(spriteGeometry, spriteMaterial);
    spriteMesh.position.set(0, 0.75, 0); // Raise sprite to appear standing on ground
    
    // No initial rotation needed - sprite direction system will handle facing
    
    playerGroup.add(spriteMesh);
    
    // Set player position
    playerGroup.position.set(player.position.x, player.position.y, player.position.z);
    
    // Mark as player object
    playerGroup.userData.isPlayer = true;
    playerGroup.userData.playerId = player.id;
    playerGroup.userData.isLocalPlayer = isLocalPlayer;
    playerGroup.userData.spriteMesh = spriteMesh;
    playerGroup.userData.character = character;
    
    // Store player reference for later access
    this.playerReferences.set(player.id, player);
    
    // Initialize sprite animation state
    this.spriteAnimations.set(player.id, {
      mixer: new THREE.AnimationMixer(playerGroup), // Create mixer for consistency
      currentFrame: frame,
      lastFrameTime: Date.now(),
      isMoving: false,
      direction: direction
    });

    // Store sprite mesh reference for texture updates
    this.spriteMeshReferences.set(player.id, spriteMesh);

    return {
      model: playerGroup,
      mixer: this.spriteAnimations.get(player.id)?.mixer,
      actions: {} // No THREE.js actions for sprites, we'll handle animation manually
    };
  }

  static async createPlayerModel(player: Player, isLocalPlayer: boolean = false): Promise<{ 
    model: THREE.Object3D; 
    mixer?: THREE.AnimationMixer; 
    actions?: { [key: string]: THREE.AnimationAction } 
  }> {
    // Use sprite-based rendering if character data is available
    return this.createSpritePlayerModel(player, isLocalPlayer);
  }

  static updatePlayerAnimation(
    playerId: string, 
    playerData: PlayerUpdate, 
    playersAnimations: Map<string, PlayerAnimationData>
  ): void {
    const animData = playersAnimations.get(playerId);
    if (animData && animData.actions.StickMan_Run) {
      const walkAction = animData.actions.StickMan_Run;
      
      // Use the RECEIVED playerData.isMoving directly
      if (playerData.isMoving) {
        if (!walkAction.isRunning()) {
          walkAction.play();
        }
        walkAction.paused = false;
        walkAction.enabled = true;
        
        // Set animation direction based on movement with 300x speed
        if (playerData.movementDirection === 'backward') {
          walkAction.timeScale = -300; // Speed up by factor of 300
        } else {
          walkAction.timeScale = 300; // Speed up by factor of 300
        }
      } else {
        // Pause instead of stop to maintain smooth transitions
        walkAction.paused = true;
      }
    }
  }

  /**
   * Update sprite animation for a player with improved direction handling
   */
  static updateSpriteAnimation(playerId: string, isMoving: boolean): void {
    const animData = this.spriteAnimations.get(playerId);
    if (!animData) return;

    const now = Date.now();
    const FRAME_DURATION = 500; // ms per frame (slower than UI preview)

    // Update moving state
    animData.isMoving = isMoving;

    // Only animate frames if moving
    if (isMoving && (now - animData.lastFrameTime) > FRAME_DURATION) {
      // Toggle between frame 1 and 2
      animData.currentFrame = animData.currentFrame === 1 ? 2 : 1;
      animData.lastFrameTime = now;

      // Update the sprite texture
      this.updateSpriteTexture(playerId);
    } else if (!isMoving) {
      // Reset to frame 1 when not moving (idle pose)
      if (animData.currentFrame !== 1) {
        animData.currentFrame = 1;
        this.updateSpriteTexture(playerId);
      }
    }
  }

  /**
   * Update sprite direction and textures based on rotation and local player position
   */
  static updateSpriteDirection(
    playerId: string, 
    playerPosition: THREE.Vector3, 
    playerRotation: { x: number; y: number; z: number }, 
    localPlayerPosition: THREE.Vector3
  ): void {
    const spriteMeshRef = this.spriteMeshReferences.get(playerId);
    const animData = this.spriteAnimations.get(playerId);
    if (!spriteMeshRef || !animData) return;

    // Calculate the correct sprite direction
    const newDirection = this.calculateSpriteDirection(playerPosition, playerRotation, localPlayerPosition);
    const currentDirection = this.spriteDirections.get(playerId) || 'fr';

    // Only update if direction changed
    if (newDirection !== currentDirection) {
            
      // Update stored direction
      this.spriteDirections.set(playerId, newDirection);
      animData.direction = newDirection;

      // Load new textures for this direction
      this.loadDirectionTextures(playerId, newDirection);
    }
  }

  /**
   * Load textures for a specific direction
   */
  private static loadDirectionTextures(playerId: string, direction: 'fr' | 'bk' | 'lf' | 'rt'): void {
    const animData = this.spriteAnimations.get(playerId);
    const spriteMeshRef = this.spriteMeshReferences.get(playerId);
    if (!animData || !spriteMeshRef) return;

    // Get character data from the player group
    const playerGroup = spriteMeshRef.parent;
    if (!playerGroup || !playerGroup.userData.character) return;

    const character = playerGroup.userData.character;
    const textureLoader = new THREE.TextureLoader();

    // Load both frames for the new direction
    const frame1Path = `/assets/sprites/last-guardian-sprites/png/${character.type}${character.style}_${direction}1.png`;
    const frame2Path = `/assets/sprites/last-guardian-sprites/png/${character.type}${character.style}_${direction}2.png`;

    const frame1Texture = textureLoader.load(frame1Path, () => {
      // Update current texture if this is frame 1
      if (animData.currentFrame === 1) {
        this.updateSpriteTexture(playerId);
      }
    });
    
    const frame2Texture = textureLoader.load(frame2Path, () => {
      // Update current texture if this is frame 2
      if (animData.currentFrame === 2) {
        this.updateSpriteTexture(playerId);
      }
    });

    // Configure textures
    [frame1Texture, frame2Texture].forEach(texture => {
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
    });

    // Update stored textures
    this.spriteTextures.set(playerId, {
      frame1: frame1Texture,
      frame2: frame2Texture
    });
  }

  /**
   * Update the texture of a sprite player
   */
  private static updateSpriteTexture(playerId: string): void {
    const animData = this.spriteAnimations.get(playerId);
    if (!animData) return;

    // Find the sprite mesh reference
    const spriteMeshRef = this.spriteMeshReferences.get(playerId);
    if (!spriteMeshRef) return;

    // Get pre-loaded textures
    const textures = this.spriteTextures.get(playerId);
    if (!textures) return;

    // Get the material
    const material = spriteMeshRef.material as THREE.MeshBasicMaterial;
    
    // Switch to the appropriate frame texture
    const newTexture = animData.currentFrame === 1 ? textures.frame1 : textures.frame2;
    
    // Apply new texture (no loading needed since it's pre-loaded)
    material.map = newTexture;
    material.needsUpdate = true;
  }

  /**
   * Determine sprite direction based on player rotation and local player position
   */
  static calculateSpriteDirection(
    playerPosition: THREE.Vector3, 
    playerRotation: { x: number; y: number; z: number }, 
    localPlayerPosition: THREE.Vector3
  ): 'fr' | 'bk' | 'lf' | 'rt' {
    // Get the player's facing direction from their Y rotation
    const playerFacingAngle = playerRotation.y;
    
    // Calculate direction from player to local player
    const toLocalPlayer = new THREE.Vector3()
      .subVectors(localPlayerPosition, playerPosition)
      .normalize();
    
    // Convert to angle
    const toLocalPlayerAngle = Math.atan2(toLocalPlayer.x, toLocalPlayer.z);
    
    // Calculate the relative angle between where the player is facing and where the local player is
    let relativeAngle = toLocalPlayerAngle - playerFacingAngle;
    
    // Normalize angle to [-π, π]
    while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
    while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;
    
    // Determine sprite direction based on relative angle
    // Front: player is facing away from local player (3π/4 to π and -π to -3π/4)
    // Right: local player is to the right of where player is facing (π/4 to 3π/4)  
    // Back: player is facing towards local player (-π/4 to π/4)
    // Left: local player is to the left of where player is facing (-3π/4 to -π/4)
    
    const absAngle = Math.abs(relativeAngle);
    
    if (absAngle <= Math.PI / 4) {
      return 'bk'; // Player facing towards local player (back view)
    } else if (relativeAngle > Math.PI / 4 && relativeAngle <= 3 * Math.PI / 4) {
      return 'rt'; // Local player is to the right
    } else if (absAngle > 3 * Math.PI / 4) {
      return 'fr'; // Player facing away from local player (front view)
    } else {
      return 'lf'; // Local player is to the left
    }
  }

  /**
   * Make other player sprites face the local player (visual rotation)
   * This is separate from sprite texture direction which is based on actual player rotation
   */
  static updateOtherPlayerFacing(otherPlayerId: string, localPlayerPosition: THREE.Vector3): void {
    const spriteMeshRef = this.spriteMeshReferences.get(otherPlayerId);
    if (!spriteMeshRef) return;

    // Get the player group (parent of sprite mesh)
    const playerGroup = spriteMeshRef.parent;
    if (!playerGroup) return;

    // Calculate direction from other player to local player
    const otherPlayerPosition = playerGroup.position;
    const direction = new THREE.Vector3()
      .subVectors(localPlayerPosition, otherPlayerPosition)
      .normalize();

    // Calculate angle and make sprite face the local player
    const angle = Math.atan2(direction.x, direction.z);
    spriteMeshRef.rotation.y = angle;
  }

  /**
   * Update all other players to face the local player (visual rotation)
   * This is separate from sprite texture direction which is based on actual player rotation
   */
  static updateAllOtherPlayersFacing(localPlayerPosition: THREE.Vector3): void {
    this.spriteMeshReferences.forEach((spriteMesh, playerId) => {
      // Skip if this is the local player
      if (spriteMesh.parent && !spriteMesh.parent.userData.isLocalPlayer) {
        this.updateOtherPlayerFacing(playerId, localPlayerPosition);
      }
    });
  }
  static updateSpritePlayerPosition(player: Player, playerData: PlayerUpdate): void {
    // Update basic position data
    player.position = playerData.position;
    if (playerData.rotation) {
      player.rotation = playerData.rotation;
    }
    
    // Update movement state for animation
    player.isMoving = playerData.isMoving;
    player.movementDirection = playerData.movementDirection;
    
    if (player.mesh) {
      // Update position
      player.mesh.position.set(
        playerData.position.x,
        playerData.position.y,
        playerData.position.z
      );

      // Update sprite animation if this is a sprite-based player
      if (player.mesh.userData.spriteMesh) {
        this.updateSpriteAnimation(player.id, playerData.isMoving || false);
      }
      
      // Force a render update
      if (player.mesh.parent) {
        player.mesh.updateMatrixWorld(true);
      }
    }
  }

  static updatePlayerPosition(player: Player, playerData: PlayerUpdate): void {
    // Check if this is a sprite-based player
    if (player.mesh && player.mesh.userData.spriteMesh) {
      this.updateSpritePlayerPosition(player, playerData);
      return;
    }
    
    // Handle 3D model players (original implementation)
    player.position = playerData.position;
    if (playerData.rotation) {
      player.rotation = playerData.rotation;
    }
    
    // Update movement state for animation
    player.isMoving = playerData.isMoving;
    player.movementDirection = playerData.movementDirection;
    
    if (player.mesh) {
      player.mesh.position.set(
        playerData.position.x,
        playerData.position.y,
        playerData.position.z
      );
      if (playerData.rotation) {
        // Apply only Y rotation with Math.PI offset
        player.mesh.rotation.set(
          0,
          playerData.rotation.y + Math.PI,
          0
        );
      }
      
      // Force a render update
      if (player.mesh.parent) {
        player.mesh.updateMatrixWorld(true);
      }
    }
  }

  static disposePlayerMesh(mesh: THREE.Object3D): void {
    // Clean up sprite references if this is a sprite player
    if (mesh.userData.playerId) {
      const playerId = mesh.userData.playerId;
      
      // Clean up pre-loaded textures
      const textures = this.spriteTextures.get(playerId);
      if (textures) {
        textures.frame1.dispose();
        textures.frame2.dispose();
        this.spriteTextures.delete(playerId);
      }
      
      // Clean up other references
      this.spriteMeshReferences.delete(playerId);
      this.spriteAnimations.delete(playerId);
      this.playerReferences.delete(playerId);
      
      // Clean up health data
      this.removeHealthBar(playerId);
      this.playerHealthData.delete(playerId);
    }

    if (mesh instanceof THREE.Mesh) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    } else if (mesh instanceof THREE.Group) {
      // Dispose of all meshes in the group
      mesh.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            (child.material as THREE.Material).dispose();
          }
        }
      });
    }
  }

  /**
   * Update player health data and create/update health bar if needed
   */
  static updatePlayerHealth(
    playerId: string, 
    newHealth: number | undefined, 
    maxHealth: number | undefined,
    particleSystem?: any
  ): void {
    console.log('🔍 PlayerManager.updatePlayerHealth called:', {
      playerId,
      newHealth,
      maxHealth,
      hasParticleSystem: !!particleSystem
    });

    // Skip if no health data provided
    if (newHealth === undefined || newHealth === null) {
      console.log('⚠️ Skipping health update - no valid health value provided for player:', playerId);
      return;
    }

    // If maxHealth is not provided, assume a default of 100
    const effectiveMaxHealth = maxHealth !== undefined ? maxHealth : 100;
    const currentHealthData = this.playerHealthData.get(playerId);
    const player = this.playerReferences.get(playerId);
    
    if (!player || !player.mesh) {
      console.log('⚠️ Skipping health update - player or mesh not found:', {
        hasPlayer: !!player,
        hasMesh: !!player?.mesh,
        playerId
      });
      return;
    }

    // Check for damage (new health < old health)
    if (currentHealthData && newHealth < currentHealthData.health && particleSystem) {
      console.log('🩸 Player took damage:', {
        playerId,
        oldHealth: currentHealthData.health,
        newHealth,
        damage: currentHealthData.health - newHealth
      });
      
      // Create damage particle effect at player position
      const playerPosition = player.mesh.position.clone();
      playerPosition.y += 1.0; // Position above player
      particleSystem.createDamageEffect(playerPosition);
    }

    // Update health data
    this.playerHealthData.set(playerId, {
      health: newHealth,
      maxHealth: effectiveMaxHealth,
      lastHealth: currentHealthData ? currentHealthData.health : newHealth
    });

    // Update player object
    player.health = newHealth;
    player.maxHealth = effectiveMaxHealth;

    // Create or update health bar only if health is below max
    if (newHealth < effectiveMaxHealth) {
      this.createOrUpdateHealthBar(playerId, newHealth, effectiveMaxHealth, player.mesh);
    } else {
      // Remove health bar if at full health
      this.removeHealthBar(playerId);
    }
  }

  /**
   * Create or update health bar for a player
   */
  static createOrUpdateHealthBar(
    playerId: string, 
    health: number, 
    maxHealth: number, 
    playerMesh: THREE.Object3D
  ): void {
    console.log('🔨 createOrUpdateHealthBar called for player:', {
      playerId,
      health,
      maxHealth,
      healthPercentage: health / maxHealth
    });

    let healthBarData = this.healthBarReferences.get(playerId);

    if (!healthBarData) {
      console.log('✨ Creating new health bar for player:', playerId);
      
      // Create new health bar
      const container = new THREE.Group();
      
      // Background (red bar)
      const backgroundGeometry = new THREE.PlaneGeometry(3, 0.3);
      const backgroundMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x660000, 
        transparent: true, 
        opacity: 0.9,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
      
      // Foreground (green bar)
      const foregroundGeometry = new THREE.PlaneGeometry(3, 0.25);
      const foregroundMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00cc00, 
        transparent: true, 
        opacity: 1.0,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const foreground = new THREE.Mesh(foregroundGeometry, foregroundMaterial);
      
      // Position foreground slightly in front of background
      foreground.position.z = 0.001;
      
      container.add(background);
      container.add(foreground);
      
      // Position health bar above player
      container.position.y = 3.0;
      
      // Set render order to ensure health bars render on top
      container.renderOrder = 999;
      background.renderOrder = 999;
      foreground.renderOrder = 999;
      
      // Prevent frustum culling
      container.frustumCulled = false;
      background.frustumCulled = false;
      foreground.frustumCulled = false;
      
      // Set a very large bounding sphere to prevent culling
      container.userData.isHealthBar = true;
      const largeBoundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1000);
      background.geometry.boundingSphere = largeBoundingSphere;
      foreground.geometry.boundingSphere = largeBoundingSphere;
      
      // Also prevent culling on the player mesh itself
      playerMesh.frustumCulled = false;
      
      // Set initial rotation to face forward
      container.rotation.set(0, 0, 0);
      
      // Add to player mesh
      playerMesh.add(container);
      
      healthBarData = {
        container,
        background,
        foreground
      };
      
      this.healthBarReferences.set(playerId, healthBarData);
      
      console.log('✅ Created health bar for player:', {
        playerId,
        containerUuid: container.uuid,
        parentUuid: playerMesh.uuid,
        position: container.position,
        childrenCount: playerMesh.children.length
      });
    } else {
      console.log('🔄 Updating existing health bar for player:', playerId);
    }

    // Update health bar width based on health percentage
    const healthPercentage = Math.max(0, Math.min(1, health / maxHealth));
    
    // Use scaling and keep centered to avoid frustum culling issues
    healthBarData.foreground.scale.x = healthPercentage;
    healthBarData.foreground.position.x = 0;
    
    // Keep health bar color always green
    const healthMaterial = healthBarData.foreground.material as THREE.MeshBasicMaterial;
    healthMaterial.color.setHex(0x00cc00);
    
    console.log('📊 Player health bar updated:', {
      playerId,
      healthPercentage
    });
  }

  /**
   * Remove health bar for a player
   */
  static removeHealthBar(playerId: string): void {
    const healthBarData = this.healthBarReferences.get(playerId);
    
    if (healthBarData) {
      // Remove from player mesh
      if (healthBarData.container.parent) {
        healthBarData.container.parent.remove(healthBarData.container);
      }
      
      // Dispose materials and geometry
      healthBarData.background.geometry.dispose();
      (healthBarData.background.material as THREE.Material).dispose();
      healthBarData.foreground.geometry.dispose();
      (healthBarData.foreground.material as THREE.Material).dispose();
      
      this.healthBarReferences.delete(playerId);
    }
  }

  /**
   * Update all player health bars to face the camera
   */
  static updateAllPlayerHealthBarsFacing(cameraPosition: THREE.Vector3): void {
    this.healthBarReferences.forEach((healthBarData, playerId) => {
      if (healthBarData.container && healthBarData.container.parent) {
        // Get world position of the health bar
        const worldPosition = new THREE.Vector3();
        healthBarData.container.getWorldPosition(worldPosition);
        
        // Calculate direction from health bar to camera (only Y rotation)
        const direction = new THREE.Vector3().subVectors(cameraPosition, worldPosition);
        direction.y = 0; // Ignore Y difference to keep health bar level
        direction.normalize();
        
        // Calculate Y rotation angle to face camera
        const targetAngle = Math.atan2(direction.x, direction.z);
        const currentAngle = healthBarData.container.rotation.y;
        
        // Only update rotation if the angle difference is significant
        const angleDifference = Math.abs(targetAngle - currentAngle);
        const normalizedDifference = Math.min(angleDifference, 2 * Math.PI - angleDifference);
        
        if (normalizedDifference > 0.1) {
          // Apply only Y rotation to prevent flipping
          healthBarData.container.rotation.set(0, targetAngle, 0);
        }
      }
    });
  }

  /**
   * Clear all player health data (called when changing floors)
   */
  static clearAllPlayerHealthData(): void {
    console.log('🧹 Clearing all player health data');
    
    // Remove all health bars
    this.healthBarReferences.forEach((healthBarData, playerId) => {
      this.removeHealthBar(playerId);
    });
    
    // Clear health tracking
    this.playerHealthData.clear();
    this.healthBarReferences.clear();
  }
}
