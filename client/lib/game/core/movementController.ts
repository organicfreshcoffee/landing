import * as THREE from 'three';
import { PlayerAnimationData, CharacterData } from '../types';
import { CollisionSystem } from './collisionSystem';
import { GameHUD } from '../ui/gameHUD';
import { AnimationTest } from '../utils/animationTest';
import { PlayerManager } from './playerManager';

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

  constructor(
    private localPlayerRef: { current: THREE.Object3D | null },
    private cameraRef: { current: THREE.PerspectiveCamera | null },
    private localPlayerMixer: { current: THREE.AnimationMixer | null },
    private localPlayerActions: { current: { [key: string]: THREE.AnimationAction } },
    private playersAnimations: Map<string, PlayerAnimationData>,
    private isConnected: () => boolean,
    private sendMovementUpdate: (data: any) => void,
    private selectedCharacter: CharacterData,
    private onSpellCast?: (fromPosition: THREE.Vector3, toPosition: THREE.Vector3) => void
  ) {
    this.setupKeyboardListeners();
    this.setupMouseListeners();
    this.collisionSystem = CollisionSystem.getInstance();
    this.gameHUD = GameHUD.getInstance();
  }

  private setupKeyboardListeners(): void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!this.isConnected()) return;

      // Handle admin mode toggle
      if (event.code === 'Tab') {
        event.preventDefault();
        this.toggleAdminMode();
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
      
      // Only handle left clicks for spell casting
      if (event.button === 0) {
        event.preventDefault(); // Prevent other handlers
        console.log('✨ Left click - casting spell!');
        this.castSpell();
      }
    };

    const handlePointerLockChange = () => {
      isPointerLocked = document.pointerLockElement !== null;
      console.log('🔒 Pointer lock changed:', isPointerLocked);
    };

    const handleCanvasClick = (canvas: HTMLCanvasElement) => {
      if (!isPointerLocked) {
        console.log('🖱️ Canvas clicked - requesting pointer lock');
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
      console.log('🔧 Admin mode enabled - No collision, no gravity, use Space/Shift for vertical movement');
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
      console.log('👤 Admin mode disabled - Collision and gravity enabled');
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
    
    // Debug: Log gravity information occasionally
    if (Math.random() < 0.01) {
      console.log('🌍 Gravity info:', {
        currentY: this.localPlayerRef.current.position.y.toFixed(2),
        newY: newY.toFixed(2),
        floorHeight: floorHeight.toFixed(2),
        velocity: this.velocity.y.toFixed(2),
        isGrounded: this.isGrounded
      });
    }
    
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
    const cameraHeight = 1.5;
    const cameraDistance = 0.75;
    
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
    
    // Update test runner animation for debugging with smooth delta
    AnimationTest.updateTestRunner(smoothDelta);
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
      
      console.log('🎮 Sending movement update with character:', this.selectedCharacter.name);
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

  private castSpell(): void {
    if (!this.localPlayerRef.current || !this.cameraRef.current || !this.onSpellCast) {
      console.log('❌ Spell cast failed - missing requirements:', {
        hasPlayer: !!this.localPlayerRef.current,
        hasCamera: !!this.cameraRef.current,
        hasCallback: !!this.onSpellCast
      });
      return;
    }

    console.log('✨ Casting spell!');

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

    // Call the spell cast callback
    this.onSpellCast(spellStartPosition, targetPosition);
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
}
