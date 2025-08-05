import { useEffect, useRef, useState } from 'react';
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
  
  const [gameState, setGameState] = useState<GameState>({
    connected: false,
    error: null,
    loading: true
  });

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

    // Add a test cube (will be replaced by server-provided content)
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cubeMaterial = new THREE.MeshLambertMaterial({ color: 0xff6b6b });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(0, 1, 0);
    cube.castShadow = true;
    scene.add(cube);

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
  const initWebSocket = (serverAddress: string) => {
    try {
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

        // Send initial connection message
        ws.send(JSON.stringify({
          type: 'connect',
          data: {
            userId: user?.uid,
            userEmail: user?.email
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
        error: 'Invalid server address',
        loading: false
      });
    }
  };

  // Handle messages from game server
  const handleGameMessage = (message: GameMessage) => {
    console.log('Received message:', message);

    switch (message.type) {
      case 'world_data':
        // Server sends world/map data - will implement based on server protocol
        break;
      case 'player_update':
        // Update other players' positions
        break;
      case 'game_state':
        // Update game state
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  // Handle keyboard input for FPS controls
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!gameState.connected || !cameraRef.current) return;

    const moveSpeed = 0.5;
    const camera = cameraRef.current;

    switch (event.code) {
      case 'KeyW':
        camera.position.z -= moveSpeed;
        break;
      case 'KeyS':
        camera.position.z += moveSpeed;
        break;
      case 'KeyA':
        camera.position.x -= moveSpeed;
        break;
      case 'KeyD':
        camera.position.x += moveSpeed;
        break;
      case 'Space':
        event.preventDefault();
        camera.position.y += moveSpeed;
        break;
      case 'ShiftLeft':
        camera.position.y -= moveSpeed;
        break;
    }

    // Send position update to server
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: 'player_move',
        data: {
          position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z
          }
        }
      }));
    }
  };

  // Cleanup function
  const cleanup = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    if (websocketRef.current) {
      websocketRef.current.close();
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

  // Initialize game when component mounts and server is available
  useEffect(() => {
    if (!server || !user) return;

    const serverAddress = decodeURIComponent(server as string);
    
    // Initialize Three.js
    const cleanupThree = initThreeJS();
    
    // Initialize WebSocket connection
    initWebSocket(serverAddress);

    // Add keyboard listeners
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cleanup();
      if (cleanupThree) cleanupThree();
      window.removeEventListener('keydown', handleKeyDown);
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
          </div>
        )}
      </div>

      {/* Game Canvas */}
      <canvas ref={canvasRef} className={styles.gameCanvas} />
    </div>
  );
}
