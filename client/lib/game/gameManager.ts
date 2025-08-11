import * as THREE from 'three';
import { GameState, GameMessage, Player, PlayerUpdate, PlayerAnimationData } from './types';
import { ModelLoader } from './modelLoader';
import { PlayerManager } from './playerManager';
import { WebSocketManager } from './webSocketManager';
import { MovementController } from './movementController';
import { SceneManager } from './sceneManager';

export class GameManager {
  private sceneManager: SceneManager;
  private webSocketManager: WebSocketManager;
  private movementController: MovementController;
  
  private localPlayerRef = { current: null as THREE.Object3D | null };
  private localPlayerMixer = { current: null as THREE.AnimationMixer | null };
  private localPlayerActions = { current: {} as { [key: string]: THREE.AnimationAction } };
  
  private players = new Map<string, Player>();
  private playersAnimations = new Map<string, PlayerAnimationData>();

  constructor(
    canvas: HTMLCanvasElement,
    private onStateChange: (state: GameState) => void,
    private user: any
  ) {
    this.sceneManager = new SceneManager(canvas);
    this.webSocketManager = new WebSocketManager(onStateChange, this.handleGameMessage.bind(this));
    this.movementController = new MovementController(
      this.localPlayerRef,
      { current: this.sceneManager.camera },
      this.localPlayerMixer,
      this.localPlayerActions,
      this.playersAnimations,
      () => this.webSocketManager.isConnected,
      (message) => this.webSocketManager.send(JSON.stringify(message))
    );

    this.initializeGame();
  }

  private async initializeGame(): Promise<void> {
    // Create local player
    await this.createLocalPlayer();

    // Set up canvas click handler for pointer lock
    this.movementController.setupCanvasClickHandler(this.sceneManager.renderer.domElement);

    // Start render loop
    this.sceneManager.startRenderLoop(() => {
      if (this.user?.uid) {
        this.movementController.updateMovement(this.user.uid);
      }
    });

    // Set up visibility change handler
    this.setupVisibilityHandler();

    // Set up network connectivity handlers
    this.setupNetworkHandlers();
  }

  private async createLocalPlayer(): Promise<void> {
    const localPlayerData = await ModelLoader.loadPlayerModel();
    const localPlayerScene = localPlayerData.scene;
    
    // Set up animations for local player
    if (localPlayerData.animations.length > 0) {
      this.localPlayerMixer.current = new THREE.AnimationMixer(localPlayerScene);
      
      localPlayerData.animations.forEach((clip) => {
        const action = this.localPlayerMixer.current!.clipAction(clip);
        this.localPlayerActions.current[clip.name] = action;
        
        // Set default properties for walk animation
        if (clip.name === 'StickMan_Run') {
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.clampWhenFinished = true;
          action.weight = 1.0;
          // Prepare the action but don't play it yet
          action.reset();
        }
      });
      
      // Start the walk animation in paused state so it's ready
      if (this.localPlayerActions.current.StickMan_Run) {
        const walkAction = this.localPlayerActions.current.StickMan_Run;
        walkAction.reset();
        walkAction.play();
        walkAction.paused = true;
        walkAction.enabled = true;
      } else {
        console.error('❌ StickMan_Run action was not created properly!');
      }
    }
    
    // Make the local player green to distinguish from others  
    localPlayerScene.traverse((child: THREE.Object3D) => {
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
    // Set initial rotation (only Y rotation for character)
    localPlayerScene.rotation.y = Math.PI; // Face away from camera initially
    localPlayerScene.rotation.x = 0; // Keep character upright
    localPlayerScene.rotation.z = 0; // Keep character upright
    localPlayerScene.castShadow = true;
    
    // Mark as player object to prevent it from being cleared by scenery loading
    localPlayerScene.userData.isPlayer = true;
    localPlayerScene.userData.playerId = this.user?.uid || 'local';
    
    this.sceneManager.addToScene(localPlayerScene);
    this.localPlayerRef.current = localPlayerScene;
  }

  async connectToServer(serverAddress: string): Promise<void> {
    console.log(`🔗 GameManager: Connecting to server ${serverAddress}`);
    
    // Set server address for dungeon API calls
    this.sceneManager.setServerAddress(serverAddress);
    
    // Load initial scenery from server
    console.log(`🎮 GameManager: Loading scenery from server...`);
    await this.sceneManager.loadScenery();
    console.log(`✅ GameManager: Scenery loaded successfully`);
    
    // Connect to WebSocket
    console.log(`🔌 GameManager: Connecting to WebSocket...`);
    await this.webSocketManager.connect(serverAddress, this.user);
    console.log(`✅ GameManager: WebSocket connected`);
  }

  private handleGameMessage(message: GameMessage): void {
    switch (message.type) {
      case 'player_joined':
        if (message.data.playerId && message.data.position) {
          this.updatePlayer({
            id: message.data.playerId,
            position: message.data.position,
            rotation: message.data.rotation,
            isMoving: message.data.isMoving || false,
            movementDirection: message.data.movementDirection || 'none'
          }).catch(console.error);
        }
        break;
      
      case 'player_moved':
        if (message.data.playerId && message.data.position) {
          this.updatePlayer({
            id: message.data.playerId,
            position: message.data.position,
            rotation: message.data.rotation,
            isMoving: message.data.isMoving || false,
            movementDirection: message.data.movementDirection || 'none'
          }).catch(console.error);
        }
        break;
      
      case 'player_left':
        if (message.data.playerId) {
          this.removePlayer(message.data.playerId);
        }
        break;
      
      case 'players_list':
        if (message.data.players && Array.isArray(message.data.players)) {
          message.data.players.forEach((playerData: PlayerUpdate) => {
            if (playerData.id !== this.user?.uid) {
              this.updatePlayer(playerData).catch(console.error);
            }
          });
        }
        break;
    }
  }

  private async updatePlayer(playerData: PlayerUpdate): Promise<void> {
    const existingPlayer = this.players.get(playerData.id);

    if (existingPlayer) {
      PlayerManager.updatePlayerPosition(existingPlayer, playerData);
      PlayerManager.updatePlayerAnimation(playerData.id, playerData, this.playersAnimations);
    } else {
      // Create new player
      const newPlayer: Player = {
        id: playerData.id,
        position: playerData.position,
        rotation: playerData.rotation || { x: 0, y: 0, z: 0 },
        color: PlayerManager.generatePlayerColor(playerData.id),
        isMoving: playerData.isMoving || false,
        movementDirection: playerData.movementDirection || 'none'
      };
      
      const playerResult = await PlayerManager.createPlayerModel(newPlayer);
      newPlayer.mesh = playerResult.model;
      this.sceneManager.addToScene(playerResult.model);
      
      if (playerResult.mixer && playerResult.actions) {
        this.playersAnimations.set(playerData.id, {
          mixer: playerResult.mixer,
          actions: playerResult.actions
        });
      }
      
      this.players.set(playerData.id, newPlayer);
    }
  }

  private removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    
    if (player && player.mesh) {
      this.sceneManager.removeFromScene(player.mesh);
      
      const animData = this.playersAnimations.get(playerId);
      if (animData) {
        animData.mixer.stopAllAction();
        this.playersAnimations.delete(playerId);
      }
      
      PlayerManager.disposePlayerMesh(player.mesh);
      this.players.delete(playerId);
    }
  }

  private setupVisibilityHandler(): void {
    const handleVisibilityChange = () => {
      this.webSocketManager.adjustHeartbeatForVisibility(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Store cleanup function
    (this as any).cleanupVisibility = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }

  private setupNetworkHandlers(): void {
    const handleOnline = () => {
      console.log('Network connection restored');
      if (!this.webSocketManager.isConnected) {
        console.log('Attempting reconnection after network restore...');
        // The reconnection logic will be handled by the component
      }
    };

    const handleOffline = () => {
      console.log('Network connection lost');
      this.onStateChange({
        connected: false,
        error: 'Network connection lost',
        loading: false
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Store cleanup function
    (this as any).cleanupNetwork = () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  manualReconnect(serverAddress: string): void {
    this.webSocketManager.manualReconnect(serverAddress, this.user);
  }

  get playersCount(): number {
    return this.players.size + 1; // +1 for local player
  }

  get reconnectAttempts(): number {
    return this.webSocketManager.reconnectAttemptsCount;
  }

  get maxReconnectAttempts(): number {
    return this.webSocketManager.maxReconnectAttemptsCount;
  }

  get isConnected(): boolean {
    return this.webSocketManager.isConnected;
  }

  // Debug access
  get debugInfo() {
    return {
      movement: this.movementController.debugInfo,
      players: Array.from(this.players.keys()),
      localPlayer: this.localPlayerRef.current?.position,
      animations: Array.from(this.playersAnimations.keys())
    };
  }

  cleanup(): void {
    this.webSocketManager.close();
    this.movementController.cleanup();
    this.sceneManager.cleanup();

    // Clean up animation mixers
    if (this.localPlayerMixer.current) {
      this.localPlayerMixer.current.stopAllAction();
      this.localPlayerMixer.current = null;
    }
    this.localPlayerActions.current = {};
    
    this.playersAnimations.forEach((animData) => {
      animData.mixer.stopAllAction();
    });
    this.playersAnimations.clear();

    // Clean up players
    this.players.forEach((player) => {
      if (player.mesh) {
        PlayerManager.disposePlayerMesh(player.mesh);
      }
    });
    this.players.clear();

    if (this.localPlayerRef.current) {
      PlayerManager.disposePlayerMesh(this.localPlayerRef.current);
      this.localPlayerRef.current = null;
    }

    // Clean up event listeners
    if ((this as any).cleanupVisibility) {
      (this as any).cleanupVisibility();
    }
    if ((this as any).cleanupNetwork) {
      (this as any).cleanupNetwork();
    }
  }
}
