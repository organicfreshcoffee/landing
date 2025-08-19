import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import { GameManager, GameState } from '../lib/game';
import { ensureProtocol } from '../lib/urlUtils';
import CharacterSelection, { CharacterData } from '../components/CharacterSelection';
import FloorTransitionLoader from '../components/FloorTransitionLoader';
import HealthHUD from '../components/HealthHUD';
import { DungeonApi } from '../lib/game/network/dungeonApi';
import styles from '../styles/Game.module.css';

export default function Game() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { server } = router.query;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterData | null>(null);
  const [checkingExistingCharacter, setCheckingExistingCharacter] = useState<boolean>(true);
  const [playerHealth, setPlayerHealth] = useState<{ health: number; maxHealth: number; isAlive: boolean }>({
    health: 100,
    maxHealth: 100,
    isAlive: true
  });
  const [isRespawning, setIsRespawning] = useState<boolean>(false);
  const [gameState, setGameState] = useState<GameState>({
    connected: false,
    error: null,
    loading: true
  });
  const [floorTransition, setFloorTransition] = useState<{
    isLoading: boolean;
    direction: 'upstairs' | 'downstairs';
    fromFloor: string;
    toFloor: string;
  }>({
    isLoading: false,
    direction: 'upstairs',
    fromFloor: '',
    toFloor: ''
  });
  const [currentFloor, setCurrentFloor] = useState<string>('Unknown');

  // Handle authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Check for existing character on mount
  useEffect(() => {
    if (!server || !user || authLoading) return;

    const checkExistingCharacter = async () => {
      try {
        setCheckingExistingCharacter(true);
        const serverAddress = ensureProtocol(decodeURIComponent(server as string));
                
        const statusResponse = await DungeonApi.getCurrentStatus(serverAddress);
        
        if (statusResponse.success && statusResponse.data.isAlive) {
                    
          // Set the character from server response
          setSelectedCharacter({
            type: statusResponse.data.character.type,
            style: statusResponse.data.character.style,
            name: statusResponse.data.character.name
          });

          // Set the health from server response
          setPlayerHealth({
            health: statusResponse.data.health,
            maxHealth: 100, // Assuming max health is 100, but this could come from server too
            isAlive: statusResponse.data.isAlive
          });

          // Store the player position and rotation for later use
          const playerPosition = statusResponse.data.position;
          const playerRotation = statusResponse.data.rotation;
                    
          // Store these in sessionStorage so GameManager can use them
          sessionStorage.setItem('playerPosition', JSON.stringify(playerPosition));
          sessionStorage.setItem('playerRotation', JSON.stringify(playerRotation));
        } else {
                  }
      } catch (error) {
        if (error instanceof Error && error.message === 'PLAYER_NOT_ALIVE') {
                  } else {
          console.error('❌ Error checking for existing character:', error);
        }
      } finally {
        setCheckingExistingCharacter(false);
      }
    };

    checkExistingCharacter();
  }, [server, user, authLoading, router]);

  // Initialize game when component mounts and server is available
  useEffect(() => {
    if (!server || !user || !canvasRef.current || !selectedCharacter) return;

    const serverAddress = ensureProtocol(decodeURIComponent(server as string));
            
    // Initialize game manager
    const initGame = async () => {
      const gameManager = new GameManager(
        canvasRef.current!, 
        setGameState, 
        user,
        selectedCharacter,
        setFloorTransition, // Pass floor transition state setter
        setCurrentFloor, // Pass current floor state setter
        setPlayerHealth, // Pass health update callback
        () => setIsRespawning(true) // Pass death callback
      );
      gameManagerRef.current = gameManager;
      
      // Connect to server
      await gameManager.connectToServer(serverAddress);
      
      // Add debug info to global scope for console debugging
      if (typeof window !== 'undefined') {
        (window as any).gameDebug = {
          gameManager,
          debugInfo: () => gameManager.debugInfo,
          selectedCharacter
        };
        // Also expose gameManager directly for easier access
        (window as any).gameManager = gameManager;
      }
    };
    
    initGame();

    return () => {
      if (gameManagerRef.current) {
        gameManagerRef.current.cleanup();
        gameManagerRef.current = null;
      }
    };
  }, [server, user, selectedCharacter]);

  // Handle back to dashboard
  const handleBackToDashboard = () => {
    if (gameManagerRef.current) {
      gameManagerRef.current.cleanup();
      gameManagerRef.current = null;
    }
    setSelectedCharacter(null);
    router.push('/dashboard');
  };

  // Handle character selection
  const handleCharacterSelected = (character: CharacterData) => {
        
    // Update the character state
    setSelectedCharacter(character);
    
    // If we're respawning, send respawn request
    if (isRespawning && gameManagerRef.current) {
            gameManagerRef.current.sendRespawnRequest(character);
      setIsRespawning(false);
      
      // Reset health to alive state (will be updated by server response)
      setPlayerHealth({
        health: 100,
        maxHealth: 100,
        isAlive: true
      });
    }
    
    // If we already have a running GameManager, update its character data
    if (gameManagerRef.current && !isRespawning) {
            gameManagerRef.current.updateSelectedCharacter(character);
    }
  };

  // Handle back from character selection
  const handleBackFromCharacterSelection = () => {
    router.push('/dashboard');
  };

  // Manual reconnect handler
  const handleManualReconnect = () => {
    if (!server || !gameManagerRef.current) return;
    
    const serverAddress = ensureProtocol(decodeURIComponent(server as string));
        gameManagerRef.current.manualReconnect(serverAddress);
  };

  // Render connection status with quality information
  const renderConnectionStatus = () => {
    if (gameState.loading) {
      return 'Status: Connecting...';
    }
    
    if (!gameState.connected) {
      const reconnectInfo = gameManagerRef.current && gameManagerRef.current.reconnectAttempts > 0 
        ? ` (Attempt ${gameManagerRef.current.reconnectAttempts}/${gameManagerRef.current.maxReconnectAttempts})`
        : '';
      return `Status: Disconnected${reconnectInfo}`;
    }

    // Connected - show quality if available
    if (gameState.connectionQuality) {
      const { pingMs, status } = gameState.connectionQuality;
      const statusEmoji = {
        excellent: '🟢',
        good: '🟡',
        fair: '🟠',
        poor: '🔴',
        unknown: '⚪'
      }[status];
      
      const pingText = pingMs !== null ? ` (${pingMs}ms)` : '';
      return `Status: Connected ${statusEmoji}${pingText}`;
    }

    return 'Status: Connected';
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

  // Show character selection if no character is selected yet or if respawning
  if (!selectedCharacter || isRespawning) {
    if (checkingExistingCharacter && !isRespawning) {
      return (
        <div className={styles.loading}>
          <h2>Checking for existing character...</h2>
          <p>Please wait while we check if you already have a character on this server.</p>
        </div>
      );
    }
    
    return (
      <CharacterSelection 
        onCharacterSelected={handleCharacterSelected}
        onBack={handleBackFromCharacterSelection}
      />
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
            Server: {ensureProtocol(decodeURIComponent(server as string))}
          </div>
          <div className={styles.characterInfo}>
            Character: {selectedCharacter.name} (Style {selectedCharacter.style})
          </div>
          <div className={styles.floorInfo}>
            Floor: {currentFloor}
          </div>
          <HealthHUD 
            health={playerHealth.health} 
            maxHealth={playerHealth.maxHealth} 
            isAlive={playerHealth.isAlive}
          />
        </div>
        
        <div className={styles.topRight}>
          <div className={styles.connectionStatus}>
            {renderConnectionStatus()}
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
            <div>
              <button onClick={handleBackToDashboard} className={styles.backButton}>
                Back to Dashboard
              </button>
              {!gameState.loading && (
                <button onClick={handleManualReconnect} className={styles.backButton} style={{ marginLeft: '10px' }}>
                  Reconnect
                </button>
              )}
            </div>
          </div>
        )}

        {!gameState.connected && !gameState.error && !gameState.loading && (
          <div className={styles.centerMessage}>
            <div className={styles.error}>Connection lost</div>
            <div>
              <button onClick={handleBackToDashboard} className={styles.backButton}>
                Back to Dashboard
              </button>
              <button onClick={handleManualReconnect} className={styles.backButton} style={{ marginLeft: '10px' }}>
                Reconnect
              </button>
            </div>
          </div>
        )}

        {gameState.connected && (
          <div className={styles.controls}>
            <div>Controls: WASD to move, Tab for Admin mode, 9 for Debug death</div>
            <div>Mouse: Click to lock cursor, move mouse to look around (FPS-style camera controls)</div>
            <div>Players online: {gameManagerRef.current?.playersCount || 1}</div>
          </div>
        )}
      </div>

      {/* Game Canvas */}
      <canvas ref={canvasRef} className={styles.gameCanvas} />

      {/* Floor Transition Loading Screen */}
      <FloorTransitionLoader
        isVisible={floorTransition.isLoading}
        direction={floorTransition.direction}
        fromFloor={floorTransition.fromFloor}
        toFloor={floorTransition.toFloor}
      />
    </div>
  );
}
