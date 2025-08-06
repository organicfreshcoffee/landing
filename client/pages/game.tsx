import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { SkeletonUtils } from 'three-stdlib';
import styles from '../styles/Game.module.css';

interface GameState {
  connected: boolean;
  error: string | null;
  loading: boolean;
}

interface GameMessage {
  type: string;
  data: any;
}

interface Player {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  color: string;
  mesh?: THREE.Object3D; // Changed from THREE.Mesh to THREE.Object3D to support both meshes and groups
  isMoving?: boolean;
  movementDirection?: 'forward' | 'backward' | 'none';
}

interface PlayerUpdate {
  id: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  isMoving?: boolean;
  movementDirection?: 'forward' | 'backward' | 'none';
}

export default function Game() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { server } = router.query;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const playersRef = useRef<Map<string, Player>>(new Map());
  const localPlayerRef = useRef<THREE.Object3D | null>(null); // Changed from THREE.Mesh to THREE.Object3D
  const keysPressed = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ x: 0, y: 0 });
  const isPointerLocked = useRef(false);
  const localPlayerRotation = useRef({ x: 0, y: 0, z: 0 });
  const lastUpdateTime = useRef<number>(0);
  const updateMovementRef = useRef<(() => void) | null>(null);
  const gltfLoaderRef = useRef<GLTFLoader | null>(null);
  const playerModelRef = useRef<THREE.Group | null>(null); // For storing the loaded model template
  const localPlayerMixer = useRef<THREE.AnimationMixer | null>(null); // Animation mixer for local player
  const localPlayerActions = useRef<{ [key: string]: THREE.AnimationAction }>({});
  const playersAnimations = useRef<Map<string, { mixer: THREE.AnimationMixer; actions: { [key: string]: THREE.AnimationAction } }>>(new Map());
  const isMoving = useRef<boolean>(false);
  const movementDirection = useRef<'forward' | 'backward' | 'none'>('none'); // Track movement direction for animation
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const modelGroundOffsetRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 }); // Store ground offset for consistent positioning
  
  const [gameState, setGameState] = useState<GameState>({
    connected: false,
    error: null,
    loading: true
  });

  // Load 3D player model with animations
  const loadPlayerModel = async (): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[]; groundOffset?: { x: number; y: number; z: number } }> => {
    // Try to load the animated skeleton model (GLB format)
    try {
      if (!gltfLoaderRef.current) {
        gltfLoaderRef.current = new GLTFLoader();
      }
      
      console.log('Attempting to load stickman.glb...');
      const gltf = await gltfLoaderRef.current.loadAsync('/assets/3d-models/stickman.glb');
      console.log('Successfully loaded stickman.glb with', gltf.animations?.length || 0, 'animations');
      
      // DEBUG: Create a properly cloned model with skeleton/animation support
      // Use SkeletonUtils.clone to properly handle SkinnedMesh and skeleton data
      const freshScene = SkeletonUtils.clone(gltf.scene) as THREE.Group;
      
      // Debug: Log animation details
      if (gltf.animations && gltf.animations.length > 0) {
        gltf.animations.forEach((anim, index) => {
          console.log(`Animation ${index}: "${anim.name}" - Duration: ${anim.duration}s - Tracks: ${anim.tracks.length}`);
        });
      } else {
        console.warn('⚠️ No animations found in stickman.glb!');
      }
      
      // Scale the model appropriately for the game - make twice as big
      freshScene.scale.set(0.6, 0.6, 0.6); // Doubled from 0.3 to 0.6
      
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
        y: -box.min.y
      };
      
      // Store globally for consistent positioning in updates
      modelGroundOffsetRef.current = groundOffset;
      
      // Reset position to origin for template - individual instances will apply offsets
      freshScene.position.set(0, 0, 0);
      
      console.log('Template model reset to origin, ground offset calculated:', groundOffset);
      
      // Debug: Check for bones/skeleton structure that might be causing positioning issues
      let foundSkeleton = false;
      freshScene.traverse((child) => {
        if (child.type === 'Bone' || child.type === 'SkinnedMesh') {
          console.log(`Found ${child.type}:`, child.name, 'position:', child.position.toArray(), 'world position:', child.getWorldPosition(new THREE.Vector3()).toArray());
          foundSkeleton = true;
        }
      });
      console.log('Has skeleton/bones:', foundSkeleton);
      
      // Ensure all materials render properly and are visible
      freshScene.traverse((child) => {
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
      
      return { scene: freshScene, animations: gltf.animations || [], groundOffset };
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
      
      return { scene: group, animations: [], groundOffset: { x: 0, y: 0, z: 0 } };
    }
  };

  // Generate a random color for player cubes
  const generatePlayerColor = (playerId: string): string => {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', 
      '#ffeaa7', '#dda0dd', '#98d8c8', '#f7dc6f'
    ];
    const hash = playerId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  // Create a player model with animations
  const createPlayerModel = async (player: Player): Promise<{ model: THREE.Object3D; mixer?: THREE.AnimationMixer; actions?: { [key: string]: THREE.AnimationAction } }> => {
    const modelData = await loadPlayerModel();
    
    // Clone the model scene for each player instance
    const playerModel = modelData.scene.clone();
    
    // Debug: Log what we're working with for positioning issues
    console.log(`Creating player model for ${player.id}:`, {
      modelBounds: new THREE.Box3().setFromObject(playerModel),
      playerPosition: player.position,
      groundOffset: modelData.groundOffset
    });
    
    // Check if the cloned model has proper structure
    playerModel.traverse((child) => {
      if (child.type === 'Bone' || child.type === 'SkinnedMesh') {
        console.log(`Player ${player.id} - ${child.type}:`, child.name, 'local pos:', child.position.toArray());
        
        // Fix SkinnedMesh coordinate system issues
        if (child.type === 'SkinnedMesh') {
          // Force the SkinnedMesh to respect parent transforms
          child.updateMatrixWorld(true);
          
          // Reset the SkinnedMesh to origin if it's not already there
          if (child.position.x !== 0 || child.position.y !== 0 || child.position.z !== 0) {
            console.log(`Resetting SkinnedMesh position from:`, child.position.toArray());
            child.position.set(0, 0, 0);
          }
          
          // Ensure the SkinnedMesh doesn't have its own transform that conflicts
          child.matrixAutoUpdate = true;
          
          // Additional fix: ensure the skeleton respects the parent transform
          const skinnedMesh = child as THREE.SkinnedMesh;
          if (skinnedMesh.skeleton) {
            // Force skeleton to update relative to parent
            skinnedMesh.skeleton.update();
            console.log(`Updated skeleton for player ${player.id}`);
          }
          
          console.log(`Fixed SkinnedMesh for player ${player.id}`);
        }
      }
    });
    
    // Create animation mixer and actions if animations are available
    let mixer: THREE.AnimationMixer | undefined;
    let actions: { [key: string]: THREE.AnimationAction } = {};
    
    if (modelData.animations.length > 0) {
      mixer = new THREE.AnimationMixer(playerModel);
      
      // Create actions for each animation
      modelData.animations.forEach((clip) => {
        const action = mixer!.clipAction(clip);
        actions[clip.name] = action;
        
        // Set default properties for walk animation
        if (clip.name === 'StickMan_Run') {
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.clampWhenFinished = true;
          action.weight = 1.0;
          // Initialize the same way as local player
          action.reset();
          action.play();
          action.paused = true;
          action.enabled = true;
        }
      });
      
      console.log('Created animation actions for player:', Object.keys(actions));
    }
    
    // Apply player-specific properties and color
    playerModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Clone material to avoid sharing between players
        if (Array.isArray(child.material)) {
          child.material = child.material.map(mat => {
            const clonedMat = mat.clone();
            clonedMat.color.setHex(parseInt(player.color.replace('#', '0x')));
            return clonedMat;
          });
        } else {
          const clonedMaterial = child.material.clone();
          clonedMaterial.color.setHex(parseInt(player.color.replace('#', '0x')));
          child.material = clonedMaterial;
        }
      }
    });
    
    // Set world position and rotation - try without groundOffset first to isolate the issue
    console.log(`Setting player ${player.id} position to:`, player.position);
    playerModel.position.set(
      player.position.x,
      player.position.y,
      player.position.z
    );
    // Set only Y rotation with Math.PI offset to account for model's built-in rotation
    // Characters should only turn left/right, not tilt up/down
    playerModel.rotation.set(
      0, // Keep character upright
      player.rotation.y + Math.PI,
      0  // Keep character upright
    );
    playerModel.castShadow = true;
    
    // Force update transforms and verify final positions
    playerModel.updateMatrixWorld(true);
    
    // Debug: Check final world positions after all transforms
    playerModel.traverse((child) => {
      if (child.type === 'SkinnedMesh') {
        const worldPos = child.getWorldPosition(new THREE.Vector3());
        console.log(`Final world position for player ${player.id} SkinnedMesh:`, worldPos.toArray());
        console.log(`Expected position:`, [player.position.x, player.position.y, player.position.z]);
        
        // If world position is still wrong, this indicates a deeper issue
        if (Math.abs(worldPos.x - player.position.x) > 0.1 || 
            Math.abs(worldPos.z - player.position.z) > 0.1) {
          console.warn(`⚠️  Player ${player.id} SkinnedMesh world position mismatch!`);
        }
      }
    });
    
    return { model: playerModel, mixer, actions };
  };

  // Add or update a player
  const updatePlayer = async (playerData: PlayerUpdate) => {
    console.log(`🔄 updatePlayer called for ${playerData.id} - DISABLED FOR TESTING`);
    // DISABLED FOR TESTING - commenting out all other player logic
    return;
    
    /*
    console.log(`🔄 updatePlayer called for ${playerData.id}:`, {
      position: playerData.position,
      rotation: playerData.rotation,
      isMoving: playerData.isMoving,
      movementDirection: playerData.movementDirection
    });
    
    if (!sceneRef.current) {
      console.warn(`❌ Scene not available for player ${playerData.id}`);
      return;
    }

    const players = playersRef.current;
    const existingPlayer = players.get(playerData.id);

    if (existingPlayer) {
      console.log(`📝 Updating existing player ${playerData.id}`);
      // Update existing player position
      existingPlayer.position = playerData.position;
      if (playerData.rotation) {
        existingPlayer.rotation = playerData.rotation;
      }
      
      // Update movement state for animation
      existingPlayer.isMoving = playerData.isMoving;
      existingPlayer.movementDirection = playerData.movementDirection;
      
      if (existingPlayer.mesh) {
        const beforePosition = existingPlayer.mesh.position.toArray();
        const beforeRotation = existingPlayer.mesh.rotation.toArray();
        
        existingPlayer.mesh.position.set(
          playerData.position.x,
          playerData.position.y,
          playerData.position.z
        );
        if (playerData.rotation) {
          // Apply only Y rotation with Math.PI offset to account for model's built-in rotation
          // Other players' characters should only turn left/right, not tilt up/down
          existingPlayer.mesh.rotation.set(
            0, // Keep character upright
            playerData.rotation.y + Math.PI,
            0  // Keep character upright
          );
        }
        
        const afterPosition = existingPlayer.mesh.position.toArray();
        const afterRotation = existingPlayer.mesh.rotation.toArray();
        
        console.log(`📍 Player ${playerData.id} position update:`, {
          before: beforePosition,
          after: afterPosition,
          target: [playerData.position.x, playerData.position.y, playerData.position.z],
          changed: beforePosition[0] !== afterPosition[0] || beforePosition[1] !== afterPosition[1] || beforePosition[2] !== afterPosition[2]
        });
        
        // Calculate distance from local player for visibility debugging
        if (localPlayerRef.current) {
          const localPos = localPlayerRef.current.position;
          const otherPos = existingPlayer.mesh.position;
          const distance = Math.sqrt(
            Math.pow(localPos.x - otherPos.x, 2) + 
            Math.pow(localPos.y - otherPos.y, 2) + 
            Math.pow(localPos.z - otherPos.z, 2)
          );
          console.log(`👁️ Player ${playerData.id} visibility:`, {
            localPlayerPos: [localPos.x, localPos.y, localPos.z],
            otherPlayerPos: [otherPos.x, otherPos.y, otherPos.z],
            distance: distance,
            cameraPos: cameraRef.current ? [cameraRef.current.position.x, cameraRef.current.position.y, cameraRef.current.position.z] : 'no camera'
          });
        }
        
        console.log(`🔄 Player ${playerData.id} rotation update:`, {
          before: beforeRotation,
          after: afterRotation,
          target: playerData.rotation ? [0, playerData.rotation.y + Math.PI, 0] : 'none',
          changed: beforeRotation[1] !== afterRotation[1]
        });
        
        // Force a render update
        if (existingPlayer.mesh.parent) {
          existingPlayer.mesh.updateMatrixWorld(true);
        }
      }
      
      // Update other player's animation based on movement state
      const animData = playersAnimations.current.get(playerData.id);
      if (animData && animData.actions.StickMan_Run) {
        const walkAction = animData.actions.StickMan_Run;
        
        console.log(`Updating other player ${playerData.id} animation - isMoving: ${existingPlayer.isMoving}, direction: ${existingPlayer.movementDirection}`);
        
        if (existingPlayer.isMoving) {
          // Use the same pattern as local player - only play if not running, never reset
          if (!walkAction.isRunning()) {
            walkAction.play();
            console.log(`Started walk animation for player ${playerData.id}`);
          }
          walkAction.paused = false;
          walkAction.enabled = true;
          
          // Set animation direction based on movement
          if (existingPlayer.movementDirection === 'backward') {
            walkAction.timeScale = -1;
            console.log(`Player ${playerData.id} walking backward`);
          } else {
            walkAction.timeScale = 1;
            console.log(`Player ${playerData.id} walking forward`);
          }
          
          console.log(`Animation state for player ${playerData.id}:`, {
            isRunning: walkAction.isRunning(),
            paused: walkAction.paused,
            enabled: walkAction.enabled,
            timeScale: walkAction.timeScale,
            weight: walkAction.weight
          });
        } else {
          // Pause instead of stop to maintain smooth transitions
          walkAction.paused = true;
          console.log(`Paused walk animation for player ${playerData.id}`);
        }
      } else {
        console.log(`No animation data found for player ${playerData.id}:`, {
          hasAnimData: !!animData,
          hasStickManRun: animData?.actions?.StickMan_Run ? true : false,
          availableActions: animData ? Object.keys(animData.actions) : []
        });
      }
    } else {
      // Create new player
      console.log(`Creating new player ${playerData.id} at position:`, playerData.position);
      const newPlayer: Player = {
        id: playerData.id,
        position: playerData.position,
        rotation: playerData.rotation || { x: 0, y: 0, z: 0 },
        color: generatePlayerColor(playerData.id),
        isMoving: playerData.isMoving || false,
        movementDirection: playerData.movementDirection || 'none'
      };
      
      const playerData_result = await createPlayerModel(newPlayer);
      newPlayer.mesh = playerData_result.model;
      console.log(`New player ${playerData.id} mesh position:`, newPlayer.mesh.position.toArray());
      sceneRef.current.add(playerData_result.model);
      
      // Store animation data for other players
      if (playerData_result.mixer && playerData_result.actions) {
        playersAnimations.current.set(playerData.id, {
          mixer: playerData_result.mixer,
          actions: playerData_result.actions
        });
        console.log(`Stored animation data for player ${playerData.id}:`, Object.keys(playerData_result.actions));
      } else {
        console.warn(`No animation data for player ${playerData.id}`);
      }
      
      players.set(playerData.id, newPlayer);
    }
    */
  };

  // Remove a player
  const removePlayer = (playerId: string) => {
    if (!sceneRef.current) return;

    const players = playersRef.current;
    const player = players.get(playerId);
    
    if (player && player.mesh) {
      sceneRef.current.remove(player.mesh);
      
      // Clean up animation data
      const animData = playersAnimations.current.get(playerId);
      if (animData) {
        animData.mixer.stopAllAction();
        playersAnimations.current.delete(playerId);
      }
      
      // Dispose of resources properly for both meshes and groups
      if (player.mesh instanceof THREE.Mesh) {
        player.mesh.geometry.dispose();
        (player.mesh.material as THREE.Material).dispose();
      } else if (player.mesh instanceof THREE.Group) {
        // Dispose of all meshes in the group
        player.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
      }
      
      players.delete(playerId);
    }
  };

  // Movement update function for smooth movement
  const updateMovement = useCallback(() => {
    if (!localPlayerRef.current || !cameraRef.current || !gameState.connected) return;
    
    const moveSpeed = 0.1; // Reduced for smoother movement
    const localPlayer = localPlayerRef.current;
    const camera = cameraRef.current;
    let moved = false;
    
    // Store old position and rotation
    const oldPosition = { ...localPlayer.position };
    const oldRotation = { ...localPlayerRotation.current };
    
    // Calculate movement direction based on player rotation
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), localPlayerRotation.current.y);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), localPlayerRotation.current.y);

    // Track movement direction for animation - preserve the previous direction if no new input
    let newMovementDirection: 'forward' | 'backward' | 'none' = movementDirection.current;
    
    if (keysPressed.current.has('KeyW')) {
      localPlayer.position.add(forward.clone().multiplyScalar(moveSpeed));
      moved = true;
      newMovementDirection = 'forward';
    }
    if (keysPressed.current.has('KeyS')) {
      localPlayer.position.add(forward.clone().multiplyScalar(-moveSpeed));
      moved = true;
      newMovementDirection = 'backward';
    }
    if (keysPressed.current.has('KeyA')) {
      localPlayer.position.add(right.clone().multiplyScalar(-moveSpeed));
      moved = true;
      // Side movement uses forward animation only if we weren't already moving backward
      if (newMovementDirection === 'none') newMovementDirection = 'forward';
    }
    if (keysPressed.current.has('KeyD')) {
      localPlayer.position.add(right.clone().multiplyScalar(moveSpeed));
      moved = true;
      // Side movement uses forward animation only if we weren't already moving backward
      if (newMovementDirection === 'none') newMovementDirection = 'forward';
    }
    if (keysPressed.current.has('Space')) {
      localPlayer.position.y += moveSpeed;
      moved = true;
    }
    if (keysPressed.current.has('ShiftLeft')) {
      localPlayer.position.y -= moveSpeed;
      moved = true;
    }

    // Only update movement direction if we're actually moving, otherwise keep it as 'none'
    if (!moved) {
      newMovementDirection = 'none';
    }
    movementDirection.current = newMovementDirection;

    // Update camera to follow the player with proper FPS-style rotation
    const playerPos = localPlayer.position;
    
    // For third-person FPS camera, position camera behind and above the player
    const cameraHeight = 1.8; // Eye level height
    const cameraDistance = 3.5; // Distance behind player for third-person view
    
    // Calculate camera position based on player's Y rotation - add Math.PI to put camera behind
    const cameraX = playerPos.x + Math.sin(localPlayerRotation.current.y) * cameraDistance;
    const cameraZ = playerPos.z + Math.cos(localPlayerRotation.current.y) * cameraDistance;
    
    camera.position.set(
      cameraX,
      playerPos.y + cameraHeight,
      cameraZ
    );
    
    // Calculate look-at point based on both X and Y rotation for camera only
    const lookDistance = 10; // How far ahead to look
    const lookDirection = new THREE.Vector3(
      -Math.sin(localPlayerRotation.current.y), // Negative because we're looking forward from behind
      -Math.sin(localPlayerRotation.current.x), // Negative for correct up/down look
      -Math.cos(localPlayerRotation.current.y)  // Negative because we're looking forward from behind
    );
    
    const lookAtPoint = new THREE.Vector3(
      playerPos.x + lookDirection.x * lookDistance,
      playerPos.y + cameraHeight + lookDirection.y * lookDistance,
      playerPos.z + lookDirection.z * lookDistance
    );
    
    camera.lookAt(lookAtPoint);

    // Handle walking animation based on movement
    const wasMoving = isMoving.current;
    const oldDirection = movementDirection.current;
    isMoving.current = moved;
    
    // Get delta time once per frame
    const delta = clockRef.current.getDelta();
    
    // Control local player animation
    if (localPlayerMixer.current && localPlayerActions.current.StickMan_Run) {
      const walkAction = localPlayerActions.current.StickMan_Run;
      
      if (isMoving.current) {
        // Start or update walking animation
        if (!walkAction.isRunning()) {
          walkAction.play();
          console.log('Walk action started (was not running)');
        }
        walkAction.paused = false;
        
        // Only change animation direction when we have a clear forward/backward movement
        if (movementDirection.current === 'backward') {
          // Play animation in reverse for backward movement
          walkAction.timeScale = -1;
          console.log('Walking animation - direction: backward, timeScale: -1');
        } else if (movementDirection.current === 'forward') {
          // Play animation normally for forward movement
          walkAction.timeScale = 1;
          console.log('Walking animation - direction: forward, timeScale: 1');
        }
        // Don't change timeScale when direction is 'none' - keep previous setting
        
      } else {
        // Pause walking animation instead of stopping to maintain smooth transitions
        walkAction.paused = true;
        console.log('Paused walking animation');
      }
      
      // Always update animation mixer when it exists
      localPlayerMixer.current.update(delta);
    } else {
      // Log missing components for debugging
      if (!localPlayerMixer.current) {
        console.log('No local player mixer available');
      } else if (!localPlayerActions.current.StickMan_Run) {
        console.log('No StickMan_Run action available. Available actions:', Object.keys(localPlayerActions.current));
      }
    }
    
    // Update other players' animation mixers
    playersAnimations.current.forEach((animData) => {
      animData.mixer.update(delta);
    });
    
    // TEST: Update test player animation
    const testPlayer = (window as any).testPlayer;
    if (testPlayer && testPlayer.mixer) {
      testPlayer.mixer.update(delta);
    }

    // Send updates to server if position or rotation changed (with throttling)
    const now = Date.now();
    if ((moved || 
        Math.abs(oldRotation.y - localPlayerRotation.current.y) > 0.01) &&
        now - lastUpdateTime.current > 50) { // Throttle to 20 updates per second
      
      lastUpdateTime.current = now;
      
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        const moveMessage = {
          type: 'player_move',
          data: {
            playerId: user?.uid,
            position: {
              x: localPlayer.position.x,
              y: localPlayer.position.y,
              z: localPlayer.position.z
            },
            rotation: {
              x: 0, // Only send Y rotation since characters don't tilt up/down
              y: localPlayerRotation.current.y,
              z: 0
            },
            isMoving: isMoving.current,
            movementDirection: movementDirection.current
          }
        };
        websocketRef.current.send(JSON.stringify(moveMessage));
      }
    }
  }, [gameState.connected, user?.uid]);

  // Update the ref whenever the function changes
  useEffect(() => {
    updateMovementRef.current = updateMovement;
    
    // Add debug info to global scope for console debugging
    if (typeof window !== 'undefined') {
      (window as any).gameDebug = {
        isMoving: isMoving.current,
        movementDirection: movementDirection.current,
        localPlayerMixer: localPlayerMixer.current,
        localPlayerActions: localPlayerActions.current,
        playersAnimations: playersAnimations.current,
        localPlayerRef: localPlayerRef,
        keysPressed: keysPressed.current
      };
    }
  }, [updateMovement]);

  // Initialize Three.js scene
  const initThreeJS = () => {
    if (!canvasRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.01, // Much smaller near plane to avoid clipping
      1000
    );
    camera.position.set(0, 5, 10);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current,
      antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Disable frustum culling to ensure model parts aren't clipped prematurely
    renderer.localClippingEnabled = false;
    
    rendererRef.current = renderer;

    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add a basic ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add scenery objects (spheres) for better sense of movement
    const sphereGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const sphereMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown color
    
    // Create a grid of spheres across the ground
    for (let x = -40; x <= 40; x += 10) {
      for (let z = -40; z <= 40; z += 10) {
        if (x === 0 && z === 0) continue; // Skip center where player starts
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial.clone());
        sphere.position.set(x + (Math.random() - 0.5) * 3, 0.5, z + (Math.random() - 0.5) * 3);
        sphere.castShadow = true;
        scene.add(sphere);
      }
    }

    // Add some taller objects for variety
    const cylinderGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3, 8);
    const cylinderMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 }); // Dark brown
    
    for (let i = 0; i < 20; i++) {
      const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial.clone());
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      cylinder.position.set(x, 1.5, z);
      cylinder.castShadow = true;
      scene.add(cylinder);
    }

    // Create local player with animations (async, so we'll add it after scene setup)
    const createLocalPlayer = async () => {
      const localPlayerData = await loadPlayerModel();
      const localPlayerScene = localPlayerData.scene;
      
      // Set up animations for local player
      if (localPlayerData.animations.length > 0) {
        localPlayerMixer.current = new THREE.AnimationMixer(localPlayerScene);
        
        localPlayerData.animations.forEach((clip) => {
          const action = localPlayerMixer.current!.clipAction(clip);
          localPlayerActions.current[clip.name] = action;
          
          // Set default properties for walk animation
          if (clip.name === 'StickMan_Run') {
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = true;
            action.weight = 1.0;
            // Prepare the action but don't play it yet
            action.reset();
          }
        });
        
        console.log('Created local player animation actions:', Object.keys(localPlayerActions.current));
        
        // Start the walk animation in paused state so it's ready
        if (localPlayerActions.current.StickMan_Run) {
          const walkAction = localPlayerActions.current.StickMan_Run;
          walkAction.reset();
          walkAction.play();
          walkAction.paused = true;
          walkAction.enabled = true;
          console.log('Walk animation prepared in paused state');
          console.log('Walk action details:', {
            duration: walkAction.getClip().duration,
            weight: walkAction.weight,
            enabled: walkAction.enabled,
            paused: walkAction.paused,
            running: walkAction.isRunning()
          });
        } else {
          console.error('❌ StickMan_Run action was not created properly!');
        }
      }
      
      // Make the local player green to distinguish from others  
      localPlayerScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Clone the material to avoid affecting the template
          if (Array.isArray(child.material)) {
            child.material = child.material.map(mat => {
              const clonedMat = mat.clone();
              clonedMat.color.setHex(0x00ff00); // Green for local player
              return clonedMat;
            });
          } else {
            const clonedMaterial = child.material.clone();
            clonedMaterial.color.setHex(0x00ff00); // Green for local player
            child.material = clonedMaterial;
          }
        }
      });
      
      // Apply ground offset to position local player correctly
      localPlayerScene.position.set(
        localPlayerData.groundOffset?.x || 0,
        localPlayerData.groundOffset?.y || 0,
        localPlayerData.groundOffset?.z || 0
      );
      // Set initial rotation to match the user's current rotation (only Y rotation for character)
      localPlayerScene.rotation.y = localPlayerRotation.current.y + Math.PI;
      localPlayerScene.rotation.x = 0; // Keep character upright
      localPlayerScene.rotation.z = 0; // Keep character upright
      localPlayerScene.castShadow = true;
      scene.add(localPlayerScene);
      localPlayerRef.current = localPlayerScene;
    };
    
    // Initialize local player asynchronously
    createLocalPlayer();

    // TEST: Create a second stickman model in the center for debugging
    const createTestPlayer = async () => {
      console.log('🧪 Creating test player in center of map...');
      const testPlayerData = await loadPlayerModel();
      const testPlayerScene = testPlayerData.scene;
      
      // Apply ground offset to position correctly - same as local player
      testPlayerScene.position.set(
        testPlayerData.groundOffset?.x || 0,
        testPlayerData.groundOffset?.y || 0,
        testPlayerData.groundOffset?.z || 0
      );
      
      // Make the test player red to distinguish it
      testPlayerScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Clone the material to avoid affecting other models
          if (Array.isArray(child.material)) {
            child.material = child.material.map(mat => {
              const clonedMat = mat.clone();
              clonedMat.color.setHex(0xff0000); // Red for test player
              return clonedMat;
            });
          } else {
            const clonedMaterial = child.material.clone();
            clonedMaterial.color.setHex(0xff0000); // Red for test player
            child.material = clonedMaterial;
          }
        }
      });
      
      // Set up animation for test player
      let testMixer: THREE.AnimationMixer | null = null;
      let testActions: { [key: string]: THREE.AnimationAction } = {};
      
      if (testPlayerData.animations.length > 0) {
        testMixer = new THREE.AnimationMixer(testPlayerScene);
        
        testPlayerData.animations.forEach((clip) => {
          const action = testMixer!.clipAction(clip);
          testActions[clip.name] = action;
          
          if (clip.name === 'StickMan_Run') {
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = true;
            action.weight = 1.0;
            action.reset();
            action.play();
            action.paused = false; // Start running immediately
            action.enabled = true;
            console.log('🧪 Test player animation started');
          }
        });
      }
      
      testPlayerScene.castShadow = true;
      scene.add(testPlayerScene);
      
      console.log('🧪 Test player created at position:', testPlayerScene.position.toArray());
      
      // Store test player references for animation updates
      (window as any).testPlayer = {
        model: testPlayerScene,
        mixer: testMixer,
        actions: testActions
      };
    };
    
    // Create test player
    createTestPlayer();

    // Position camera behind and above the local player
    camera.position.set(0, 2.5, 5); // Adjusted for larger skeleton model
    camera.lookAt(0, 2.0, 0); // Look at adjusted head level

    // Handle window resize
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };

    // Handle mouse movement for player rotation
    const handleMouseMove = (event: MouseEvent) => {
      if (!isPointerLocked.current) return;
      
      const sensitivity = 0.002;
      localPlayerRotation.current.y -= event.movementX * sensitivity;
      localPlayerRotation.current.x -= event.movementY * sensitivity;
      
      // Limit vertical rotation
      localPlayerRotation.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, localPlayerRotation.current.x));
      
      // Apply only Y rotation to local player - character should only turn left/right, not tilt up/down
      // Add Math.PI to account for the model's built-in 180 degree rotation
      if (localPlayerRef.current) {
        localPlayerRef.current.rotation.y = localPlayerRotation.current.y + Math.PI;
        localPlayerRef.current.rotation.x = 0; // Keep character upright
        localPlayerRef.current.rotation.z = 0; // Keep character upright
      }
    };

    // Handle pointer lock
    const handlePointerLockChange = () => {
      isPointerLocked.current = document.pointerLockElement === canvasRef.current;
    };

    // Request pointer lock when canvas is clicked
    const handleCanvasClick = () => {
      if (canvasRef.current) {
        canvasRef.current.requestPointerLock();
      }
    };
    
    window.addEventListener('resize', handleResize);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    canvasRef.current.addEventListener('click', handleCanvasClick);

    // Start animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      // Call the current updateMovement function
      if (updateMovementRef.current) {
        updateMovementRef.current();
      }
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('click', handleCanvasClick);
      }
    };
  };

  // Initialize WebSocket connection
  const initWebSocket = async (serverAddress: string) => {
    try {
      // Get the Firebase auth token
      let authToken = null;
      if (user) {
        try {
          authToken = await user.getIdToken();
        } catch (error) {
          console.error('Error getting auth token:', error);
          setGameState({
            connected: false,
            error: 'Failed to get authentication token',
            loading: false
          });
          return;
        }
      }

      // Convert to WebSocket URL with appropriate protocol
      let wsUrl = serverAddress
        .replace(/^https?:\/\//, '') // Remove http/https prefix if present
        .replace(/^wss?:\/\//, '');   // Remove ws/wss prefix if present
      
      // Use secure WebSocket if page is served over HTTPS
      const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
      wsUrl = `${protocol}${wsUrl}`;

      // Add game endpoint if not present
      if (!wsUrl.includes('/game')) {
        wsUrl = `${wsUrl}/game`;
      }

      console.log('Attempting to connect to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to game server');
        setGameState({
          connected: true,
          error: null,
          loading: false
        });

        // Send initial connection message with auth token
        ws.send(JSON.stringify({
          type: 'connect',
          data: {
            playerId: user?.uid,
            userEmail: user?.email,
            authToken: authToken,
            position: {
              x: 0,
              y: 0, // Ground level
              z: 0
            },
            rotation: {
              x: 0,
              y: 0,
              z: 0
            },
            isMoving: false,
            movementDirection: 'none'
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: GameMessage = JSON.parse(event.data);
          handleGameMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setGameState({
          connected: false,
          error: 'Failed to connect to game server',
          loading: false
        });
      };

      ws.onclose = () => {
        console.log('Disconnected from game server');
        setGameState(prev => ({
          ...prev,
          connected: false
        }));
      };

    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      setGameState({
        connected: false,
        error: 'Invalid server address or authentication failed',
        loading: false
      });
    }
  };

  // Handle messages from game server
  const handleGameMessage = (message: GameMessage) => {
    console.log(`📨 WebSocket message received:`, {
      type: message.type,
      playerId: message.data?.playerId,
      position: message.data?.position,
      isMoving: message.data?.isMoving,
      movementDirection: message.data?.movementDirection
    });

    switch (message.type) {
      case 'player_joined':
        // New player joined the game
        if (message.data.playerId && message.data.position) {
          updatePlayer({
            id: message.data.playerId,
            position: message.data.position,
            rotation: message.data.rotation,
            isMoving: message.data.isMoving || false,
            movementDirection: message.data.movementDirection || 'none'
          }).catch(console.error);
        }
        break;
      
      case 'player_moved':
        // Player position update
        if (message.data.playerId && message.data.position) {
          updatePlayer({
            id: message.data.playerId,
            position: message.data.position,
            rotation: message.data.rotation,
            isMoving: message.data.isMoving || false,
            movementDirection: message.data.movementDirection || 'none'
          }).catch(console.error);
        }
        break;
      
      case 'player_left':
        // Player disconnected
        if (message.data.playerId) {
          removePlayer(message.data.playerId);
        }
        break;
      
      case 'players_list':
        // Initial list of all players currently in game
        if (message.data.players && Array.isArray(message.data.players)) {
          message.data.players.forEach((playerData: PlayerUpdate) => {
            // Don't add ourselves to the other players list
            if (playerData.id !== user?.uid) {
              updatePlayer(playerData).catch(console.error);
            }
          });
        }
        break;
      
      case 'world_data':
        // Server sends world/map data - for future implementation
        break;
      
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  // Handle keyboard input for smooth player movement
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!gameState.connected) return;

    // Prevent default for space key to avoid page scrolling
    if (event.code === 'Space') {
      event.preventDefault();
    }

    keysPressed.current.add(event.code);
  }, [gameState.connected]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    keysPressed.current.delete(event.code);
  }, []);

  // Cleanup function
  const cleanup = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    if (websocketRef.current) {
      websocketRef.current.close();
    }
    
    // Clean up animation mixers
    if (localPlayerMixer.current) {
      localPlayerMixer.current.stopAllAction();
      localPlayerMixer.current = null;
    }
    localPlayerActions.current = {};
    
    playersAnimations.current.forEach((animData) => {
      animData.mixer.stopAllAction();
    });
    playersAnimations.current.clear();
    
    // Clear key states
    keysPressed.current.clear();
    isPointerLocked.current = false;
    isMoving.current = false;
    movementDirection.current = 'none';
    
    // Exit pointer lock if active
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    
    // Clean up all player meshes
    const players = playersRef.current;
    players.forEach((player) => {
      if (player.mesh && sceneRef.current) {
        sceneRef.current.remove(player.mesh);
        
        // Dispose of resources properly for both meshes and groups
        if (player.mesh instanceof THREE.Mesh) {
          player.mesh.geometry.dispose();
          (player.mesh.material as THREE.Material).dispose();
        } else if (player.mesh instanceof THREE.Group) {
          // Dispose of all meshes in the group
          player.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              (child.material as THREE.Material).dispose();
            }
          });
        }
      }
    });
    players.clear();
    
    // Clean up local player
    if (localPlayerRef.current && sceneRef.current) {
      sceneRef.current.remove(localPlayerRef.current);
      
      // Dispose of resources properly for both meshes and groups
      if (localPlayerRef.current instanceof THREE.Mesh) {
        localPlayerRef.current.geometry.dispose();
        (localPlayerRef.current.material as THREE.Material).dispose();
      } else if (localPlayerRef.current instanceof THREE.Group) {
        // Dispose of all meshes in the group
        localPlayerRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
      }
      
      localPlayerRef.current = null;
    }
    
    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
  };

  // Handle authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Handle keyboard events
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Initialize game when component mounts and server is available
  useEffect(() => {
    if (!server || !user) return;

    const serverAddress = decodeURIComponent(server as string);
    
    // Initialize Three.js
    const cleanupThree = initThreeJS();
    
    // Initialize WebSocket connection (async)
    const initGame = async () => {
      await initWebSocket(serverAddress);
    };
    initGame();

    return () => {
      cleanup();
      if (cleanupThree) cleanupThree();
    };
  }, [server, user]);

  // Handle back to dashboard
  const handleBackToDashboard = () => {
    cleanup();
    router.push('/dashboard');
  };

  if (authLoading || !user) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!server) {
    return (
      <div className={styles.error}>
        <h2>No server specified</h2>
        <button onClick={handleBackToDashboard} className={styles.backButton}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={styles.gameContainer}>
      {/* HUD */}
      <div className={styles.hud}>
        <div className={styles.topLeft}>
          <button onClick={handleBackToDashboard} className={styles.backButton}>
            Back to Dashboard
          </button>
          <div className={styles.serverInfo}>
            Server: {decodeURIComponent(server as string)}
          </div>
        </div>
        
        <div className={styles.topRight}>
          <div className={styles.connectionStatus}>
            Status: {gameState.connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {gameState.loading && (
          <div className={styles.centerMessage}>
            <div className={styles.loading}>Connecting to server...</div>
          </div>
        )}

        {gameState.error && (
          <div className={styles.centerMessage}>
            <div className={styles.error}>{gameState.error}</div>
            <button onClick={handleBackToDashboard} className={styles.backButton}>
              Back to Dashboard
            </button>
          </div>
        )}

        {gameState.connected && (
          <div className={styles.controls}>
            <div>Controls: WASD to move, Space/Shift for up/down</div>
            <div>Mouse: Click to lock cursor, move mouse to look around (FPS-style camera controls)</div>
            <div>Players online: {playersRef.current.size + 1}</div>
            <div>Your character: Green skeleton with walking animation | Other players: Various colors</div>
          </div>
        )}
      </div>

      {/* Game Canvas */}
      <canvas ref={canvasRef} className={styles.gameCanvas} />
    </div>
  );
}
