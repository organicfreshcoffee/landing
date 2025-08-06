import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import { GameManager, GameState } from '../lib/game';
import styles from '../styles/Game.module.css';

export default function Game() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { server } = router.query;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  
  const [gameState, setGameState] = useState<GameState>({
    connected: false,
    error: null,
    loading: true
  });

  // Handle authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Initialize game when component mounts and server is available
  useEffect(() => {
    if (!server || !user || !canvasRef.current) return;

    const serverAddress = decodeURIComponent(server as string);
    
    // Initialize game manager
    const initGame = async () => {
      const gameManager = new GameManager(canvasRef.current!, setGameState, user);
      gameManagerRef.current = gameManager;
      
      // Connect to server
      await gameManager.connectToServer(serverAddress);
      
      // Add debug info to global scope for console debugging
      if (typeof window !== 'undefined') {
        (window as any).gameDebug = {
          gameManager,
          debugInfo: () => gameManager.debugInfo
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
  }, [server, user]);

  // Handle back to dashboard
  const handleBackToDashboard = () => {
    if (gameManagerRef.current) {
      gameManagerRef.current.cleanup();
      gameManagerRef.current = null;
    }
    router.push('/dashboard');
  };

  // Manual reconnect handler
  const handleManualReconnect = () => {
    if (!server || !gameManagerRef.current) return;
    
    const serverAddress = decodeURIComponent(server as string);
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
            <div>Controls: WASD to move, Space/Shift for up/down</div>
            <div>Mouse: Click to lock cursor, move mouse to look around (FPS-style camera controls)</div>
            <div>Players online: {gameManagerRef.current?.playersCount || 1}</div>
            <div>Your character: Green skeleton with walking animation | Other players: Various colors</div>
          </div>
        )}
      </div>

      {/* Game Canvas */}
      <canvas ref={canvasRef} className={styles.gameCanvas} />
    </div>
  );
}
