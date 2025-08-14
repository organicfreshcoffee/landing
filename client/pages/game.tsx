import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import { GameManager, GameState } from '../lib/game';
import { ensureProtocol } from '../lib/urlUtils';
import CharacterSelection, { CharacterData } from '../components/CharacterSelection';
import FloorTransitionLoader from '../components/FloorTransitionLoader';
import styles from '../styles/Game.module.css';

export default function Game() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { server } = router.query;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterData | null>(null);
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

  // Handle authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Initialize game when component mounts and server is available
  useEffect(() => {
    if (!server || !user || !canvasRef.current || !selectedCharacter) return;

    const serverAddress = ensureProtocol(decodeURIComponent(server as string));
    console.log('🔗 Game: Connecting to server with protocol:', serverAddress);
    console.log('🎮 Selected Character:', selectedCharacter);
    
    // Initialize game manager
    const initGame = async () => {
      const gameManager = new GameManager(
        canvasRef.current!, 
        setGameState, 
        user,
        setFloorTransition // Pass floor transition state setter
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
    setSelectedCharacter(character);
  };

  // Handle back from character selection
  const handleBackFromCharacterSelection = () => {
    router.push('/dashboard');
  };

  // Manual reconnect handler
  const handleManualReconnect = () => {
    if (!server || !gameManagerRef.current) return;
    
    const serverAddress = ensureProtocol(decodeURIComponent(server as string));
    console.log('🔄 Game: Manual reconnect to server:', serverAddress);
    gameManagerRef.current.manualReconnect(serverAddress);
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

  // Show character selection if no character is selected yet
  if (!selectedCharacter) {
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
        </div>
        
        <div className={styles.topRight}>
          <div className={styles.connectionStatus}>
            Status: {gameState.connected ? 'Connected' : gameState.loading ? 'Connecting...' : 'Disconnected'}
            {gameManagerRef.current && gameManagerRef.current.reconnectAttempts > 0 && (
              <span> (Attempt {gameManagerRef.current.reconnectAttempts}/{gameManagerRef.current.maxReconnectAttempts})</span>
            )}
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
            <div>Controls: WASD to move, Tab for Admin mode</div>
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
