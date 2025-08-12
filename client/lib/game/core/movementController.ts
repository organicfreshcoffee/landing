import * as THREE from 'three';
import { PlayerAnimationData } from '../types';
import { CollisionSystem } from './collisionSystem';
import { GameHUD } from '../ui/gameHUD';
import { AnimationTest } from '../utils/animationTest';

export class MovementController {
  private keysPressed = new Set<string>();
  private localPlayerRotation = { x: 0, y: 0, z: 0 };
  private isMoving = false;
  private movementDirection: 'forward' | 'backward' | 'none' = 'none';
  private lastUpdateTime = 0;
  private lastSentMovementState = false;
  private clock = new THREE.Clock();
  
  // Physics and admin mode properties
  private isAdminMode = false;
  private velocity = new THREE.Vector3(0, 0, 0);
  private isGrounded = false;
  private isJumping = false;
  
  // Physics constants
  private readonly GRAVITY = -35; // Units per second squared
  private readonly JUMP_FORCE = 15; // Initial upward velocity
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
    private sendMovementUpdate: (data: any) => void
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

    const handlePointerLockChange = () => {
      isPointerLocked = document.pointerLockElement !== null;
    };

    const handleCanvasClick = (canvas: HTMLCanvasElement) => {
      canvas.requestPointerLock();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    // Store the click handler for external setup
    (this as any).handleCanvasClick = handleCanvasClick;
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
    let newMovementDirection: 'forward' | 'backward' | 'none' = 'none'; // Reset to none first
    let horizontalMovement = false; // Track WASD movement separately
    
    // Calculate intended movement
    const movement = new THREE.Vector3(0, 0, 0);
    
    if (this.keysPressed.has('KeyW')) {
      movement.add(forward.clone().multiplyScalar(moveSpeed));
      moved = true;
      horizontalMovement = true;
      newMovementDirection = 'forward';
    }
    if (this.keysPressed.has('KeyS')) {
      movement.add(forward.clone().multiplyScalar(-moveSpeed));
      moved = true;
      horizontalMovement = true;
      newMovementDirection = 'backward';
    }
    if (this.keysPressed.has('KeyA')) {
      movement.add(right.clone().multiplyScalar(-moveSpeed));
      moved = true;
      horizontalMovement = true;
      if (newMovementDirection === 'none') newMovementDirection = 'forward';
    }
    if (this.keysPressed.has('KeyD')) {
      movement.add(right.clone().multiplyScalar(moveSpeed));
      moved = true;
      horizontalMovement = true;
      if (newMovementDirection === 'none') newMovementDirection = 'forward';
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
      // Normal mode: jumping and gravity
      this.handleJumping();
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
        this.isJumping
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
      this.isJumping = false;
      this.gameHUD.updateAdminMode(true);
      this.gameHUD.showMessage('🔧 Admin Mode Enabled', 2000);
      console.log('🔧 Admin mode enabled - No collision, no gravity, use Space/Shift for vertical movement');
    } else {
      // When exiting admin mode, snap to ground level if above ground
      if (this.localPlayerRef.current) {
        const floorHeight = this.collisionSystem.getFloorHeight(this.localPlayerRef.current.position);
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

  private handleJumping(): void {
    if (this.keysPressed.has('Space') && this.isGrounded && !this.isJumping) {
      this.velocity.y = this.JUMP_FORCE;
      this.isJumping = true;
      this.isGrounded = false;
      console.log('🚀 Jump initiated');
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
    const floorHeight = this.collisionSystem.getFloorHeight(this.localPlayerRef.current.position);
    
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
      this.isJumping = false;
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
      // Normal mode: apply collision detection
      const newPosition = oldPosition.clone().add(movement);
      const collisionResult = this.collisionSystem.checkCollision(newPosition);
      
      if (collisionResult.collided) {
        // Use corrected position
        localPlayer.position.copy(collisionResult.correctedPosition);
        
        // Provide feedback for different collision types
        if (collisionResult.collisionDirection === 'y') {
          // Ceiling collision - stop upward movement
          if (this.velocity.y > 0) {
            this.velocity.y = 0;
          }
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
    const cameraHeight = 1.0;
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
      -Math.sin(this.localPlayerRotation.x),
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
    
    const delta = this.clock.getDelta();
    
    // Control local player animation
    if (this.localPlayerMixer.current && this.localPlayerActions.current.StickMan_Run) {
      const walkAction = this.localPlayerActions.current.StickMan_Run;
      
      // Only animate walking if there's horizontal movement (not just vertical)
      const shouldAnimate = this.movementDirection !== 'none';
      
      // Add occasional debug logging for local player
      if (Math.random() < 0.01) { // 1% of frames
        console.log('🚶 Local player animation update:', {
          shouldAnimate,
          movementDirection: this.movementDirection,
          isRunning: walkAction.isRunning(),
          paused: walkAction.paused,
          time: walkAction.time.toFixed(3),
          delta
        });
      }
      
      if (shouldAnimate) {
        if (!walkAction.isRunning()) {
          walkAction.play();
        }
        walkAction.paused = false;
        
        if (this.movementDirection === 'backward') {
          walkAction.timeScale = -300; // Speed up by factor of 100
        } else if (this.movementDirection === 'forward') {
          walkAction.timeScale = 300; // Speed up by factor of 100
        }
      } else {
        walkAction.paused = true;
      }
      
      this.localPlayerMixer.current.update(delta);
    } else if (Math.random() < 0.01) {
      console.log('⚠️ Local player mixer or action not available:', {
        hasMixer: !!this.localPlayerMixer.current,
        hasAction: !!this.localPlayerActions.current.StickMan_Run
      });
    }
    
    // Update other players' animation mixers
    this.playersAnimations.forEach((animData) => {
      animData.mixer.update(delta);
    });
    
    // Update test runner animation for debugging
    AnimationTest.updateTestRunner(delta);
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
          movementDirection: this.movementDirection
        }
      };
      
      this.sendMovementUpdate(moveMessage);
    }
  }

  setupCanvasClickHandler(canvas: HTMLCanvasElement): void {
    if ((this as any).handleCanvasClick) {
      canvas.addEventListener('click', () => (this as any).handleCanvasClick(canvas));
    }
  }

  cleanup(): void {
    this.keysPressed.clear();
    this.isMoving = false;
    this.movementDirection = 'none';
    this.velocity.set(0, 0, 0);
    this.isAdminMode = false;
    
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
      isGrounded: this.isGrounded,
      isJumping: this.isJumping
    };
  }
}
