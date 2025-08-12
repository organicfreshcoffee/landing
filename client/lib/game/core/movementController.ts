import * as THREE from 'three';
import { PlayerAnimationData } from '../types';

export class MovementController {
  private keysPressed = new Set<string>();
  private localPlayerRotation = { x: 0, y: 0, z: 0 };
  private isMoving = false;
  private movementDirection: 'forward' | 'backward' | 'none' = 'none';
  private lastUpdateTime = 0;
  private lastSentMovementState = false;
  private clock = new THREE.Clock();

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
  }

  private setupKeyboardListeners(): void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!this.isConnected()) return;

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
    
    const moveSpeed = 0.5;
    const localPlayer = this.localPlayerRef.current;
    const camera = this.cameraRef.current;
    let moved = false;
    
    // Store old position
    const oldPosition = { ...localPlayer.position };
    const oldRotation = { ...this.localPlayerRotation };
    
    // Calculate movement direction based on player rotation
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.localPlayerRotation.y);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.localPlayerRotation.y);

    // Track movement direction for animation
    let newMovementDirection: 'forward' | 'backward' | 'none' = this.movementDirection;
    
    if (this.keysPressed.has('KeyW')) {
      localPlayer.position.add(forward.clone().multiplyScalar(moveSpeed));
      moved = true;
      newMovementDirection = 'forward';
    }
    if (this.keysPressed.has('KeyS')) {
      localPlayer.position.add(forward.clone().multiplyScalar(-moveSpeed));
      moved = true;
      newMovementDirection = 'backward';
    }
    if (this.keysPressed.has('KeyA')) {
      localPlayer.position.add(right.clone().multiplyScalar(-moveSpeed));
      moved = true;
      if (newMovementDirection === 'none') newMovementDirection = 'forward';
    }
    if (this.keysPressed.has('KeyD')) {
      localPlayer.position.add(right.clone().multiplyScalar(moveSpeed));
      moved = true;
      if (newMovementDirection === 'none') newMovementDirection = 'forward';
    }
    if (this.keysPressed.has('Space')) {
      localPlayer.position.y += moveSpeed;
      moved = true;
    }
    if (this.keysPressed.has('ShiftLeft')) {
      localPlayer.position.y -= moveSpeed;
      moved = true;
    }

    if (!moved) {
      newMovementDirection = 'none';
    }
    this.movementDirection = newMovementDirection;

    // Update camera
    this.updateCamera(camera, localPlayer.position);

    // Handle animations
    this.updateAnimations(moved);

    // Send updates to server
    this.sendMovementUpdateIfNeeded(userId, moved, oldRotation);
  }

  private updateCamera(camera: THREE.PerspectiveCamera, playerPos: THREE.Vector3): void {
    const cameraHeight = 1.0;
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
      
      if (this.isMoving) {
        if (!walkAction.isRunning()) {
          walkAction.play();
        }
        walkAction.paused = false;
        
        if (this.movementDirection === 'backward') {
          walkAction.timeScale = -1;
        } else if (this.movementDirection === 'forward') {
          walkAction.timeScale = 1;
        }
      } else {
        walkAction.paused = true;
      }
      
      this.localPlayerMixer.current.update(delta);
    }
    
    // Update other players' animation mixers
    this.playersAnimations.forEach((animData) => {
      animData.mixer.update(delta);
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
      localPlayerRotation: this.localPlayerRotation
    };
  }
}
