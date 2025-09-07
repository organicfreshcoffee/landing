import * as THREE from 'three';
import { PlayerAnimationData, CharacterData, SpellActionData } from '../types';
import { CollisionSystem } from './collisionSystem';
import { GameHUD } from '../ui/gameHUD';
import { PlayerManager } from './playerManager';

/**
 * MovementController handles player movement, keyboard input, and camera controls.
 * 
 * Debug Controls:
 * - Tab: Toggle admin mode (fly mode)
 * - 9: Trigger debug death and respawn sequence
 */
export class MovementController {
  private keysPressed = new Set<string>();
  private localPlayerRotation = { x: 0, y: 0, z: 0 };
  private isMoving = false;
  private movementDirection: 'forward' | 'backward' | 'none' = 'none';
  private lastUpdateTime = 0;
  private lastSentMovementState = false;
  private clock = new THREE.Clock();
  
  // Animation timing properties to smooth out delta inconsistencies
  private animationClock = new THREE.Clock();
  private targetFrameTime = 1 / 60; // Target 60 FPS for smooth animation
  private maxFrameTime = 1 / 45; // Cap at 45 FPS to prevent large jumps (more conservative)
  private lastAnimationTime = 0; // Track time for smoother interpolation
  
  // Physics and admin mode properties
  private isAdminMode = false;
  private velocity = new THREE.Vector3(0, 0, 0);
  private isGrounded = false;
  
  // Physics constants
  private readonly GRAVITY = -35; // Units per second squared
  private readonly TERMINAL_VELOCITY = -50; // Maximum fall speed
  private readonly ADMIN_SPEED_MULTIPLIER = 2; // Admin mode speed multiplier
  
  private collisionSystem: CollisionSystem;
  private gameHUD: GameHUD;

  // Weapon tracking for attack types
  private currentEquippedWeapon: string | null = null;
  private weaponType: 'magic' | 'melee' | 'range' | null = null;
  private lastInventoryCheck = 0;
  private inventoryCheckCooldown = 5000; // Check inventory every 5 seconds if needed

  constructor(
    private localPlayerRef: { current: THREE.Object3D | null },
    private cameraRef: { current: THREE.PerspectiveCamera | null },
    private localPlayerMixer: { current: THREE.AnimationMixer | null },
    private localPlayerActions: { current: { [key: string]: THREE.AnimationAction } },
    private playersAnimations: Map<string, PlayerAnimationData>,
    private isConnected: () => boolean,
    private sendMovementUpdate: (data: any) => void,
    private selectedCharacter: CharacterData,
    private onSpellCast?: (fromPosition: THREE.Vector3, toPosition: THREE.Vector3) => void,
    private sendPlayerAction?: (action: string, data?: any, target?: string) => void,
    private onDebugDeath?: () => void,
    private onOpenGraphViewer?: () => void,
    private onPunchCast?: (fromPosition: THREE.Vector3, toPosition: THREE.Vector3) => void,
    private onMeleeCast?: (fromPosition: THREE.Vector3, toPosition: THREE.Vector3) => void,
    private onRangeCast?: (fromPosition: THREE.Vector3, toPosition: THREE.Vector3) => void,
    private getServerAddress?: () => string | null,
    private onStaminaConsume?: (amount: number) => boolean,
    private onManaConsume?: (amount: number) => boolean,
    private onShowToast?: (message: string, type?: 'error' | 'warning' | 'info') => void
  ) {
    this.setupKeyboardListeners();
    this.setupMouseListeners();
    this.collisionSystem = CollisionSystem.getInstance();
    this.gameHUD = GameHUD.getInstance();
  }

  private setupKeyboardListeners(): void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!this.isConnected()) return;

      // Handle debug death (key "9")
      if (event.code === 'Digit9') {
        event.preventDefault();
                if (this.onDebugDeath) {
          this.onDebugDeath();
        }
        return;
      }

      // Handle admin mode toggle
      if (event.code === 'Tab') {
        event.preventDefault();
        this.toggleAdminMode();
        return;
      }

      // Handle graph viewer (key "P")
      if (event.code === 'KeyP') {
        event.preventDefault();
        if (this.onOpenGraphViewer) {
          this.onOpenGraphViewer();
        }
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
      }

      this.keysPressed.add(event.code);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      this.keysPressed.delete(event.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  }

  private setupMouseListeners(): void {
    let isPointerLocked = false;

    const handleMouseMove = (event: MouseEvent) => {
      if (!isPointerLocked) return;
      
      const sensitivity = 0.002;
      this.localPlayerRotation.y -= event.movementX * sensitivity;
      this.localPlayerRotation.x -= event.movementY * sensitivity;
      
      // Limit vertical rotation
      this.localPlayerRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.localPlayerRotation.x));
      
      // Apply only Y rotation to local player
      if (this.localPlayerRef.current) {
        this.localPlayerRef.current.rotation.y = this.localPlayerRotation.y + Math.PI;
        this.localPlayerRef.current.rotation.x = 0;
        this.localPlayerRef.current.rotation.z = 0;
      }
    };

    const handleMouseClick = (event: MouseEvent) => {
      console.log('🖱️ Mouse click detected:', {
        button: event.button,
        pointerLocked: isPointerLocked,
        connected: this.isConnected()
      });
      
      if (!isPointerLocked || !this.isConnected()) return;
      
      // Only handle left clicks for attacks
      if (event.button === 0) {
        event.preventDefault(); // Prevent other handlers
        this.performAttackBasedOnEquippedWeapon();
      }
    };

    const handlePointerLockChange = () => {
      isPointerLocked = document.pointerLockElement !== null;
          };

    const handleCanvasClick = (canvas: HTMLCanvasElement) => {
      if (!isPointerLocked) {
                canvas.requestPointerLock();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    // Store the click handler for external setup
    (this as any).handleCanvasClick = handleCanvasClick;
    (this as any).handleMouseClick = handleMouseClick; // Store the mouse click handler too
  }

  updateMovement(userId: string): void {
    if (!this.localPlayerRef.current || !this.cameraRef.current || !this.isConnected()) return;
    
    const delta = this.clock.getDelta();
    const moveSpeed = this.isAdminMode ? 0.5 * this.ADMIN_SPEED_MULTIPLIER : 0.5;
    const localPlayer = this.localPlayerRef.current;
    const camera = this.cameraRef.current;
    let moved = false;
    
    // Store old position
    const oldPosition = localPlayer.position.clone();
    const oldRotation = { ...this.localPlayerRotation };
    
    // Calculate movement direction based on player rotation
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.localPlayerRotation.y);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.localPlayerRotation.y);

    // Track movement direction for animation
    let newMovementDirection: 'forward' | 'backward' | 'none' = 'none';
    let horizontalMovement = false;
    
    // Calculate intended movement
    const movement = new THREE.Vector3(0, 0, 0);
    
    // Track individual key states for better direction determination
    const wPressed = this.keysPressed.has('KeyW');
    const sPressed = this.keysPressed.has('KeyS');
    const aPressed = this.keysPressed.has('KeyA');
    const dPressed = this.keysPressed.has('KeyD');
    
    if (wPressed) {
      movement.add(forward.clone().multiplyScalar(moveSpeed));
      moved = true;
      horizontalMovement = true;
      newMovementDirection = 'forward';
    }
    if (sPressed) {
      movement.add(forward.clone().multiplyScalar(-moveSpeed));
      moved = true;
      horizontalMovement = true;
      // S key takes priority for backward direction
      newMovementDirection = 'backward';
    }
    if (aPressed) {
      movement.add(right.clone().multiplyScalar(-moveSpeed));
      moved = true;
      horizontalMovement = true;
      // Only set forward if no W/S keys are pressed
      if (!wPressed && !sPressed) {
        newMovementDirection = 'forward';
      }
    }
    if (dPressed) {
      movement.add(right.clone().multiplyScalar(moveSpeed));
      moved = true;
      horizontalMovement = true;
      // Only set forward if no W/S keys are pressed
      if (!wPressed && !sPressed) {
        newMovementDirection = 'forward';
      }
    }

    // Set movement direction based on horizontal movement only
    this.movementDirection = newMovementDirection;

    // Handle vertical movement based on admin mode
    if (this.isAdminMode) {
      // Admin mode: direct vertical control
      if (this.keysPressed.has('Space')) {
        movement.add(up.clone().multiplyScalar(moveSpeed));
        moved = true;
      }
      if (this.keysPressed.has('ShiftLeft')) {
        movement.add(up.clone().multiplyScalar(-moveSpeed));
        moved = true;
      }
    } else {
      // Normal mode: gravity only (no jumping)
      this.applyGravity(delta);
    }

    // Apply movement with collision detection
    this.applyMovementWithCollision(localPlayer, movement, oldPosition);

    // Update HUD if in admin mode
    if (this.isAdminMode && this.localPlayerRef.current) {
      this.gameHUD.updatePlayerInfo(
        this.localPlayerRef.current.position, 
        this.velocity, 
        this.isGrounded, 
        false // No jumping capability
      );
    }

    // Update camera
    this.updateCamera(camera, localPlayer.position);

    // Handle animations (use moved for walking animation but only animate on horizontal movement)
    this.updateAnimations(moved);

    // Send updates to server
    this.sendMovementUpdateIfNeeded(userId, moved, oldRotation);
  }

  private toggleAdminMode(): void {
    this.isAdminMode = !this.isAdminMode;
    
    if (this.isAdminMode) {
      // Reset physics when entering admin mode
      this.velocity.set(0, 0, 0);
      this.isGrounded = false;
      this.gameHUD.updateAdminMode(true);
      this.gameHUD.showMessage('🔧 Admin Mode Enabled', 2000);
          } else {
      // When exiting admin mode, snap to ground level if above ground
      if (this.localPlayerRef.current) {
        const floorHeight = this.collisionSystem.getVisualFloorHeight(this.localPlayerRef.current.position);
        if (this.localPlayerRef.current.position.y > floorHeight) {
          this.localPlayerRef.current.position.y = floorHeight;
        }
        this.velocity.set(0, 0, 0);
      }
      this.gameHUD.updateAdminMode(false);
      this.gameHUD.showMessage('👤 Normal Mode Enabled', 2000);
          }
  }

  private applyGravity(delta: number): void {
    if (!this.localPlayerRef.current) return;

    // Apply gravity
    this.velocity.y += this.GRAVITY * delta;
    
    // Clamp to terminal velocity
    if (this.velocity.y < this.TERMINAL_VELOCITY) {
      this.velocity.y = this.TERMINAL_VELOCITY;
    }

    // Apply vertical velocity
    const newY = this.localPlayerRef.current.position.y + this.velocity.y * delta;
    const floorHeight = this.collisionSystem.getVisualFloorHeight(this.localPlayerRef.current.position);
    
    // Check if we hit the ground
    if (newY <= floorHeight) {
      this.localPlayerRef.current.position.y = floorHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.localPlayerRef.current.position.y = newY;
      this.isGrounded = false;
    }
  }

  private applyMovementWithCollision(
    localPlayer: THREE.Object3D, 
    movement: THREE.Vector3, 
    oldPosition: THREE.Vector3
  ): void {
    if (movement.lengthSq() === 0) return;

    if (this.isAdminMode) {
      // Admin mode: no collision detection
      localPlayer.position.add(movement);
    } else {
      // Normal mode: apply collision detection with sliding
      const newPosition = oldPosition.clone().add(movement);
      
      // Use sweep test for more reliable collision detection
      const collisionResult = this.collisionSystem.sweepTestCollision(oldPosition, newPosition);
      
      if (collisionResult.collided) {
        // Try sliding along walls instead of stopping completely
        const correctedPosition = collisionResult.correctedPosition;
        
        if (collisionResult.collisionDirection === 'x') {
          // X collision - try to slide in Z direction
          const slideMovement = new THREE.Vector3(0, movement.y, movement.z);
          const slideTarget = correctedPosition.clone().add(slideMovement);
          const slideResult = this.collisionSystem.sweepTestCollision(correctedPosition, slideTarget);
          
          if (!slideResult.collided) {
            localPlayer.position.copy(slideTarget);
          } else {
            localPlayer.position.copy(correctedPosition);
          }
        } else if (collisionResult.collisionDirection === 'z') {
          // Z collision - try to slide in X direction
          const slideMovement = new THREE.Vector3(movement.x, movement.y, 0);
          const slideTarget = correctedPosition.clone().add(slideMovement);
          const slideResult = this.collisionSystem.sweepTestCollision(correctedPosition, slideTarget);
          
          if (!slideResult.collided) {
            localPlayer.position.copy(slideTarget);
          } else {
            localPlayer.position.copy(correctedPosition);
          }
        } else if (collisionResult.collisionDirection === 'y') {
          // Ceiling collision - stop upward movement but allow horizontal
          localPlayer.position.copy(correctedPosition);
          if (this.velocity.y > 0) {
            this.velocity.y = 0;
          }
        } else {
          // General collision - use corrected position
          localPlayer.position.copy(correctedPosition);
        }
      } else {
        // No collision, apply normal movement
        localPlayer.position.copy(newPosition);
      }
    }
  }

  /**
   * Update collision system data from scene
   */
  updateCollisionData(scene: THREE.Scene): void {
    this.collisionSystem.updateCollisionData(scene);
  }

  /**
   * Get the collision system instance
   */
  getCollisionSystem(): CollisionSystem {
    return this.collisionSystem;
  }

  private updateCamera(camera: THREE.PerspectiveCamera, playerPos: THREE.Vector3): void {
    const cameraHeight = 3;
    const cameraDistance = 1.5;
    
    // Calculate camera position based on player's Y rotation
    const cameraX = playerPos.x + Math.sin(this.localPlayerRotation.y) * cameraDistance;
    const cameraZ = playerPos.z + Math.cos(this.localPlayerRotation.y) * cameraDistance;
    
    camera.position.set(
      cameraX,
      playerPos.y + cameraHeight,
      cameraZ
    );
    
    // Calculate look-at point
    const lookDistance = 10;
    const lookDirection = new THREE.Vector3(
      -Math.sin(this.localPlayerRotation.y),
      Math.sin(this.localPlayerRotation.x),
      -Math.cos(this.localPlayerRotation.y)
    );
    
    const lookAtPoint = new THREE.Vector3(
      playerPos.x + lookDirection.x * lookDistance,
      playerPos.y + cameraHeight + lookDirection.y * lookDistance,
      playerPos.z + lookDirection.z * lookDistance
    );
    
    camera.lookAt(lookAtPoint);
  }

  private updateAnimations(moved: boolean): void {
    const wasMoving = this.isMoving;
    this.isMoving = moved;
    
    // Handle sprite animation for local player
    if (this.localPlayerRef.current && this.localPlayerRef.current.userData.spriteMesh) {
      // This is a sprite-based player
      const userId = this.localPlayerRef.current.userData.playerId;
      if (userId) {
        PlayerManager.updateSpriteAnimation(userId, this.isMoving);
      }
      return; // Skip 3D animation for sprite players
    }
    
    // Use a separate clock for animations to ensure consistent timing
    // regardless of collision detection performance
    const rawDelta = this.animationClock.getDelta();
    
    // Improved delta time smoothing for more stable animations
    const now = performance.now() / 1000;
    let smoothDelta = rawDelta;
    
    if (this.lastAnimationTime > 0) {
      const expectedDelta = now - this.lastAnimationTime;
      // Use exponential smoothing to reduce jitter
      smoothDelta = Math.min(expectedDelta, this.maxFrameTime);
      // Apply additional smoothing for very small or very large deltas
      if (smoothDelta < 0.01) smoothDelta = this.targetFrameTime;
      if (smoothDelta > this.maxFrameTime) smoothDelta = this.maxFrameTime;
    }
    
    this.lastAnimationTime = now;
    
    // Control local player animation (3D models only)
    if (this.localPlayerMixer.current && this.localPlayerActions.current.StickMan_Run) {
      const walkAction = this.localPlayerActions.current.StickMan_Run;
      
      // Only animate walking if there's horizontal movement (not just vertical)
      const shouldAnimate = this.movementDirection !== 'none';
      
      // Add occasional debug logging for local player
      if (Math.random() < 0.005) { // Reduced logging frequency
        console.log('🚶 Local player animation update:', {
          shouldAnimate,
          movementDirection: this.movementDirection,
          isRunning: walkAction.isRunning(),
          paused: walkAction.paused,
          timeScale: walkAction.timeScale,
          time: walkAction.time.toFixed(3),
          smoothDelta: smoothDelta.toFixed(4)
        });
      }
      
      if (shouldAnimate) {
        // Start or resume animation
        if (!walkAction.isRunning()) {
          walkAction.reset();
          walkAction.play();
        }
        walkAction.paused = false;
        
        // Set reasonable animation speed based on direction
        if (this.movementDirection === 'backward') {
          walkAction.timeScale = -1.5; // Slightly faster backward walk
        } else if (this.movementDirection === 'forward') {
          walkAction.timeScale = 1.5; // Slightly faster forward walk
        }
        
        // Ensure animation loops
        walkAction.setLoop(THREE.LoopRepeat, Infinity);
      } else {
        // Stop animation smoothly
        if (walkAction.isRunning()) {
          walkAction.paused = true;
        }
      }
      
      // Use smooth delta for consistent animation timing
      this.localPlayerMixer.current.update(smoothDelta);
    } else if (Math.random() < 0.005) {
      console.log('⚠️ Local player mixer or action not available:', {
        hasMixer: !!this.localPlayerMixer.current,
        hasAction: !!this.localPlayerActions.current.StickMan_Run
      });
    }
    
    // Update other players' animation mixers with smooth delta
    this.playersAnimations.forEach((animData) => {
      animData.mixer.update(smoothDelta);
    });
  }

  private sendMovementUpdateIfNeeded(userId: string, moved: boolean, oldRotation: any): void {
    const now = Date.now();
    const movementChanged = moved || Math.abs(oldRotation.y - this.localPlayerRotation.y) > 0.01;
    const movementStateChanged = this.isMoving !== this.lastSentMovementState;
    
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    const shouldSendHeartbeat = !this.isMoving && this.lastSentMovementState && timeSinceLastUpdate > 300;
    const shouldSendImmediate = movementChanged && timeSinceLastUpdate > 50;
    
    if (shouldSendImmediate || shouldSendHeartbeat || movementStateChanged) {
      this.lastUpdateTime = now;
      this.lastSentMovementState = this.isMoving;
      
      const moveMessage = {
        type: 'player_move',
        data: {
          playerId: userId,
          position: {
            x: this.localPlayerRef.current!.position.x,
            y: this.localPlayerRef.current!.position.y,
            z: this.localPlayerRef.current!.position.z
          },
          rotation: {
            x: 0,
            y: this.localPlayerRotation.y,
            z: 0
          },
          isMoving: this.isMoving,
          movementDirection: this.movementDirection,
          character: this.selectedCharacter
        }
      };
      
            this.sendMovementUpdate(moveMessage);
    }
  }

  setupCanvasClickHandler(canvas: HTMLCanvasElement): void {
    if ((this as any).handleCanvasClick && (this as any).handleMouseClick) {
      canvas.addEventListener('click', (event) => {
        // Only handle canvas click for pointer lock if pointer is not already locked
        if (document.pointerLockElement === null) {
          (this as any).handleCanvasClick(canvas);
        } else {
          // If pointer is locked, handle spell casting
          (this as any).handleMouseClick(event);
        }
      });
    }
  }

  /**
   * Update the selected character data (useful when character changes after game start)
   */
  updateSelectedCharacter(character: CharacterData): void {
        this.selectedCharacter = character;
  }

  private castSpell(): void {
    if (!this.localPlayerRef.current || !this.cameraRef.current || !this.onSpellCast) {
      console.log('❌ Spell cast failed - missing requirements:', {
        hasPlayer: !!this.localPlayerRef.current,
        hasCamera: !!this.cameraRef.current,
        hasCallback: !!this.onSpellCast
      });
      return;
    }

    // Check if player has enough mana
    const manaCost = 15;
    console.log('🔍 Spell cast - checking mana:', {
      manaCost,
      hasOnManaConsume: !!this.onManaConsume,
      hasOnShowToast: !!this.onShowToast
    });
    
    if (this.onManaConsume && !this.onManaConsume(manaCost)) {
      console.log('⚠️ Spell cast blocked - insufficient mana');
      this.onShowToast?.('Out of mana', 'warning');
      return;
    }
    
    console.log('✅ Spell cast - mana consumed successfully');

    
    // Get the actual player model's world position
    const playerWorldPosition = new THREE.Vector3();
    this.localPlayerRef.current.getWorldPosition(playerWorldPosition);
    
    // Start spell from player's chest/hand level
    const spellStartPosition = playerWorldPosition.clone();
    spellStartPosition.y += 1.2;

    // Use the player's movement rotation (which should match facing direction)
    // The localPlayerRotation.y represents where the player is facing
    const playerFacingDirection = this.localPlayerRotation.y;
    
    // Calculate spell direction - try both directions to see which works
    const direction = new THREE.Vector3(0, 0, -1); // Try negative Z (which is typically "forward" in Three.js)
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerFacingDirection);
    
    // Move the spell start position forward from the player model
    const forwardOffset = direction.clone().multiplyScalar(0.8);
    spellStartPosition.add(forwardOffset);

    // Calculate target position
    const spellRange = 10;
    const targetPosition = spellStartPosition.clone().add(direction.clone().multiplyScalar(spellRange));

    console.log('🎯 Spell cast debug:', {
      playerWorldPos: playerWorldPosition,
      spellStart: spellStartPosition,
      target: targetPosition,
      playerRotation: playerFacingDirection,
      direction: direction
    });

    // Send player action to other clients
    if (this.sendPlayerAction) {
      // Calculate potential hit area for server-side collision detection
      const spellRadius = 1.0; // Radius around the spell path for hit detection
      const currentPlayerPosition = this.localPlayerRef.current!.position;
      
      const spellActionData: SpellActionData = {
        fromPosition: {
          x: spellStartPosition.x,
          y: spellStartPosition.y,
          z: spellStartPosition.z
        },
        toPosition: {
          x: targetPosition.x,
          y: targetPosition.y,
          z: targetPosition.z
        },
        direction: {
          x: direction.x,
          y: direction.y,
          z: direction.z
        },
        range: spellRange,
        timestamp: Date.now(),
        // Additional data for server-side hit detection
        casterPosition: {
          x: currentPlayerPosition.x,
          y: currentPlayerPosition.y,
          z: currentPlayerPosition.z
        },
        spellRadius: spellRadius
      };

            this.sendPlayerAction('spell_cast', spellActionData);
    }

    // Call the spell cast callback for local visual effect
    this.onSpellCast(spellStartPosition, targetPosition);
  }

  private castPunch(): void {
    if (!this.localPlayerRef.current || !this.cameraRef.current || !this.onPunchCast) {
      console.log('❌ Punch attack failed - missing requirements:', {
        hasPlayer: !!this.localPlayerRef.current,
        hasCamera: !!this.cameraRef.current,
        hasCallback: !!this.onPunchCast
      });
      return;
    }

    // Check if player has enough stamina
    const staminaCost = 5;
    console.log('🔍 Punch attack - checking stamina:', {
      staminaCost,
      hasOnStaminaConsume: !!this.onStaminaConsume,
      hasOnShowToast: !!this.onShowToast
    });
    
    if (this.onStaminaConsume && !this.onStaminaConsume(staminaCost)) {
      console.log('⚠️ Punch attack blocked - insufficient stamina');
      this.onShowToast?.('Out of stamina', 'warning');
      return;
    }
    
    console.log('✅ Punch attack - stamina consumed successfully');

    // Get the actual player model's world position
    const playerWorldPosition = new THREE.Vector3();
    this.localPlayerRef.current.getWorldPosition(playerWorldPosition);
    
    // Start punch from player's fist level
    const punchStartPosition = playerWorldPosition.clone();
    punchStartPosition.y += 1.0; // Lower than spell, fist level

    // Use the player's movement rotation for facing direction
    const playerFacingDirection = this.localPlayerRotation.y;
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerFacingDirection);
    
    // Move the punch start position forward from the player model
    const forwardOffset = direction.clone().multiplyScalar(0.5);
    punchStartPosition.add(forwardOffset);

    // Calculate target position - shorter range for punch
    const punchRange = 1.5; // Reduced from 3 to match particle effect
    const targetPosition = punchStartPosition.clone().add(direction.clone().multiplyScalar(punchRange));

    // Send player action to other clients
    if (this.sendPlayerAction) {
      const punchActionData = {
        fromPosition: {
          x: punchStartPosition.x,
          y: punchStartPosition.y,
          z: punchStartPosition.z
        },
        toPosition: {
          x: targetPosition.x,
          y: targetPosition.y,
          z: targetPosition.z
        },
        direction: {
          x: direction.x,
          y: direction.y,
          z: direction.z
        },
        range: punchRange,
        timestamp: Date.now()
      };

      this.sendPlayerAction('punch_attack', punchActionData);
    }

    // Call the punch cast callback for local visual effect
    this.onPunchCast(punchStartPosition, targetPosition);
  }

  private castMelee(): void {
    if (!this.localPlayerRef.current || !this.cameraRef.current || !this.onMeleeCast) {
      console.log('❌ Melee attack failed - missing requirements:', {
        hasPlayer: !!this.localPlayerRef.current,
        hasCamera: !!this.cameraRef.current,
        hasCallback: !!this.onMeleeCast
      });
      return;
    }

    // Check if player has enough stamina
    const staminaCost = 10;
    if (this.onStaminaConsume && !this.onStaminaConsume(staminaCost)) {
      this.onShowToast?.('Out of stamina', 'warning');
      return;
    }

    // Get the actual player model's world position
    const playerWorldPosition = new THREE.Vector3();
    this.localPlayerRef.current.getWorldPosition(playerWorldPosition);
    
    // Start melee from player's sword level
    const meleeStartPosition = playerWorldPosition.clone();
    meleeStartPosition.y += 1.3; // Shoulder height for sword

    // Use the player's movement rotation for facing direction
    const playerFacingDirection = this.localPlayerRotation.y;
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerFacingDirection);
    
    // Move the melee start position forward from the player model
    const forwardOffset = direction.clone().multiplyScalar(0.6);
    meleeStartPosition.add(forwardOffset);

    // Calculate target position - medium range for melee
    const meleeRange = 2.5; // Reduced from 5 to match particle effect
    const targetPosition = meleeStartPosition.clone().add(direction.clone().multiplyScalar(meleeRange));

    // Send player action to other clients
    if (this.sendPlayerAction) {
      const meleeActionData = {
        fromPosition: {
          x: meleeStartPosition.x,
          y: meleeStartPosition.y,
          z: meleeStartPosition.z
        },
        toPosition: {
          x: targetPosition.x,
          y: targetPosition.y,
          z: targetPosition.z
        },
        direction: {
          x: direction.x,
          y: direction.y,
          z: direction.z
        },
        range: meleeRange,
        timestamp: Date.now()
      };

      this.sendPlayerAction('melee_attack', meleeActionData);
    }

    // Call the melee cast callback for local visual effect
    this.onMeleeCast(meleeStartPosition, targetPosition);
  }

  private castRange(): void {
    if (!this.localPlayerRef.current || !this.cameraRef.current || !this.onRangeCast) {
      console.log('❌ Range attack failed - missing requirements:', {
        hasPlayer: !!this.localPlayerRef.current,
        hasCamera: !!this.cameraRef.current,
        hasCallback: !!this.onRangeCast
      });
      return;
    }

    // Check if player has enough stamina
    const staminaCost = 8;
    if (this.onStaminaConsume && !this.onStaminaConsume(staminaCost)) {
      this.onShowToast?.('Out of stamina', 'warning');
      return;
    }

    // Get the actual player model's world position
    const playerWorldPosition = new THREE.Vector3();
    this.localPlayerRef.current.getWorldPosition(playerWorldPosition);
    
    // Start range from player's bow level
    const rangeStartPosition = playerWorldPosition.clone();
    rangeStartPosition.y += 1.4; // Eye level for aiming

    // Use the player's movement rotation for facing direction
    const playerFacingDirection = this.localPlayerRotation.y;
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerFacingDirection);
    
    // Move the range start position forward from the player model
    const forwardOffset = direction.clone().multiplyScalar(0.7);
    rangeStartPosition.add(forwardOffset);

    // Calculate target position - long range for ranged attack
    const rangeRange = 15;
    const targetPosition = rangeStartPosition.clone().add(direction.clone().multiplyScalar(rangeRange));

    // Send player action to other clients
    if (this.sendPlayerAction) {
      const rangeActionData = {
        fromPosition: {
          x: rangeStartPosition.x,
          y: rangeStartPosition.y,
          z: rangeStartPosition.z
        },
        toPosition: {
          x: targetPosition.x,
          y: targetPosition.y,
          z: targetPosition.z
        },
        direction: {
          x: direction.x,
          y: direction.y,
          z: direction.z
        },
        range: rangeRange,
        timestamp: Date.now()
      };

      this.sendPlayerAction('range_attack', rangeActionData);
    }

    // Call the range cast callback for local visual effect
    this.onRangeCast(rangeStartPosition, targetPosition);
  }

  private async performAttackBasedOnEquippedWeapon(): Promise<void> {
    // Check if we need to update weapon info
    await this.updateWeaponInfoIfNeeded();
    
    // Perform attack based on weapon type
    switch (this.weaponType) {
      case 'magic':
        this.castSpell();
        break;
      case 'melee':
        this.castMelee();
        break;
      case 'range':
        this.castRange();
        break;
      default:
        // No weapon equipped, use punch
        this.castPunch();
        break;
    }
  }

  private async updateWeaponInfoIfNeeded(): Promise<void> {
    const now = Date.now();
    
    // Only check inventory if enough time has passed since last check
    if (now - this.lastInventoryCheck < this.inventoryCheckCooldown) {
      return;
    }
    
    try {
      // Get server address from constructor parameter
      const serverAddress = this.getServerAddress?.();
      if (!serverAddress) {
        console.warn('⚠️ No server address available for weapon check');
        return;
      }
      
      // Import DungeonApi dynamically to avoid circular dependencies
      const { DungeonApi } = await import('../network/dungeonApi');
      const response = await DungeonApi.getInventory(serverAddress);
      
      if (response.success) {
        const equippedWeapons = response.data.inventory.items.filter(item => 
          item.equipped && item.weaponStats
        );
        
        if (equippedWeapons.length > 0) {
          const weapon = equippedWeapons[0]; // Take the first equipped weapon
          this.currentEquippedWeapon = weapon.id;
          this.weaponType = this.determineWeaponType(weapon);
          
          console.log('🗡️ Updated weapon info:', {
            weaponId: this.currentEquippedWeapon,
            weaponType: this.weaponType,
            weaponName: weapon.name,
            weaponCategory: weapon.category
          });
        } else {
          // No weapon equipped
          this.currentEquippedWeapon = null;
          this.weaponType = null;
          console.log('👊 No weapon equipped, will use punch attack');
        }
        
        this.lastInventoryCheck = now;
      }
    } catch (error) {
      console.error('❌ Error checking weapon info:', error);
    }
  }

  private determineWeaponType(weapon: any): 'magic' | 'melee' | 'range' {
    const category = weapon.category.toLowerCase();
    const weaponType = weapon.weaponStats?.type?.toLowerCase() || '';
    
    // Determine weapon type based on category and weapon stats
    if (category.includes('staff') || category.includes('wand') || 
        category.includes('magic') || weaponType.includes('magic')) {
      return 'magic';
    } else if (category.includes('bow') || category.includes('crossbow') || 
               category.includes('arrow') || weaponType.includes('ranged') ||
               weaponType.includes('bow')) {
      return 'range';
    } else {
      // Default to melee for swords, axes, maces, etc.
      return 'melee';
    }
  }

  // Method to force weapon update when items are equipped/unequipped
  public onWeaponEquipmentChanged(): void {
    this.lastInventoryCheck = 0; // Force check on next attack
    console.log('⚔️ Weapon equipment changed, will update on next attack');
  }

  cleanup(): void {
    this.keysPressed.clear();
    this.isMoving = false;
    this.movementDirection = 'none';
    this.velocity.set(0, 0, 0);
    this.isAdminMode = false;
    
    // Reset animation timing
    this.animationClock.stop();
    this.clock.stop();
    this.lastAnimationTime = 0;
    
    this.gameHUD.hideHUD();
    
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  // Getters for debugging
  get debugInfo() {
    return {
      isMoving: this.isMoving,
      movementDirection: this.movementDirection,
      keysPressed: Array.from(this.keysPressed),
      localPlayerRotation: this.localPlayerRotation,
      isAdminMode: this.isAdminMode,
      velocity: this.velocity.toArray(),
      isGrounded: this.isGrounded
    };
  }

  /**
   * Get the current real-time player position
   */
  getCurrentPlayerPosition(): THREE.Vector3 | null {
    return this.localPlayerRef.current?.position || null;
  }

  /**
   * Get a copy of the current real-time player position
   */
  getCurrentPlayerPositionClone(): THREE.Vector3 | null {
    return this.localPlayerRef.current?.position.clone() || null;
  }
}
