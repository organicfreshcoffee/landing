import * as THREE from 'three';
import { GameState, GameMessage, Player, PlayerUpdate, PlayerAnimationData, CharacterData, PlayerActionData, SpellActionData } from '../types';
import { ModelLoader, AnimationTest } from '../utils';
import { PlayerManager } from './playerManager';
import { WebSocketManager } from '../network';
import { MovementController } from './movementController';
import { SceneManager, ParticleSystem } from '../rendering';
import { StairInteractionManager, StairInteractionData } from '../ui/stairInteractionManager';
import { DungeonApi } from '../network/dungeonApi';
import { StairInfo } from '../types/api';
import { CubeConfig } from '../config/cubeConfig';

export class GameManager {
  private sceneManager: SceneManager;
  private webSocketManager: WebSocketManager;
  private movementController: MovementController;
  private particleSystem!: ParticleSystem;
  
  private localPlayerRef = { current: null as THREE.Object3D | null };
  private localPlayerMixer = { current: null as THREE.AnimationMixer | null };
  private localPlayerActions = { current: {} as { [key: string]: THREE.AnimationAction } };
  
  private players = new Map<string, Player>();
  private playersAnimations = new Map<string, PlayerAnimationData>();
  
  // Store current player ID to avoid inconsistencies
  private currentPlayerId: string;
  
  // Floor verification tracking
  private lastFloorVerificationTime = 0;
  private floorVerificationInterval = 30000; // Check every 30 seconds

  constructor(
    canvas: HTMLCanvasElement,
    private onStateChange: (state: GameState) => void,
    private user: any,
    private selectedCharacter: CharacterData,
    private onFloorTransition?: (transition: {
      isLoading: boolean;
      direction: 'upstairs' | 'downstairs';
      fromFloor: string;
      toFloor: string;
    }) => void,
    private onFloorChange?: (floorName: string) => void,
    private onHealthUpdate?: (health: { health: number; maxHealth: number; isAlive: boolean }) => void,
    private onPlayerDeath?: () => void
  ) {
    this.currentPlayerId = user?.uid || 'local';
    this.sceneManager = new SceneManager(canvas);
    this.webSocketManager = new WebSocketManager(onStateChange, this.handleGameMessage.bind(this));
    this.particleSystem = new ParticleSystem(this.sceneManager.scene);
    this.movementController = new MovementController(
      this.localPlayerRef,
      { current: this.sceneManager.camera },
      this.localPlayerMixer,
      this.localPlayerActions,
      this.playersAnimations,
      () => this.webSocketManager.isConnected,
      (message) => this.webSocketManager.send(JSON.stringify(message)),
      this.selectedCharacter,
      (fromPos, toPos) => this.particleSystem.castSpell(fromPos, toPos),
      (action, data, target) => this.sendPlayerAction(action, data, target)
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
        this.movementController.updateMovement(this.currentPlayerId);
        
        // Update stair interactions with current player position
        if (this.localPlayerRef.current) {
          const stairManager = StairInteractionManager.getInstance();
          stairManager.updatePlayerPosition(this.localPlayerRef.current.position);
          
          // Make other players face the local player
          PlayerManager.updateAllOtherPlayersFacing(this.localPlayerRef.current.position);
        }
      }
      
      // Ensure particle system is initialized and update it
      if (!this.particleSystem.isInitialized()) {
        console.log('⚠️ Particle system not initialized in render loop, reinitializing...');
        this.particleSystem.reinitialize();
      }
      this.particleSystem.update();
      
      // Periodically verify floor integrity
      this.checkFloorIntegrity();
      
      // Periodically verify player state integrity
      this.checkPlayerStateIntegrity();
    });

    // Set up visibility change handler
    this.setupVisibilityHandler();

    // Set up network connectivity handlers
    this.setupNetworkHandlers();
    
    // Set up stair interaction callbacks
    this.setupStairInteractions();
  }

  private async createLocalPlayer(): Promise<void> {
    console.log('🏃 Creating local sprite player...');
    
    // Create local player object with character data
    const localPlayer: Player = {
      id: this.currentPlayerId,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      color: '#00ff00', // Green for local player
      character: this.selectedCharacter,
      isMoving: false,
      movementDirection: 'none'
    };
    
    // Create sprite-based player model
    const playerResult = await PlayerManager.createPlayerModel(localPlayer, true); // true = isLocalPlayer
    const localPlayerScene = playerResult.model;
    
    console.log('📊 Local sprite player created:', {
      character: this.selectedCharacter.name,
      type: this.selectedCharacter.type,
      style: this.selectedCharacter.style,
      sceneUUID: localPlayerScene.uuid
    });
    
    // Set up animation mixer if available
    if (playerResult.mixer) {
      this.localPlayerMixer.current = playerResult.mixer;
    }
    
    if (playerResult.actions) {
      this.localPlayerActions.current = playerResult.actions;
    }
    
    // Position the local player at spawn
    localPlayerScene.position.set(0, 0, 0);
    localPlayerScene.castShadow = true;
    
    // Mark as player object to prevent it from being cleared by scenery loading
    localPlayerScene.userData.isPlayer = true;
    localPlayerScene.userData.playerId = this.currentPlayerId;
    localPlayerScene.userData.isLocalPlayer = true;
    
    this.sceneManager.addToScene(localPlayerScene);
    this.localPlayerRef.current = localPlayerScene;
    
    console.log('✅ Local sprite player added to scene');
  }

  async connectToServer(serverAddress: string): Promise<void> {
    console.log(`🔗 GameManager: Connecting to server ${serverAddress}`);
    
    // Set server address for dungeon API calls
    this.sceneManager.setServerAddress(serverAddress);
    
    // Load initial scenery from server
    console.log(`🎮 GameManager: Loading scenery from server...`);
    await this.sceneManager.loadScenery();
    
    // Update collision data after loading scenery
    this.movementController.updateCollisionData(this.sceneManager.scene);
    
    // Check for stored player position and rotation from existing character
    const storedPosition = sessionStorage.getItem('playerPosition');
    const storedRotation = sessionStorage.getItem('playerRotation');
    
    if (storedPosition && storedRotation && this.localPlayerRef.current) {
      try {
        const position = JSON.parse(storedPosition);
        const rotation = JSON.parse(storedRotation);
        
        console.log('🔄 Restoring player position from server:', position);
        console.log('🔄 Restoring player rotation from server:', rotation);
        
        // Set position
        this.localPlayerRef.current.position.set(position.x, position.y, position.z);
        
        // Set rotation (convert degrees to radians)
        this.localPlayerRef.current.rotation.set(
          rotation.x * Math.PI / 180,
          rotation.y * Math.PI / 180,
          rotation.z * Math.PI / 180
        );
        
        // Clear stored data after using it
        sessionStorage.removeItem('playerPosition');
        sessionStorage.removeItem('playerRotation');
        
        console.log('✅ Player positioned at stored location');
      } catch (error) {
        console.error('❌ Error parsing stored position/rotation, falling back to ground positioning:', error);
        this.positionPlayerOnGround();
      }
    } else {
      // Position player on ground level if no stored position
      this.positionPlayerOnGround();
    }
    
    // Notify about initial floor
    const initialFloor = this.sceneManager.getCurrentFloor();
    if (this.onFloorChange && initialFloor) {
      this.onFloorChange(initialFloor);
    }
    
    // Create test runner for animation debugging
    await AnimationTest.createTestRunner(this.sceneManager.scene);
    
    console.log(`🎯 GameManager: Collision data initialized`);
    
    console.log(`✅ GameManager: Scenery loaded successfully`);
    
    // Connect to WebSocket
    console.log(`🔌 GameManager: Connecting to WebSocket...`);
    await this.webSocketManager.connect(serverAddress, this.user, this.selectedCharacter);
    console.log(`✅ GameManager: WebSocket connected`);
  }

  private handleGameMessage(message: GameMessage): void {
    console.log('📥 RECEIVED MESSAGE:', message.type, message.data);
    
    switch (message.type) {
      case 'player_joined':
        // Handle new player joining with full player data
        if (message.data.id && message.data.position && message.data.character) {
          console.log('👥 Player joined:', message.data.character.name, 'at position:', message.data.position);
          
          this.updatePlayer({
            id: message.data.id,
            position: message.data.position,
            rotation: message.data.rotation || { x: 0, y: 0, z: 0 },
            isMoving: false, // New players start stationary
            movementDirection: 'none',
            character: message.data.character
          }).catch(console.error);
        } else {
          console.warn('⚠️ Invalid player_joined message data:', message.data);
        }
        break;

      case 'player_moved':
        // Handle both new players joining and existing players moving
        // Character data is included in all movement messages
        if (message.data.playerId && message.data.position) {
          // Only log character data for new players
          const isNewPlayer = !this.players.has(message.data.playerId);
          if (isNewPlayer && message.data.character) {
            console.log('👥 New player joined via player_moved:', message.data.character.name);
          }
          
          console.log('📨 Received player_moved for:', message.data.playerId, {
            isNewPlayer,
            hasCharacter: !!message.data.character,
            characterName: message.data.character?.name,
            position: message.data.position,
            currentPlayerCount: this.players.size
          });
          
          this.updatePlayer({
            id: message.data.playerId,
            position: message.data.position,
            rotation: message.data.rotation,
            isMoving: message.data.isMoving || false,
            movementDirection: message.data.movementDirection || 'none',
            character: message.data.character
          }).catch(console.error);
        } else {
          console.warn('⚠️ Invalid player_moved message - missing playerId or position:', {
            hasPlayerId: !!message.data.playerId,
            hasPosition: !!message.data.position,
            data: message.data
          });
        }
        break;
      
      case 'player_left':
        if (message.data.playerId) {
          this.removePlayer(message.data.playerId);
        }
        break;
      
      case 'player_left_floor':
        if (message.data.playerId) {
          this.removePlayer(message.data.playerId);
        }
        break;

      case 'player_action':
        if (message.data.playerId && message.data.action) {
          console.log('⚡ Received player action:', message.data.action, 'from player:', message.data.playerId, 'raw data:', message.data);
          this.handlePlayerAction(message.data);
        } else {
          console.warn('⚠️ Invalid player_action message data:', message.data);
        }
        break;

      case 'players_list':
        if (message.data.players && Array.isArray(message.data.players)) {
          console.log(`📋 Received players list with ${message.data.players.length} players`);
          
          message.data.players.forEach((playerData: PlayerUpdate) => {
            // Skip local player
            if (playerData.id !== this.user?.uid) {
              console.log('📝 Processing player from list:', playerData.id, 'character:', playerData.character?.name || 'unknown');
              this.updatePlayer(playerData).catch((error) => {
                console.error('❌ Error updating player from list:', playerData.id, error);
              });
            }
          });
        } else {
          console.warn('⚠️ Invalid players_list message data:', message.data);
        }
        break;

      case 'health_update':
        if (message.data.health !== undefined && message.data.maxHealth !== undefined) {
          console.log('❤️ Received health update:', message.data);
          this.handleHealthUpdate(message.data);
        } else {
          console.warn('⚠️ Invalid health_update message data:', message.data);
        }
        break;

      case 'respawn_success':
        if (message.data.player) {
          console.log('🔄 Received respawn success:', message.data);
          this.handleRespawnSuccess(message.data.player);
        } else {
          console.warn('⚠️ Invalid respawn_success message data:', message.data);
        }
        break;
    }
  }

  private async updatePlayer(playerData: PlayerUpdate): Promise<void> {
    // Skip if this is the local player
    if (playerData.id === this.currentPlayerId) {
      console.log('⏭️ Skipping update for local player:', playerData.id, '(local ID:', this.currentPlayerId, ')');
      return;
    }

    console.log('🔍 Processing player update for:', playerData.id, '(local ID:', this.currentPlayerId, ')');

    const existingPlayer = this.players.get(playerData.id);

    if (existingPlayer) {
      // Update existing player
      console.log('🔄 Updating existing player:', playerData.id, 'at position:', playerData.position);
      
      // Check if character has changed and needs sprite recreation
      let needsSpriteRecreation = false;
      if (playerData.character && existingPlayer.character) {
        needsSpriteRecreation = (
          playerData.character.type !== existingPlayer.character.type ||
          playerData.character.style !== existingPlayer.character.style
        );
        
        if (needsSpriteRecreation) {
          console.log('🎭 Character changed for player:', playerData.id, {
            from: `${existingPlayer.character.type}${existingPlayer.character.style}`,
            to: `${playerData.character.type}${playerData.character.style}`
          });
        }
      }
      
      // If character changed, recreate the sprite
      if (needsSpriteRecreation && playerData.character) {
        try {
          // Remove old mesh from scene
          if (existingPlayer.mesh) {
            this.sceneManager.removeFromScene(existingPlayer.mesh);
            PlayerManager.disposePlayerMesh(existingPlayer.mesh);
          }
          
          // Update character data
          existingPlayer.character = playerData.character;
          
          // Create new sprite mesh
          const playerResult = PlayerManager.createSpritePlayerModel(existingPlayer, false);
          if (!playerResult || !playerResult.model) {
            console.error('❌ Failed to recreate sprite for:', playerData.id);
            return;
          }
          
          // Update player mesh
          existingPlayer.mesh = playerResult.model;
          
          // Position at current location
          existingPlayer.mesh.position.set(
            playerData.position.x,
            playerData.position.y,
            playerData.position.z
          );
          
          // Mark as other player
          playerResult.model.userData.isOtherPlayer = true;
          
          // Add to scene
          this.sceneManager.addToScene(playerResult.model);
          
          console.log('✅ Successfully recreated sprite for character change:', playerData.id);
          
        } catch (error) {
          console.error('❌ Error recreating sprite:', playerData.id, error);
        }
      } else {
        // Normal update - just update character data if provided
        if (playerData.character) {
          existingPlayer.character = playerData.character;
        }
      }
      
      try {
        PlayerManager.updatePlayerPosition(existingPlayer, playerData);
        PlayerManager.updatePlayerAnimation(playerData.id, playerData, this.playersAnimations);
        
        // Update sprite direction based on rotation and local player position
        if (this.localPlayerRef.current && existingPlayer.mesh && existingPlayer.mesh.userData.spriteMesh) {
          PlayerManager.updateSpriteDirection(
            playerData.id,
            new THREE.Vector3(playerData.position.x, playerData.position.y, playerData.position.z),
            playerData.rotation || { x: 0, y: 0, z: 0 },
            this.localPlayerRef.current.position
          );
        }
      } catch (error) {
        console.error('❌ Error updating existing player:', playerData.id, error);
      }
    } else {
      // Create new player
      console.log('✨ Creating new player:', playerData.id, 'with character:', playerData.character?.name || 'unknown');
      
      if (!playerData.character) {
        console.warn('⚠️ Cannot create player without character data:', playerData.id);
        return;
      }

      try {
        const newPlayer: Player = {
          id: playerData.id,
          position: playerData.position,
          rotation: playerData.rotation || { x: 0, y: 0, z: 0 },
          color: PlayerManager.generatePlayerColor(playerData.id),
          isMoving: playerData.isMoving || false,
          movementDirection: playerData.movementDirection || 'none',
          character: playerData.character
        };
        
        const playerResult = PlayerManager.createSpritePlayerModel(newPlayer, false); // false = not local player
        if (!playerResult || !playerResult.model) {
          console.error('❌ Failed to create sprite player model for:', playerData.id);
          return;
        }

        newPlayer.mesh = playerResult.model;
        
        // Mark as other player for scene preservation during floor changes
        playerResult.model.userData.isOtherPlayer = true;
        
        this.sceneManager.addToScene(playerResult.model);
        
        console.log('✅ Successfully created and added new sprite player:', playerData.id, {
          meshId: playerResult.model.uuid,
          position: playerResult.model.position,
          visible: playerResult.model.visible
        });
        
        this.players.set(playerData.id, newPlayer);
        console.log('✅ Successfully created and added new player:', playerData.id);
        
        // Set initial sprite direction based on rotation and local player position
        if (this.localPlayerRef.current) {
          PlayerManager.updateSpriteDirection(
            playerData.id,
            new THREE.Vector3(playerData.position.x, playerData.position.y, playerData.position.z),
            playerData.rotation || { x: 0, y: 0, z: 0 },
            this.localPlayerRef.current.position
          );
        }
        
      } catch (error) {
        console.error('❌ Error creating new player:', playerData.id, error);
        // Clean up any partial state
        this.players.delete(playerData.id);
        this.playersAnimations.delete(playerData.id);
      }
    }
  }

  private sendPlayerAction(action: string, data?: any, target?: string): void {
    if (!this.webSocketManager.isConnected) {
      console.warn('⚠️ Cannot send player action - not connected to server');
      return;
    }

    const actionMessage = {
      type: 'player_action',
      data: {
        playerId: this.currentPlayerId,
        action: action,
        target: target,
        data: data
      }
    };

    console.log('📤 Sending player action:', actionMessage);
    this.webSocketManager.send(JSON.stringify(actionMessage));
  }

  private handlePlayerAction(actionData: any): void {
    console.log('🎭 Raw actionData received:', actionData);
    
    // Handle potential nested structure from server
    let playerId, action, data;
    
    if (actionData.action && typeof actionData.action === 'object') {
      // Server wrapped our action data in another layer
      console.log('🔄 Detected wrapped message structure');
      playerId = actionData.action.playerId;
      action = actionData.action.action;
      data = actionData.action.data;
    } else {
      // Direct structure as expected
      playerId = actionData.playerId;
      action = actionData.action;
      data = actionData.data;
    }
    
    console.log('🎬 Parsed action data:', { playerId, action, data });
    
    // Skip if this is the local player (we don't need to visualize our own actions)
    if (playerId === this.currentPlayerId) {
      console.log('⏭️ Skipping action from local player:', playerId);
      return;
    }

    console.log('🎬 Handling player action:', action, 'from player:', playerId, 'with data:', data);

    switch (action) {
      case 'spell_cast':
        this.handleSpellCastAction(playerId, data);
        break;
      default:
        console.log('❓ Unknown player action:', action);
        break;
    }
  }

  private handleSpellCastAction(playerId: string, spellData: any): void {
    console.log('🎪 handleSpellCastAction called with:', {
      playerId,
      spellData,
      hasFromPosition: !!spellData?.fromPosition,
      hasToPosition: !!spellData?.toPosition,
      currentPlayerId: this.currentPlayerId,
      isLocalPlayer: playerId === this.currentPlayerId
    });

    if (!spellData || !spellData.fromPosition || !spellData.toPosition) {
      console.warn('⚠️ Invalid spell cast data:', spellData);
      return;
    }

    console.log('✨ Rendering spell cast from player:', playerId, spellData);

    // Convert positions from the message data to THREE.Vector3
    const fromPosition = new THREE.Vector3(
      spellData.fromPosition.x,
      spellData.fromPosition.y,
      spellData.fromPosition.z
    );
    
    const toPosition = new THREE.Vector3(
      spellData.toPosition.x,
      spellData.toPosition.y,
      spellData.toPosition.z
    );

    console.log('🚀 About to call particleSystem.castSpellFromNetwork with:', {
      fromPosition: fromPosition.toArray(),
      toPosition: toPosition.toArray()
    });

    // Render the spell effect using our particle system
    this.particleSystem.castSpellFromNetwork(fromPosition, toPosition);
  }

  private handleHealthUpdate(healthData: any): void {
    console.log('❤️ Processing health update:', healthData);
    
    if (this.onHealthUpdate) {
      this.onHealthUpdate({
        health: healthData.health,
        maxHealth: healthData.maxHealth,
        isAlive: healthData.isAlive
      });
    }

    // If player died, handle death
    if (!healthData.isAlive || healthData.health <= 0) {
      console.log('💀 Player died, initiating death sequence');
      this.handlePlayerDeath();
    }
  }

  private async handlePlayerDeath(): Promise<void> {
    console.log('💀 Handling player death');
    
    try {
      // Notify the UI about death
      if (this.onPlayerDeath) {
        this.onPlayerDeath();
      }

      // Move player back to floor A (spawn area)
      if (this.localPlayerRef.current) {
        this.localPlayerRef.current.position.set(0, 0, 0);
        this.positionPlayerOnGround();
      }

      // Notify server about floor change to A
      const serverAddress = this.sceneManager.getServerAddress();
      if (serverAddress) {
        await DungeonApi.notifyPlayerMovedFloor(serverAddress, 'A');
        console.log('✅ Notified server of respawn floor change to A');
        
        // Load floor A
        await this.loadFloor('A');
        console.log('✅ Loaded respawn floor A');
      }
    } catch (error) {
      console.error('❌ Error handling player death:', error);
    }
  }

  private handleRespawnSuccess(playerData: any): void {
    console.log('🔄 Processing respawn success:', playerData);
    
    // Update health from respawn data
    if (this.onHealthUpdate) {
      this.onHealthUpdate({
        health: playerData.health || 100,
        maxHealth: playerData.maxHealth || 100,
        isAlive: playerData.isAlive !== false
      });
    }

    // Update character data if provided
    if (playerData.character) {
      this.selectedCharacter = playerData.character;
      console.log('🎭 Updated character after respawn:', this.selectedCharacter);
    }
  }

  sendRespawnRequest(characterData: CharacterData): void {
    if (!this.webSocketManager.isConnected) {
      console.warn('⚠️ Cannot send respawn request - not connected to server');
      return;
    }

    const respawnMessage = {
      type: 'player_respawn',
      data: {
        characterData: {
          name: characterData.name,
          style: characterData.style,
          type: characterData.type
        }
      }
    };

    console.log('🔄 Sending respawn request:', respawnMessage);
    this.webSocketManager.send(JSON.stringify(respawnMessage));
  }

  private removePlayer(playerId: string): void {
    console.log('🗑️ Removing player:', playerId);
    
    const player = this.players.get(playerId);
    
    if (player && player.mesh) {
      try {
        this.sceneManager.removeFromScene(player.mesh);
        
        const animData = this.playersAnimations.get(playerId);
        if (animData) {
          animData.mixer.stopAllAction();
          this.playersAnimations.delete(playerId);
        }
        
        PlayerManager.disposePlayerMesh(player.mesh);
        this.players.delete(playerId);
        
        console.log('✅ Successfully removed player:', playerId);
      } catch (error) {
        console.error('❌ Error removing player:', playerId, error);
        // Force cleanup even if error occurs
        this.players.delete(playerId);
        this.playersAnimations.delete(playerId);
      }
    } else {
      // Clean up any orphaned data
      this.players.delete(playerId);
      this.playersAnimations.delete(playerId);
      console.log('🧹 Cleaned up orphaned player data for:', playerId);
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

  private setupStairInteractions(): void {
    const stairManager = StairInteractionManager.getInstance();
    
    // Set up callbacks for stair interactions
    stairManager.setCallbacks(
      // Upstairs callback
      (stairData: StairInteractionData) => {
        console.log('🔺 Player wants to go upstairs!');
        this.handleUpstairsInteraction(stairData);
      },
      // Downstairs callback
      (stairData: StairInteractionData) => {
        console.log('🔻 Player wants to go downstairs!');
        this.handleDownstairsInteraction(stairData);
      }
    );
    
    console.log('🏗️ Stair interaction callbacks configured');
  }

  private async handleUpstairsInteraction(stairData: StairInteractionData): Promise<void> {
      console.log(`⬆️ Handling upstairs interaction for room: ${stairData.roomName}`);
      console.log(`⬆️ [DEBUG] About to call getRoomStairs API for room: "${stairData.roomName}"`);
      
      try {
        // Get the target floor information from the stairs API
        const serverAddress = this.sceneManager.getServerAddress();
        if (!serverAddress) {
          console.error('❌ Server address not available for stair transition');
          return;
        }
        
        const stairsResponse = await DungeonApi.getRoomStairs(serverAddress, stairData.roomName);
        
        if (!stairsResponse.success || !stairsResponse.data.upwardStair) {
          console.error('❌ No upward stair found for room:', stairData.roomName);
          return;
        }      const targetFloor = stairsResponse.data.upwardStair.dungeonDagNodeName;
      const currentFloor = this.sceneManager.getCurrentFloor(); // The floor we're coming from
      if (!currentFloor) {
        console.error('❌ Current floor not available for stair transition');
        return;
      }
      console.log(`🔺 Going upstairs from ${currentFloor} to floor: ${targetFloor}`);
      console.log(`🔺 [DEBUG] Stair is in room: ${stairData.roomName} on floor: ${currentFloor}`);
      
      // Show loading screen
      if (this.onFloorTransition) {
        this.onFloorTransition({
          isLoading: true,
          direction: 'upstairs',
          fromFloor: currentFloor,
          toFloor: targetFloor
        });
      }
      
      // Hide stair interaction popup during transition
      const stairManager = StairInteractionManager.getInstance();
      stairManager.forceHidePopup();
      
      // Notify server about floor change before loading
      try {
        await DungeonApi.notifyPlayerMovedFloor(serverAddress, targetFloor);
        console.log(`✅ Successfully notified server of floor change: ${currentFloor} → ${targetFloor}`);
      } catch (error) {
        console.warn(`⚠️ Failed to notify server of floor change: ${error}`);
        // Continue with floor transition even if notification fails
      }
      
      // Load the new floor (includes collision data update)
      await this.loadFloor(targetFloor);
      
      // Find the downward stair on the target floor that leads back to our current floor
      await this.findAndPositionAtReturnStair(serverAddress, targetFloor, currentFloor, 'downward');
      
      // Hide loading screen
      if (this.onFloorTransition) {
        this.onFloorTransition({
          isLoading: false,
          direction: 'upstairs',
          fromFloor: currentFloor,
          toFloor: targetFloor
        });
      }
      
    } catch (error) {
      console.error('❌ Error during upstairs transition:', error);
      
      // Hide loading screen on error
      if (this.onFloorTransition) {
        this.onFloorTransition({
          isLoading: false,
          direction: 'upstairs',
          fromFloor: '',
          toFloor: ''
        });
      }
    }
  }

  private async handleDownstairsInteraction(stairData: StairInteractionData): Promise<void> {
      console.log(`⬇️ Handling downstairs interaction for room: ${stairData.roomName}`);
      console.log(`⬇️ [DEBUG] About to call getRoomStairs API for room: "${stairData.roomName}"`);
      
      try {
        // Get the target floor information from the stairs API
        const serverAddress = this.sceneManager.getServerAddress();
        if (!serverAddress) {
          console.error('❌ Server address not available for stair transition');
          return;
        }
        
        const stairsResponse = await DungeonApi.getRoomStairs(serverAddress, stairData.roomName);
        
        if (!stairsResponse.success || !stairsResponse.data.downwardStair) {
          console.error('❌ No downward stair found for room:', stairData.roomName);
          return;
        }      const targetFloor = stairsResponse.data.downwardStair.dungeonDagNodeName;
      const currentFloor = this.sceneManager.getCurrentFloor(); // The floor we're coming from
      if (!currentFloor) {
        console.error('❌ Current floor not available for stair transition');
        return;
      }
      console.log(`🔻 Going downstairs from ${currentFloor} to floor: ${targetFloor}`);
      console.log(`🔻 [DEBUG] Stair is in room: ${stairData.roomName} on floor: ${currentFloor}`);
      
      // Show loading screen
      if (this.onFloorTransition) {
        this.onFloorTransition({
          isLoading: true,
          direction: 'downstairs',
          fromFloor: currentFloor,
          toFloor: targetFloor
        });
      }
      
      // Hide stair interaction popup during transition
      const stairManager = StairInteractionManager.getInstance();
      stairManager.forceHidePopup();
      
      // Notify server about floor change before loading
      try {
        await DungeonApi.notifyPlayerMovedFloor(serverAddress, targetFloor);
        console.log(`✅ Successfully notified server of floor change: ${currentFloor} → ${targetFloor}`);
      } catch (error) {
        console.warn(`⚠️ Failed to notify server of floor change: ${error}`);
        // Continue with floor transition even if notification fails
      }
      
      // Load the new floor (includes collision data update)
      await this.loadFloor(targetFloor);
      
      // Find the upward stair on the target floor that leads back to our current floor
      await this.findAndPositionAtReturnStair(serverAddress, targetFloor, currentFloor, 'upward');
      
      // Hide loading screen
      if (this.onFloorTransition) {
        this.onFloorTransition({
          isLoading: false,
          direction: 'downstairs',
          fromFloor: currentFloor,
          toFloor: targetFloor
        });
      }
      
    } catch (error) {
      console.error('❌ Error during downstairs transition:', error);
      
      // Hide loading screen on error
      if (this.onFloorTransition) {
        this.onFloorTransition({
          isLoading: false,
          direction: 'downstairs',
          fromFloor: '',
          toFloor: ''
        });
      }
    }
  }

  private positionPlayerOnGround(): void {
    if (!this.localPlayerRef.current) return;
    
    const currentPosition = this.localPlayerRef.current.position;
    const collisionSystem = this.movementController.getCollisionSystem();
    const floorHeight = collisionSystem.getVisualFloorHeight(currentPosition);
    
    console.log('🏠 Positioning player on ground:', {
      currentY: currentPosition.y.toFixed(2),
      floorHeight: floorHeight.toFixed(2),
      currentPos: `(${currentPosition.x.toFixed(1)}, ${currentPosition.y.toFixed(1)}, ${currentPosition.z.toFixed(1)})`
    });
    
    // Position player on the floor
    this.localPlayerRef.current.position.y = floorHeight;
    console.log(`👤 Player positioned on ground at height: ${floorHeight}`);
  }

  private resetPlayerToSpawn(): void {
    if (!this.localPlayerRef.current) return;
    
    console.log('🔄 Resetting player to spawn location');
    
    // Reset to origin position (spawn point)
    this.localPlayerRef.current.position.set(0, 0, 0);
    
    // Position player on ground level for the new floor
    this.positionPlayerOnGround();
    
    console.log('✅ Player reset to spawn position');
  }

  private positionPlayerAtStair(stairInfo: StairInfo, stairType: 'upward' | 'downward'): void {
    if (!this.localPlayerRef.current) return;
    
    console.log(`🎯 Positioning player at ${stairType} stair location: (${stairInfo.locationX}, ${stairInfo.locationY})`);
    
    // Convert grid coordinates to world coordinates (same logic as in StairInteractionManager)
    const cubeSize = CubeConfig.getCubeSize();
    const worldX = stairInfo.locationX * cubeSize + cubeSize / 2;
    const worldZ = stairInfo.locationY * cubeSize + cubeSize / 2;
    
    // Set player position at the stair location
    this.localPlayerRef.current.position.set(worldX, 0, worldZ);
    
    // Position player on ground level for the new floor
    this.positionPlayerOnGround();
    
    console.log(`✅ Player positioned at stair: (${worldX.toFixed(1)}, ${this.localPlayerRef.current.position.y.toFixed(1)}, ${worldZ.toFixed(1)})`);
  }

  private findStairWorldCoordinates(roomName: string, stairType: 'upward' | 'downward'): { x: number, y: number, z: number } | null {
    // Search through all objects in the scene to find stairs for the specified room
    const scene = this.sceneManager.scene;
    let foundStairData: any = null;
    
    console.log(`🔍 [DEBUG] Looking for ${stairType} stair in room: ${roomName}`);
    
    // Debug: Log all stairs found in scene
    const allStairs: any[] = [];
    scene.traverse((object) => {
      if (object.userData.type === 'stairs') {
        allStairs.push({
          type: object.userData.type,
          direction: object.userData.direction,
          roomName: object.userData.roomName,
          hasUpwardStair: object.userData.hasUpwardStair,
          hasDownwardStair: object.userData.hasDownwardStair,
          worldCoords: `(${object.userData.worldX}, ${object.userData.worldY}, ${object.userData.worldZ})`
        });
        
        if (object.userData.roomName === roomName) {
          const hasTargetStairType = stairType === 'upward' ? object.userData.hasUpwardStair : object.userData.hasDownwardStair;
          if (hasTargetStairType) {
            foundStairData = object.userData;
          }
        }
      }
    });
    
    console.log(`🔍 [DEBUG] All stairs in scene:`, allStairs);
    console.log(`🔍 [DEBUG] Total stairs found: ${allStairs.length}`);
    
    if (foundStairData && typeof foundStairData.worldX === 'number') {
      console.log(`🎯 Found ${stairType} stair for room ${roomName} at world coordinates: (${foundStairData.worldX}, ${foundStairData.worldY}, ${foundStairData.worldZ})`);
      return {
        x: foundStairData.worldX,
        y: foundStairData.worldY,
        z: foundStairData.worldZ
      };
    }
    
    console.warn(`⚠️ Could not find ${stairType} stair world coordinates for room ${roomName}`);
    return null;
  }

  private async findAndPositionAtReturnStair(
    serverAddress: string, 
    targetFloor: string, 
    originalFloor: string, 
    stairType: 'upward' | 'downward'
  ): Promise<void> {
    try {
      const logPrefix = stairType === 'downward' ? '[upstairs]' : '[downstairs]';
      
      console.log(`${logPrefix} 🔍 Searching for ${stairType} stair on ${targetFloor} that leads back to ${originalFloor}`);
      console.log(`${logPrefix} Floor transition: ${originalFloor} → ${targetFloor}`);
      console.log(`${logPrefix} 🔍 [DEBUG] Stair transition summary:`);
      console.log(`${logPrefix} 🔍 [DEBUG]   - Current floor (where we're going TO): "${targetFloor}"`);
      console.log(`${logPrefix} 🔍 [DEBUG]   - Original floor (where we came FROM): "${originalFloor}"`);
      console.log(`${logPrefix} 🔍 [DEBUG]   - Looking for: ${stairType} stairs that lead back to "${originalFloor}"`);
      console.log(`${logPrefix} 🔍 [DEBUG]   - Floor prefix to match: "${originalFloor.split('_')[0]}"`);
      
      // Get the floor layout to find all rooms
      const floorLayout = await DungeonApi.getFloorLayout(serverAddress, targetFloor);
      
      if (!floorLayout.success) {
        console.error(`${logPrefix} ❌ Failed to get floor layout for:`, targetFloor);
        this.resetPlayerToSpawn();
        return;
      }
      
      // Find all rooms on the target floor
      const allRooms = floorLayout.data.nodes.filter(node => node.isRoom);
      console.log(`${logPrefix} 🏠 Found ${allRooms.length} total rooms on floor ${targetFloor}:`, allRooms.map(r => r.name));
      
      // Filter to only rooms that have the specific type of stair we're looking for
      const roomsWithRelevantStairs = allRooms.filter(room => {
        if (stairType === 'downward') {
          return room.hasDownwardStair;
        } else {
          return room.hasUpwardStair;
        }
      });
      console.log(`${logPrefix} 🏗️ Found ${roomsWithRelevantStairs.length} rooms with ${stairType} stairs:`, roomsWithRelevantStairs.map(r => r.name));
      
      const stairMappings: { roomName: string, upward?: string, downward?: string }[] = [];
      let matchingStair: StairInfo | undefined;
      let matchingRoomName: string | undefined;
      
      // Check each room with the relevant stair type for stairs that lead back to our original floor
      for (const room of roomsWithRelevantStairs) {
        try {
          console.log(`${logPrefix} 🔍 Checking room ${room.name} for stairs...`);
          const stairsResponse = await DungeonApi.getRoomStairs(serverAddress, room.name);
          
          if (!stairsResponse.success) {
            console.log(`${logPrefix} ⚠️ No stairs data for room ${room.name}`);
            continue;
          }
          
          const stairMapping: { roomName: string, upward?: string, downward?: string } = { roomName: room.name };
          
          if (stairsResponse.data.upwardStair) {
            stairMapping.upward = stairsResponse.data.upwardStair.dungeonDagNodeName;
          }
          if (stairsResponse.data.downwardStair) {
            stairMapping.downward = stairsResponse.data.downwardStair.dungeonDagNodeName;
          }
          
          stairMappings.push(stairMapping);
          
          // Extract floor prefix from original floor (e.g., "AA_A" -> "AA")
          const originalFloorPrefix = originalFloor.split('_')[0];
          
          console.log(`${logPrefix} 🔍 [DEBUG] Original floor: "${originalFloor}", extracted prefix: "${originalFloorPrefix}"`);
          
          if (stairType === 'downward' && stairsResponse.data.downwardStair) {
            const stairDestination = stairsResponse.data.downwardStair.dungeonDagNodeName;
            console.log(`${logPrefix} 🔍 Room ${room.name} downward stair goes to: "${stairDestination}", comparing with prefix: "${originalFloorPrefix}"`);
            
            // Check both exact match and prefix match
            if (stairDestination === originalFloorPrefix || stairDestination === originalFloor) {
              console.log(`${logPrefix} ✅ [MATCH] Found matching downward stair in room ${room.name}`);
              matchingStair = stairsResponse.data.downwardStair;
              matchingRoomName = room.name;
            } else {
              console.log(`${logPrefix} ❌ [NO MATCH] "${stairDestination}" does not match "${originalFloorPrefix}" or "${originalFloor}"`);
            }
          } else if (stairType === 'upward' && stairsResponse.data.upwardStair) {
            const stairDestination = stairsResponse.data.upwardStair.dungeonDagNodeName;
            console.log(`${logPrefix} 🔍 Room ${room.name} upward stair goes to: "${stairDestination}", comparing with prefix: "${originalFloorPrefix}"`);
            
            // Check both exact match and prefix match
            if (stairDestination === originalFloorPrefix || stairDestination === originalFloor) {
              console.log(`${logPrefix} ✅ [MATCH] Found matching upward stair in room ${room.name}`);
              matchingStair = stairsResponse.data.upwardStair;
              matchingRoomName = room.name;
            } else {
              console.log(`${logPrefix} ❌ [NO MATCH] "${stairDestination}" does not match "${originalFloorPrefix}" or "${originalFloor}"`);
            }
          }
          
        } catch (error) {
          console.warn(`${logPrefix} ⚠️ Error checking stairs for room ${room.name}:`, error);
        }
      }
      
      // Log all stair mappings found
      console.log(`${logPrefix} 📋 Stair mappings on floor ${targetFloor}:`, stairMappings);
      
      if (matchingStair && matchingRoomName) {
        console.log(`${logPrefix} ✅ Found matching ${stairType} stair in room ${matchingRoomName} that leads to ${originalFloor}`);
        console.log(`${logPrefix} 📍 Stair location: (${matchingStair.locationX}, ${matchingStair.locationY})`);
        
        // Log player position before moving
        if (this.localPlayerRef.current) {
          const beforePos = this.localPlayerRef.current.position;
          console.log(`${logPrefix} 👤 Player position before move: (${beforePos.x.toFixed(1)}, ${beforePos.y.toFixed(1)}, ${beforePos.z.toFixed(1)})`);
        }
        
        // Get world coordinates from the rendered stair model
        const stairWorldCoords = this.findStairWorldCoordinates(matchingRoomName, stairType);
        
        if (stairWorldCoords && this.localPlayerRef.current) {
          console.log(`${logPrefix} 🎯 Using stored world coordinates: (${stairWorldCoords.x.toFixed(1)}, ${stairWorldCoords.y.toFixed(1)}, ${stairWorldCoords.z.toFixed(1)})`);
          console.log(`${logPrefix} 📍 [DEBUG] Teleporting player to ${stairType} stair in room "${matchingRoomName}" that leads back to "${originalFloor}"`);
          
          // Position player at the stair's world coordinates
          this.localPlayerRef.current.position.set(stairWorldCoords.x, stairWorldCoords.y, stairWorldCoords.z);
          
          // Position player on ground level for the new floor
          this.positionPlayerOnGround();
        } else {
          console.warn(`${logPrefix} ⚠️ Could not get world coordinates, falling back to calculated position`);
          this.positionPlayerAtStair(matchingStair, stairType);
        }
        
        // Log player position after moving
        if (this.localPlayerRef.current) {
          const afterPos = this.localPlayerRef.current.position;
          console.log(`${logPrefix} 👤 Player position after move: (${afterPos.x.toFixed(1)}, ${afterPos.y.toFixed(1)}, ${afterPos.z.toFixed(1)})`);
        }
        
        return;
      } else {
        console.log(`${logPrefix} ❌ No matching ${stairType} stair found that leads back to ${originalFloor}`);
      }
      
      // If no matching stair found, fall back to spawn
      console.warn(`${logPrefix} ⚠️ No ${stairType} stair found on ${targetFloor} that leads back to ${originalFloor}, using spawn`);
      this.resetPlayerToSpawn();
      
    } catch (error) {
      const logPrefix = stairType === 'downward' ? '[upstairs]' : '[downstairs]';
      console.error(`${logPrefix} ❌ Error finding return stair:`, error);
      this.resetPlayerToSpawn();
    }
  }

  /**
   * Periodically check floor integrity and refresh if needed
   */
  private checkFloorIntegrity(): void {
    const now = Date.now();
    if (now - this.lastFloorVerificationTime > this.floorVerificationInterval) {
      this.lastFloorVerificationTime = now;
      
      // Only verify if we have a current floor loaded
      if (this.sceneManager.getCurrentFloor()) {
        this.sceneManager.verifyAndRefreshFloor().catch((error) => {
          console.error('Error during floor verification:', error);
        });
      }
    }
  }

  /**
   * Periodically check player state integrity and fix any issues
   */
  private checkPlayerStateIntegrity(): void {
    // Only check every 10 seconds to avoid performance impact
    if (Math.random() > 0.99) { // Roughly every 10 seconds at 60fps
      let issuesFound = 0;
      
      // Check for duplicate local players in scene
      let localPlayerCount = 0;
      this.sceneManager.scene.traverse((object) => {
        if (object.userData.isLocalPlayer) {
          localPlayerCount++;
        }
      });
      
      if (localPlayerCount > 1) {
        console.error(`🚨 DUPLICATE LOCAL PLAYERS DETECTED: ${localPlayerCount} local players found in scene!`);
        issuesFound++;
      }
      
      // Check for players with same ID as local player in players map
      if (this.players.has(this.currentPlayerId)) {
        console.error(`🚨 LOCAL PLAYER ID IN REMOTE PLAYERS MAP: ${this.currentPlayerId}`);
        this.players.delete(this.currentPlayerId);
        issuesFound++;
      }
      
      this.players.forEach((player, id) => {
        // Check if player has mesh but mesh is not in scene
        if (player.mesh && !this.sceneManager.scene.getObjectByProperty('uuid', player.mesh.uuid)) {
          console.warn(`⚠️ Player ${id} has mesh but mesh not in scene - re-adding`);
          this.sceneManager.addToScene(player.mesh);
          issuesFound++;
        }
        
        // Check if player has animation tracking but no mesh
        if (this.playersAnimations.has(id) && !player.mesh) {
          console.warn(`⚠️ Player ${id} has animation but no mesh - cleaning up animation`);
          const animData = this.playersAnimations.get(id);
          if (animData) {
            animData.mixer.stopAllAction();
          }
          this.playersAnimations.delete(id);
          issuesFound++;
        }
        
        // Check if player mesh exists but no animation tracking for sprite players
        if (player.mesh && player.character && !this.playersAnimations.has(id)) {
          console.warn(`⚠️ Player ${id} has sprite character but no animation tracking`);
          issuesFound++;
        }
      });
      
      if (issuesFound > 0) {
        console.log(`🔧 Fixed ${issuesFound} player state integrity issues`);
      }
    }
  }

  async loadFloor(floorName?: string): Promise<void> {
    try {
      await this.sceneManager.loadScenery(floorName);
      // Update collision data after loading new scenery
      this.movementController.updateCollisionData(this.sceneManager.scene);
      // Position player on ground
      this.positionPlayerOnGround();
      
      // Reinitialize particle system after floor change
      if (!this.particleSystem.isInitialized()) {
        console.log('🎆 Reinitializing particle system after floor change...');
        this.particleSystem.reinitialize();
      }
      
      // Notify about floor change
      const currentFloor = this.sceneManager.getCurrentFloor();
      if (this.onFloorChange && currentFloor) {
        this.onFloorChange(currentFloor);
      }
      
      console.log('🎯 Collision data updated after floor load');
    } catch (error) {
      console.error('Error loading floor:', error);
      throw error;
    }
  }

  updateServerAddress(address: string): void {
    this.sceneManager.setServerAddress(address);
  }

  manualReconnect(serverAddress: string): void {
    this.webSocketManager.manualReconnect(serverAddress, this.user, this.selectedCharacter);
  }

  /**
   * Update the selected character data and propagate to all relevant components
   */
  updateSelectedCharacter(character: CharacterData): void {
    console.log('🔄 GameManager: Updating character from:', this.selectedCharacter.name, 'to:', character.name);
    this.selectedCharacter = character;
    
    // Update MovementController with new character data
    this.movementController.updateSelectedCharacter(character);
    
    // If we have a local player, we should recreate it with the new character
    // This is more complex and might require reconnection for real-time sync
    console.log('⚠️ Character updated - consider reconnecting to sync with other players');
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
      currentPlayerId: this.currentPlayerId,
      userUid: this.user?.uid,
      players: Array.from(this.players.entries()).map(([id, player]) => ({
        id,
        position: player.position,
        character: player.character,
        hasMesh: !!player.mesh,
        meshInScene: player.mesh ? this.sceneManager.scene.getObjectByProperty('uuid', player.mesh.uuid) !== undefined : false
      })),
      localPlayer: this.localPlayerRef.current?.position,
      localCharacter: this.selectedCharacter,
      animations: Array.from(this.playersAnimations.keys()),
      testRunner: AnimationTest.getDebugInfo(),
      totalPlayersInMap: this.players.size,
      totalAnimationsTracked: this.playersAnimations.size
    };
  }

  // Debug methods for animation testing
  toggleTestRunner(): void {
    AnimationTest.toggleTestRunner(this.sceneManager.scene);
  }

  removeTestRunner(): void {
    AnimationTest.removeTestRunner(this.sceneManager.scene);
  }

  // Debug method for player state (can be called from browser console)
  debugPlayers(): void {
    console.log('🐛 === PLAYER DEBUG INFO ===');
    console.log(`Total players in map: ${this.players.size}`);
    console.log(`Total animations tracked: ${this.playersAnimations.size}`);
    
    this.players.forEach((player, id) => {
      const hasAnimation = this.playersAnimations.has(id);
      const meshInScene = player.mesh ? this.sceneManager.scene.getObjectByProperty('uuid', player.mesh.uuid) !== undefined : false;
      
      console.log(`Player ${id}:`, {
        character: player.character?.name || 'unknown',
        position: player.position,
        hasMesh: !!player.mesh,
        meshInScene,
        hasAnimation,
        isMoving: player.isMoving
      });
    });
    
    console.log('🐛 === END DEBUG INFO ===');
  }

  cleanup(): void {
    this.webSocketManager.close();
    this.movementController.cleanup();
    this.sceneManager.cleanup();

    // Clean up particle system
    this.particleSystem.dispose();

    // Clean up stair interactions
    StairInteractionManager.getInstance().dispose();

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
