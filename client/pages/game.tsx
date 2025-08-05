import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
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
}

interface PlayerUpdate {
  id: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
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
  
  const [gameState, setGameState] = useState<GameState>({
    connected: false,
    error: null,
    loading: true
  });

  // Load 3D player model
  const loadPlayerModel = async (): Promise<THREE.Group | THREE.Mesh> => {
    // First try to load the human model (GLB format)
    try {
      if (!gltfLoaderRef.current) {
        gltfLoaderRef.current = new GLTFLoader();
      }
      
      console.log('Attempting to load human_male.glb...');
      const gltf = await gltfLoaderRef.current.loadAsync('/assets/3d-models/human_male.glb');
      console.log('Successfully loaded human_male.glb');
      
      // Scale the model if needed (adjust based on your model's size)
      gltf.scene.scale.set(0.5, 0.5, 0.5);
      
      return gltf.scene;
    } catch (error) {
      console.log('GLB model not available, using fallback cube:', error);
      
      // Fallback to cube geometry with improved appearance
      const geometry = new THREE.BoxGeometry(1, 2, 0.5); // Make it more human-like proportions
      const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      
      return mesh;
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

  // Create a player model (cube or 3D model)
  const createPlayerModel = async (player: Player): Promise<THREE.Object3D> => {
    const model = await loadPlayerModel();
    
    // Clone the model for each player instance
    const playerModel = model.clone();
    
    // Apply player-specific properties
    if (playerModel instanceof THREE.Mesh) {
      // If it's a mesh (cube fallback), apply the player color
      const material = (playerModel.material as THREE.MeshLambertMaterial).clone();
      material.color.setHex(parseInt(player.color.replace('#', '0x')));
      playerModel.material = material;
    } else if (playerModel instanceof THREE.Group) {
      // If it's a group (3D model), apply color to all meshes
      playerModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = (child.material as THREE.MeshLambertMaterial).clone();
          material.color.setHex(parseInt(player.color.replace('#', '0x')));
          child.material = material;
        }
      });
    }
    
    // Set position
    playerModel.position.set(player.position.x, player.position.y, player.position.z);
    playerModel.castShadow = true;
    
    return playerModel;
  };

  // Add or update a player
  const updatePlayer = async (playerData: PlayerUpdate) => {
    if (!sceneRef.current) return;

    const players = playersRef.current;
    const existingPlayer = players.get(playerData.id);

    if (existingPlayer) {
      // Update existing player position
      existingPlayer.position = playerData.position;
      if (playerData.rotation) {
        existingPlayer.rotation = playerData.rotation;
      }
      if (existingPlayer.mesh) {
        existingPlayer.mesh.position.set(
          playerData.position.x,
          playerData.position.y,
          playerData.position.z
        );
        if (playerData.rotation) {
          existingPlayer.mesh.rotation.set(
            playerData.rotation.x,
            playerData.rotation.y,
            playerData.rotation.z
          );
        }
      }
    } else {
      // Create new player
      const newPlayer: Player = {
        id: playerData.id,
        position: playerData.position,
        rotation: playerData.rotation || { x: 0, y: 0, z: 0 },
        color: generatePlayerColor(playerData.id)
      };
      
      const model = await createPlayerModel(newPlayer);
      newPlayer.mesh = model; // No need to cast anymore
      sceneRef.current.add(model);
      players.set(playerData.id, newPlayer);
    }
  };

  // Remove a player
  const removePlayer = (playerId: string) => {
    if (!sceneRef.current) return;

    const players = playersRef.current;
    const player = players.get(playerId);
    
    if (player && player.mesh) {
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

    if (keysPressed.current.has('KeyW')) {
      localPlayer.position.add(forward.clone().multiplyScalar(moveSpeed));
      moved = true;
    }
    if (keysPressed.current.has('KeyS')) {
      localPlayer.position.add(forward.clone().multiplyScalar(-moveSpeed));
      moved = true;
    }
    if (keysPressed.current.has('KeyA')) {
      localPlayer.position.add(right.clone().multiplyScalar(-moveSpeed));
      moved = true;
    }
    if (keysPressed.current.has('KeyD')) {
      localPlayer.position.add(right.clone().multiplyScalar(moveSpeed));
      moved = true;
    }
    if (keysPressed.current.has('Space')) {
      localPlayer.position.y += moveSpeed;
      moved = true;
    }
    if (keysPressed.current.has('ShiftLeft')) {
      localPlayer.position.y -= moveSpeed;
      moved = true;
    }

    // Update camera to follow the player with proper FPS-style rotation
    const playerPos = localPlayer.position;
    const cameraOffset = new THREE.Vector3(0, 3, 5);
    
    // Apply player's Y rotation to camera offset
    cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), localPlayerRotation.current.y);
    
    // Set camera position
    camera.position.set(
      playerPos.x + cameraOffset.x,
      playerPos.y + cameraOffset.y,
      playerPos.z + cameraOffset.z
    );
    
    // Calculate look-at point based on player rotation
    const lookDirection = new THREE.Vector3(0, 0, -1);
    lookDirection.applyAxisAngle(new THREE.Vector3(1, 0, 0), localPlayerRotation.current.x); // Apply X rotation
    lookDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), localPlayerRotation.current.y); // Apply Y rotation
    
    const lookAtPoint = new THREE.Vector3(
      playerPos.x + lookDirection.x,
      playerPos.y + lookDirection.y,
      playerPos.z + lookDirection.z
    );
    
    camera.lookAt(lookAtPoint);

    // Send updates to server if position or rotation changed (with throttling)
    const now = Date.now();
    if ((moved || 
        Math.abs(oldRotation.x - localPlayerRotation.current.x) > 0.01 ||
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
              x: localPlayerRotation.current.x,
              y: localPlayerRotation.current.y,
              z: localPlayerRotation.current.z
            }
          }
        };
        websocketRef.current.send(JSON.stringify(moveMessage));
      }
    }
  }, [gameState.connected, user?.uid]);

  // Update the ref whenever the function changes
  useEffect(() => {
    updateMovementRef.current = updateMovement;
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
      0.1,
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

    // Create local player (async, so we'll add it after scene setup)
    const createLocalPlayer = async () => {
      const localPlayer = await loadPlayerModel();
      
      // Make the local player green to distinguish from others  
      if (localPlayer instanceof THREE.Mesh) {
        const material = (localPlayer.material as THREE.MeshLambertMaterial);
        material.color.setHex(0x00ff00); // Green for local player
      } else if (localPlayer instanceof THREE.Group) {
        localPlayer.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const material = (child.material as THREE.MeshLambertMaterial);
            material.color.setHex(0x00ff00); // Green for local player
          }
        });
      }
      
      localPlayer.position.set(0, 0.5, 0);
      localPlayer.castShadow = true;
      scene.add(localPlayer);
      localPlayerRef.current = localPlayer; // No need to cast anymore
    };
    
    // Initialize local player asynchronously
    createLocalPlayer();

    // Position camera behind and above the local player
    camera.position.set(0, 3, 5);
    camera.lookAt(0, 0.5, 0);

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
      
      // Apply rotation to local player
      if (localPlayerRef.current) {
        localPlayerRef.current.rotation.y = localPlayerRotation.current.y;
        localPlayerRef.current.rotation.x = localPlayerRotation.current.x;
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
              y: 0.5,
              z: 0
            },
            rotation: {
              x: 0,
              y: 0,
              z: 0
            }
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
    console.log('Received message:', message);

    switch (message.type) {
      case 'player_joined':
        // New player joined the game
        if (message.data.playerId && message.data.position) {
          updatePlayer({
            id: message.data.playerId,
            position: message.data.position
          }).catch(console.error);
        }
        break;
      
      case 'player_moved':
        // Player position update
        if (message.data.playerId && message.data.position) {
          updatePlayer({
            id: message.data.playerId,
            position: message.data.position
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
    
    // Clear key states
    keysPressed.current.clear();
    isPointerLocked.current = false;
    
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
            <div>Mouse: Click to lock cursor, move mouse to look around (FPS style)</div>
            <div>Players online: {playersRef.current.size + 1}</div>
            <div>Your cube: Green | Other players: Various colors</div>
          </div>
        )}
      </div>

      {/* Game Canvas */}
      <canvas ref={canvasRef} className={styles.gameCanvas} />
    </div>
  );
}
