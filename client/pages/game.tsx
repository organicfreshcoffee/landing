import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import { GameManager, GameState } from '../lib/game';
import { ensureProtocol } from '../lib/urlUtils';
import CharacterSelection, { CharacterData } from '../components/CharacterSelection';
import ServerConnectionError from '../components/ServerConnectionError';
import FloorTransitionLoader from '../components/FloorTransitionLoader';
import HealthHUD from '../components/HealthHUD';
import { DungeonGraphViewer } from '../components/DungeonGraphViewer';
import { DungeonApi } from '../lib/game/network/dungeonApi';
import { VisitedNode } from '../lib/game/types/api';
import styles from '../styles/Game.module.css';

export default function Game() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { server } = router.query;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  
  // Connection state - tracks the initial server connection
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  const [connectionError, setConnectionError] = useState<string>('');
  
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterData | null>(null);
  const [checkingExistingCharacter, setCheckingExistingCharacter] = useState<boolean>(false);
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
  const [showGraphViewer, setShowGraphViewer] = useState<boolean>(false);
  const [visitedNodes, setVisitedNodes] = useState<VisitedNode[]>([]);

  // Handle authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Initial server connection check
  useEffect(() => {
    if (!server || !user || authLoading) return;
    
    // Reset state when server/user changes
    setConnectionState('connecting');
    setConnectionError('');
    setSelectedCharacter(null);
  }, [server, user, authLoading]);

  // Initialize game when component mounts and server is available
  useEffect(() => {
    if (!server || !user || !canvasRef.current || !selectedCharacter || connectionState !== 'connected') return;

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
        () => setIsRespawning(true), // Pass death callback
        handleOpenGraphViewer // Pass graph viewer callback
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
  }, [server, user, selectedCharacter, connectionState]);

  // Handle back to dashboard
  const handleBackToDashboard = () => {
    if (gameManagerRef.current) {
      gameManagerRef.current.cleanup();
      gameManagerRef.current = null;
    }
    setSelectedCharacter(null);
    router.push('/dashboard');
  };

  // Handle connection retry
  const handleConnectionRetry = () => {
    // If we already have a selected character, use GameManager's reconnect instead
    if (selectedCharacter && gameManagerRef.current) {
      const serverAddress = ensureProtocol(decodeURIComponent(server as string));
      gameManagerRef.current.manualReconnect(serverAddress);
    } else {
      // Only reset connection state if we're in initial connection phase
      setConnectionState('connecting');
      setConnectionError('');
    }
  };

  // Trigger a re-run of the connection check when retrying
  useEffect(() => {
    if (connectionState === 'connecting' && server && user && !authLoading) {
      const checkServerConnection = async () => {
        try {
          const serverAddress = ensureProtocol(decodeURIComponent(server as string));
          
          console.log('🔗 Checking server connection to:', serverAddress);
          
          const statusResponse = await DungeonApi.getCurrentStatus(serverAddress);
          
          console.log('✅ Server connection successful:', statusResponse);
          setConnectionState('connected');
          
          if (statusResponse.success && statusResponse.data.isAlive) {
            console.log('🎮 Player has live character, loading directly into game');
            
            // Set the character from server response
            setSelectedCharacter({
              type: statusResponse.data.character.type,
              style: statusResponse.data.character.style,
              name: statusResponse.data.character.name
            });

            // Set the health from server response
            setPlayerHealth({
              health: statusResponse.data.health,
              maxHealth: 100,
              isAlive: statusResponse.data.isAlive
            });

            // Store the player position and rotation for later use
            const playerPosition = statusResponse.data.position;
            const playerRotation = statusResponse.data.rotation;
            
            // Store these in sessionStorage so GameManager can use them
            sessionStorage.setItem('playerPosition', JSON.stringify(playerPosition));
            sessionStorage.setItem('playerRotation', JSON.stringify(playerRotation));
          } else {
            console.log('🏗️ Player needs to create/select character');
          }
        } catch (error) {
          if (error instanceof Error && error.message === 'PLAYER_NOT_ALIVE') {
            console.log('💀 Player is dead, will show character selection');
            setConnectionState('connected');
          } else {
            console.error('❌ Server connection failed:', error);
            setConnectionState('failed');
            
            // Extract useful error message
            let errorMessage = 'Unknown connection error';
            if (error instanceof Error) {
              errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null && 'message' in error) {
              errorMessage = (error as any).message;
            }
            
            setConnectionError(errorMessage);
          }
        }
      };

      // Small delay to show the connecting state
      const timer = setTimeout(checkServerConnection, 500);
      return () => clearTimeout(timer);
    }
  }, [connectionState, server, user, authLoading]);

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔄 State update:', { 
      connectionState, 
      hasSelectedCharacter: !!selectedCharacter,
      gameStateConnected: gameState.connected,
      gameStateLoading: gameState.loading,
      gameStateError: gameState.error 
    });
  }, [connectionState, selectedCharacter, gameState]);

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

  const handleOpenGraphViewer = async () => {
    if (!server) return;
    
    try {
      const serverAddress = ensureProtocol(decodeURIComponent(server as string));
      const response = await DungeonApi.getVisitedNodes(serverAddress);
      
      if (response.success) {
        setVisitedNodes(response.data);
        setShowGraphViewer(true);
      }
    } catch (error) {
      console.error('Error fetching visited nodes:', error);
    }
  };

  const handleCloseGraphViewer = () => {
    setShowGraphViewer(false);
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

  // Show connection error screen (only for initial connection before we've ever connected)
  if (connectionState === 'failed' && !selectedCharacter) {
    return (
      <ServerConnectionError
        serverAddress={ensureProtocol(decodeURIComponent(server as string))}
        error={connectionError}
        onRetry={handleConnectionRetry}
        onBack={handleBackToDashboard}
      />
    );
  }

  // Show character selection if connection is established but no character is selected yet or if respawning
  if (connectionState === 'connected' && (!selectedCharacter || isRespawning)) {
    return (
      <CharacterSelection 
        onCharacterSelected={handleCharacterSelected}
        onBack={handleBackFromCharacterSelection}
      />
    );
  }

  if (!selectedCharacter) {
    return (<div className={styles.gameContainer}></div>);
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
            <div>Controls: WASD to move, Tab for Admin mode, 9 for Debug death, P for Dungeon Graph</div>
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

      {/* Dungeon Graph Viewer */}
      <DungeonGraphViewer
        nodes={visitedNodes}
        isVisible={showGraphViewer}
        onClose={handleCloseGraphViewer}
      />
    </div>
  );
}
