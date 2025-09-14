import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import { GameManager, GameState } from '../lib/game';
import { ensureProtocol } from '../lib/urlUtils';
import CharacterSelection, { CharacterData } from '../components/CharacterSelection';
import ServerConnectionError from '../components/ServerConnectionError';
import FloorTransitionLoader from '../components/FloorTransitionLoader';
import HealthHUD from '../components/HealthHUD';
import DeathSummary from '../components/DeathSummary';
import { DungeonGraphViewer } from '../components/DungeonGraphViewer';
import { DungeonApi } from '../lib/game/network/dungeonApi';
import { VisitedNode } from '../lib/game/types/api';
import { ToastManager } from '../lib/game/ui/toastManager';
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
  const [playerStamina, setPlayerStamina] = useState<{ stamina: number; maxStamina: number }>({
    stamina: 100,
    maxStamina: 100
  });
  const [playerMana, setPlayerMana] = useState<{ mana: number; maxMana: number }>({
    mana: 100,
    maxMana: 100
  });

  // Use refs to store current values for consumption functions
  const staminaRef = useRef(playerStamina);
  const manaRef = useRef(playerMana);

  // Update refs when state changes
  useEffect(() => {
    staminaRef.current = playerStamina;
  }, [playerStamina]);

  useEffect(() => {
    manaRef.current = playerMana;
  }, [playerMana]);
  const [isRespawning, setIsRespawning] = useState<boolean>(false);
  const [deathSummary, setDeathSummary] = useState<string | null>(null);
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

  // Initialize game for existing live characters only
  useEffect(() => {
    if (!server || !user || !canvasRef.current || connectionState !== 'connected' || !selectedCharacter || !checkingExistingCharacter) return;

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
        setDeathSummary, // Pass death summary callback
        handleOpenGraphViewer, // Pass graph viewer callback
        consumeStamina, // Pass stamina consumption function
        consumeMana, // Pass mana consumption function
        showToast // Pass toast notification function
      );
      gameManagerRef.current = gameManager;
      
      // Connect to server and WebSocket for existing live character
      await gameManager.connectToServer(serverAddress);
      console.log('🔌 Connecting WebSocket for existing live character');
      await gameManager.connectWebSocket();
      setCheckingExistingCharacter(false);
      
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
      
      console.log('🎮 Game initialized successfully for existing character');
    };
    
    initGame().catch((error) => {
      console.error('❌ Failed to initialize game:', error);
      setConnectionState('failed');
      setConnectionError('Failed to initialize game: ' + error.message);
    });

    return () => {
      if (gameManagerRef.current) {
        gameManagerRef.current.cleanup();
        gameManagerRef.current = null;
      }
    };
  }, [server, user, selectedCharacter, connectionState, checkingExistingCharacter]);

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
          
          if (statusResponse.success) {
            if (statusResponse.data.isAlive) {
              console.log('🎮 Player has live character, loading directly into game');
              
              // Safely access character data with defensive checks
              const characterData = statusResponse.data.character;
              if (characterData && characterData.type && characterData.style !== undefined && characterData.name) {
                setSelectedCharacter({
                  type: characterData.type,
                  style: characterData.style,
                  name: characterData.name
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
                
                // Mark as having an existing live character so GameManager will connect WebSocket
                setCheckingExistingCharacter(true);
              } else {
                console.warn('⚠️ Invalid character data received:', characterData);
                setConnectionState('failed');
                setConnectionError('Invalid character data received from server');
                return;
              }
            } else {
              console.log('💀 Player is dead, showing character selection for respawn');
              // Player is dead, show character selection screen
              // Don't set selectedCharacter or checkingExistingCharacter
              // The character selection screen will handle respawning
            }
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

  // Stamina regeneration
  useEffect(() => {
    const staminaRegenInterval = setInterval(() => {
      setPlayerStamina(prev => ({
        ...prev,
        stamina: Math.min(prev.maxStamina, prev.stamina + 2) // Regen 2 stamina per second
      }));
    }, 1000);

    return () => clearInterval(staminaRegenInterval);
  }, []);

  // Mana regeneration
  useEffect(() => {
    const manaRegenInterval = setInterval(() => {
      setPlayerMana(prev => ({
        ...prev,
        mana: Math.min(prev.maxMana, prev.mana + 1) // Regen 1 mana per second
      }));
    }, 1000);

    return () => clearInterval(manaRegenInterval);
  }, []);

  // Health regeneration
  useEffect(() => {
    const healthRegenInterval = setInterval(() => {
      setPlayerHealth(prev => {
        // Only regenerate if player is alive and health is below max
        if (!prev.isAlive || prev.health >= prev.maxHealth) {
          return prev;
        }

        const newHealth = Math.min(prev.maxHealth, prev.health + 1); // Regen 1 health per second
        
        // Send health update to server when health changes
        if (newHealth !== prev.health && gameManagerRef.current) {
          gameManagerRef.current.sendHealthUpdate(newHealth, prev.maxHealth);
        }

        return {
          ...prev,
          health: newHealth
        };
      });
    }, 1000);

    return () => clearInterval(healthRegenInterval);
  }, []);

  // Stamina consumption function
  const consumeStamina = (amount: number): boolean => {
    const currentStamina = staminaRef.current.stamina;
    console.log('🔍 Stamina consumption check:', {
      currentStamina,
      requiredAmount: amount,
      hasEnough: currentStamina >= amount
    });
    
    if (currentStamina >= amount) {
      setPlayerStamina(prev => ({
        ...prev,
        stamina: Math.max(0, prev.stamina - amount)
      }));
      console.log('✅ Stamina consumed successfully');
      return true;
    }
    console.log('❌ Insufficient stamina');
    return false;
  };

  // Mana consumption function
  const consumeMana = (amount: number): boolean => {
    const currentMana = manaRef.current.mana;
    console.log('🔍 Mana consumption check:', {
      currentMana,
      requiredAmount: amount,
      hasEnough: currentMana >= amount
    });
    
    if (currentMana >= amount) {
      setPlayerMana(prev => ({
        ...prev,
        mana: Math.max(0, prev.mana - amount)
      }));
      console.log('✅ Mana consumed successfully');
      return true;
    }
    console.log('❌ Insufficient mana');
    return false;
  };

  // Toast notification function using existing ToastManager
  const showToast = (message: string, type?: 'error' | 'warning' | 'info') => {
    const toastManager = ToastManager.getInstance();
    
    switch (type) {
      case 'error':
        toastManager.showError(message);
        break;
      case 'warning':
        toastManager.showWarning(message);
        break;
      case 'info':
      default:
        toastManager.showInfo(message);
        break;
    }
  };

  // Handle character selection
  const handleCharacterSelected = async (character: CharacterData) => {
    console.log('🎯 handleCharacterSelected called with character:', character);
    try {
      // Update the character state
      setSelectedCharacter(character);
      
      const serverAddress = ensureProtocol(decodeURIComponent(server as string));
      console.log('🌐 Server address for spawn:', serverAddress);
      
      // If we don't have a GameManager yet, create it now with the selected character
      if (!gameManagerRef.current && canvasRef.current) {
        console.log('🎮 Creating GameManager for new character');
        const gameManager = new GameManager(
          canvasRef.current!, 
          setGameState, 
          user,
          character,
          setFloorTransition,
          setCurrentFloor,
          setPlayerHealth,
          () => setIsRespawning(true),
          setDeathSummary,
          handleOpenGraphViewer,
          consumeStamina,
          consumeMana,
          showToast
        );
        gameManagerRef.current = gameManager;
        
        console.log('🔗 Connecting to server...');
        // Connect to server (but not WebSocket yet)
        await gameManager.connectToServer(serverAddress);
        console.log('✅ Connected to server successfully');
      } else if (gameManagerRef.current) {
        console.log('🔄 Using existing GameManager');
      } else {
        console.error('❌ No canvas available for GameManager creation');
        return;
      }
      
      // Spawn the player using the new spawn endpoint
      if (gameManagerRef.current) {
        console.log('🚀 Spawning player with character:', character);
        const success = await gameManagerRef.current.spawnPlayer(character);
        
        if (success) {
          console.log('✅ Player spawned successfully, connecting WebSocket');
          // Small delay to ensure server has processed the spawn
          await new Promise(resolve => setTimeout(resolve, 500));
          // After successful spawn, connect to WebSocket
          await gameManagerRef.current.connectWebSocket();
          
          // Reset health and resources to alive state
          setPlayerHealth({
            health: 100,
            maxHealth: 100,
            isAlive: true
          });
          
          setPlayerStamina({
            stamina: 100,
            maxStamina: 100
          });
          
          setPlayerMana({
            mana: 100,
            maxMana: 100
          });
          
          // Clear any existing death/respawn states
          setIsRespawning(false);
          setDeathSummary(null);
        } else {
          console.error('❌ Failed to spawn player');
          // Could show an error message to the user here
        }
      }
    } catch (error) {
      console.error('❌ Error during character selection:', error);
      // Could show an error message to the user here
    }
  };

  // Handle back from character selection
  const handleBackFromCharacterSelection = () => {
    router.push('/dashboard');
  };

  // Handle death summary continue - shows character selection
  const handleDeathSummaryContinue = () => {
    setDeathSummary(null);
    setIsRespawning(true);
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

  // Show death summary if player died
  if (deathSummary) {
    return (
      <DeathSummary 
        deathSummary={deathSummary}
        onContinue={handleDeathSummaryContinue}
      />
    );
  }

  // Show character selection overlay if connection is established but no character is selected yet or if respawning
  const showCharacterSelection = connectionState === 'connected' && (!selectedCharacter || isRespawning);

  // Always render the main container, but show character selection when needed
  // Don't return early when no character is selected - let the overlay handle it

  return (
    <div className={styles.gameContainer}>
      {/* Character Selection Overlay */}
      {showCharacterSelection && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
          <CharacterSelection 
            onCharacterSelected={handleCharacterSelected}
            onBack={handleBackFromCharacterSelection}
          />
        </div>
      )}

      {/* HUD - only show when character is selected and not in character selection */}
      {selectedCharacter && !showCharacterSelection && (
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
              stamina={playerStamina.stamina}
              maxStamina={playerStamina.maxStamina}
              mana={playerMana.mana}
              maxMana={playerMana.maxMana}
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
      )}

      {/* Game Canvas - always render so it's available for GameManager creation */}
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
        currentFloor={currentFloor}
      />
    </div>
  );
}
