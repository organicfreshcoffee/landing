import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import * as THREE from 'three';
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
  color: string;
  mesh?: THREE.Mesh;
}

interface PlayerUpdate {
  id: string;
  position: { x: number; y: number; z: number };
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
  const localPlayerRef = useRef<THREE.Mesh | null>(null);
  
  const [gameState, setGameState] = useState<GameState>({
    connected: false,
    error: null,
    loading: true
  });

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

  // Create a player cube mesh
  const createPlayerCube = (player: Player): THREE.Mesh => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: player.color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(player.position.x, player.position.y, player.position.z);
    mesh.castShadow = true;
    return mesh;
  };

  // Add or update a player
  const updatePlayer = (playerData: PlayerUpdate) => {
    if (!sceneRef.current) return;

    const players = playersRef.current;
    const existingPlayer = players.get(playerData.id);

    if (existingPlayer) {
      // Update existing player position
      existingPlayer.position = playerData.position;
      if (existingPlayer.mesh) {
        existingPlayer.mesh.position.set(
          playerData.position.x,
          playerData.position.y,
          playerData.position.z
        );
      }
    } else {
      // Create new player
      const newPlayer: Player = {
        id: playerData.id,
        position: playerData.position,
        color: generatePlayerColor(playerData.id)
      };
      
      const mesh = createPlayerCube(newPlayer);
      newPlayer.mesh = mesh;
      sceneRef.current.add(mesh);
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
      player.mesh.geometry.dispose();
      (player.mesh.material as THREE.Material).dispose();
      players.delete(playerId);
    }
  };

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

    // Create local player cube (different color to distinguish from others)
    const localPlayerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const localPlayerMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 }); // Green for local player
    const localPlayerCube = new THREE.Mesh(localPlayerGeometry, localPlayerMaterial);
    localPlayerCube.position.set(0, 0.5, 0);
    localPlayerCube.castShadow = true;
    scene.add(localPlayerCube);
    localPlayerRef.current = localPlayerCube;

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

    window.addEventListener('resize', handleResize);

    // Start animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
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

      // Convert HTTP/HTTPS URLs to WebSocket URLs
      let wsUrl = serverAddress;
      if (serverAddress.startsWith('http://')) {
        wsUrl = serverAddress.replace('http://', 'ws://');
      } else if (serverAddress.startsWith('https://')) {
        wsUrl = serverAddress.replace('https://', 'wss://');
      } else if (!serverAddress.startsWith('ws://') && !serverAddress.startsWith('wss://')) {
        // Assume it's a plain address, add ws:// prefix
        wsUrl = `ws://${serverAddress}`;
      }

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
          });
        }
        break;
      
      case 'player_moved':
        // Player position update
        if (message.data.playerId && message.data.position) {
          updatePlayer({
            id: message.data.playerId,
            position: message.data.position
          });
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
              updatePlayer(playerData);
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

  // Handle keyboard input for player movement
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!gameState.connected || !localPlayerRef.current || !cameraRef.current) return;

    const moveSpeed = 0.5;
    const localPlayer = localPlayerRef.current;
    const camera = cameraRef.current;

    // Store old position
    const oldPosition = {
      x: localPlayer.position.x,
      y: localPlayer.position.y,
      z: localPlayer.position.z
    };

    switch (event.code) {
      case 'KeyW':
        localPlayer.position.z -= moveSpeed;
        break;
      case 'KeyS':
        localPlayer.position.z += moveSpeed;
        break;
      case 'KeyA':
        localPlayer.position.x -= moveSpeed;
        break;
      case 'KeyD':
        localPlayer.position.x += moveSpeed;
        break;
      case 'Space':
        event.preventDefault();
        localPlayer.position.y += moveSpeed;
        break;
      case 'ShiftLeft':
        localPlayer.position.y -= moveSpeed;
        break;
    }

    // Update camera to follow the player (third-person view)
    const playerPos = localPlayer.position;
    camera.position.set(
      playerPos.x,
      playerPos.y + 3,
      playerPos.z + 5
    );
    camera.lookAt(playerPos.x, playerPos.y, playerPos.z);

    // Send position update to server with debugging
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      const moveMessage = {
        type: 'player_move',
        data: {
          playerId: user?.uid,
          position: {
            x: localPlayer.position.x,
            y: localPlayer.position.y,
            z: localPlayer.position.z
          }
        }
      };
      console.log('Sending player_move message:', moveMessage);
      websocketRef.current.send(JSON.stringify(moveMessage));
    } else {
      console.log('WebSocket not ready:', {
        websocketExists: !!websocketRef.current,
        readyState: websocketRef.current?.readyState,
        connected: gameState.connected
      });
    }
  }, [gameState.connected, user?.uid]);

  // Cleanup function
  const cleanup = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    if (websocketRef.current) {
      websocketRef.current.close();
    }
    
    // Clean up all player meshes
    const players = playersRef.current;
    players.forEach((player) => {
      if (player.mesh && sceneRef.current) {
        sceneRef.current.remove(player.mesh);
        player.mesh.geometry.dispose();
        (player.mesh.material as THREE.Material).dispose();
      }
    });
    players.clear();
    
    // Clean up local player
    if (localPlayerRef.current && sceneRef.current) {
      sceneRef.current.remove(localPlayerRef.current);
      localPlayerRef.current.geometry.dispose();
      (localPlayerRef.current.material as THREE.Material).dispose();
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
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

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
