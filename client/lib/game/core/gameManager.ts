import * as THREE from 'three';
import { GameState, GameMessage, Player, PlayerUpdate, PlayerAnimationData, CharacterData, PlayerActionData, SpellActionData, Enemy, EnemyUpdate, Item } from '../types';
import { PlayerManager } from './playerManager';
import { EnemyManager } from './enemyManager';
import { ItemManager } from './itemManager';
import { WebSocketManager } from '../network';
import { MovementController } from './movementController';
import { SceneManager, ParticleSystem } from '../rendering';
import { StairInteractionManager, StairInteractionData } from '../ui/stairInteractionManager';
import { ItemInteractionManager, ItemInteractionData } from '../ui/itemInteractionManager';
import { InventoryManager } from '../ui/inventoryManager';
import { ToastManager } from '../ui/toastManager';
import { DungeonApi } from '../network/dungeonApi';
import { StairInfo, GameItem } from '../types/api';
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
  private enemies = new Map<string, Enemy>();
  private items = new Map<string, Item>();
  
  // Store current player ID to avoid inconsistencies
  private currentPlayerId: string;
  
  // Floor verification tracking
  private lastFloorVerificationTime = 0;
  private floorVerificationInterval = 30000; // Check every 30 seconds

  // Cleanup handler
  private handleBeforeUnload = () => {
    // Attempt graceful WebSocket close on browser exit
    try {
      if (this.webSocketManager) {
        this.webSocketManager.close();
      }
    } catch (error) {
      // Ignore errors during emergency cleanup
    }
  };

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
    private onPlayerDeath?: () => void,
    private onOpenGraphViewer?: () => void
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
      (action, data, target) => this.sendPlayerAction(action, data, target),
      () => this.handleDebugDeath(),
      this.onOpenGraphViewer
    );

    // Add beforeunload handler to ensure cleanup on browser close/kill
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }

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
          
          // Update item interactions with current player position
          const itemManager = ItemInteractionManager.getInstance();
          itemManager.updatePlayerPosition(this.localPlayerRef.current.position);
          
          // Update item bounce animations
          ItemManager.updateItemBounceAnimations();
          
          // Make other players face the local player
          PlayerManager.updateAllOtherPlayersFacing(this.localPlayerRef.current.position);
          
          // Make enemies face the local player
          EnemyManager.updateAllEnemiesFacing(this.localPlayerRef.current.position);
          
          // Make items face the local player
          ItemManager.updateAllItemsFacing(this.localPlayerRef.current.position);
        }
      }
      
      // Ensure particle system is initialized and update it
      if (!this.particleSystem.isInitialized()) {
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
    
    // Set up item interaction callbacks
    this.setupItemInteractions();
    
    // Set up inventory callbacks
    this.setupInventoryInteractions();
  }

  private async createLocalPlayer(): Promise<void> {
        
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
    
  }

  async connectToServer(serverAddress: string): Promise<void> {
    // Set server address for dungeon API calls
    this.sceneManager.setServerAddress(serverAddress);
    
    // Update inventory manager with server address
    const inventoryManager = InventoryManager.getInstance();
    inventoryManager.setServerAddress(serverAddress);
    
    // Load initial scenery and items from server
    await this.loadFloor(); // This will call loadScenery() and loadFloorItems()
    
    // Check for stored player position and rotation from existing character
    const storedPosition = sessionStorage.getItem('playerPosition');
    const storedRotation = sessionStorage.getItem('playerRotation');
    
    if (storedPosition && storedRotation && this.localPlayerRef.current) {
      try {
        const position = JSON.parse(storedPosition);
        const rotation = JSON.parse(storedRotation);
                
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
        
    // Connect to WebSocket
    await this.webSocketManager.connect(serverAddress, this.user, this.selectedCharacter);
  }

  private handleGameMessage(message: GameMessage): void {
    // Add defensive check for message structure
    if (!message || typeof message.type !== 'string') {
      console.warn('⚠️ Received invalid game message:', message);
      return;
    }
    
    // Add defensive check for message.data
    if (!message.data || typeof message.data !== 'object') {
      console.warn('⚠️ Received game message with invalid data:', message);
      return;
    }
        
    switch (message.type) {
      case 'player_joined':
        // Handle new player joining with full player data
        if (message.data.id && message.data.position && message.data.character) {      
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
          this.handlePlayerAction(message.data);
        } else {
          console.warn('⚠️ Invalid player_action message data:', message.data);
        }
        break;

      case 'players_list':
        if (message.data.players && Array.isArray(message.data.players)) {
                    
          message.data.players.forEach((playerData: PlayerUpdate) => {
            // Skip local player
            if (playerData.id !== this.user?.uid) {
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
          this.handleHealthUpdate(message.data);
        } else {
          console.warn('⚠️ Invalid health_update message data:', message.data);
        }
        break;

      case 'respawn_success':
        if (message.data.player) {
          this.handleRespawnSuccess(message.data.player);
        } else {
          console.warn('⚠️ Invalid respawn_success message data:', message.data);
        }
        break;

      case 'enemy-moved':
        if (message.data && message.data.enemies && Array.isArray(message.data.enemies)) {
          message.data.enemies.forEach((enemyData: EnemyUpdate) => {
            this.updateEnemy(enemyData).catch(console.error);
          });
        } else {
          console.warn('⚠️ Invalid enemy-moved message data:', message.data);
        }
        break;

      case 'enemy-despawned':
        if (message.data && message.data.enemyId) {          
          // Remove the enemy from the scene
          this.removeEnemy(message.data.enemyId);
        } else {
          console.warn('⚠️ Invalid enemy-despawned message data:', message.data);
        }
        break;

      case 'item-spawned':
        if (message.data && message.data.item) {
          this.handleItemSpawned(message.data.item);
        } else {
          console.warn('⚠️ Invalid item-spawned message data:', message.data);
        }
        break;

      case 'item-despawned':
        if (message.data && message.data.itemId) {
          this.handleItemDespawned(message.data.itemId);
        } else {
          console.warn('⚠️ Invalid item-despawned message data:', message.data);
        }
        break;

      case 'item-picked-up':
        if (message.data && message.data.itemId) {
          this.handleItemPickedUp(message.data.itemId, message.data.playerId);
        } else {
          console.warn('⚠️ Invalid item-picked-up message data:', message.data);
        }
        break;
    }
  }

  private async updatePlayer(playerData: PlayerUpdate): Promise<void> {
    // Skip if this is the local player
    if (playerData.id === this.currentPlayerId) {
            return;
    }

    
    const existingPlayer = this.players.get(playerData.id);

    if (existingPlayer) {
      // Update existing player
            
      // Check if character has changed and needs sprite recreation
      let needsSpriteRecreation = false;
      if (playerData.character && existingPlayer.character && 
          playerData.character.type && existingPlayer.character.type &&
          playerData.character.style !== undefined && existingPlayer.character.style !== undefined) {
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

  private async updateEnemy(enemyData: EnemyUpdate): Promise<void> {
    const existingEnemy = this.enemies.get(enemyData.id);

    if (existingEnemy) {
      // Update enemy data
      existingEnemy.position = {
        x: enemyData.positionX,
        y: this.movementController.getCurrentPlayerPosition()?.y || 0, // Use player's real-time ground level for Y-axis (vertical)
        z: enemyData.positionY // Server's positionY maps to Three.js Z-axis
      };
      
      if (enemyData.rotationY !== undefined) {
        existingEnemy.rotation = {
          x: 0,
          y: enemyData.rotationY,
          z: 0
        };
      }
      
      existingEnemy.isMoving = enemyData.isMoving;

      // Update position and animation
      try {
        EnemyManager.updateEnemyPosition(existingEnemy, enemyData, this.movementController.getCurrentPlayerPosition() || undefined);
      } catch (error) {
        console.error('❌ Error updating enemy position:', enemyData.id, error);
      }
    } else {
      try {
        const newEnemy: Enemy = {
          id: enemyData.id,
          enemyTypeID: enemyData.enemyTypeID,
          enemyTypeName: enemyData.enemyTypeName,
          position: {
            x: enemyData.positionX,
            y: this.movementController.getCurrentPlayerPosition()?.y || 0, // Use player's real-time ground level for Y-axis (vertical)
            z: enemyData.positionY // Server's positionY maps to Three.js Z-axis
          },
          rotation: {
            x: 0,
            y: enemyData.rotationY || 0,
            z: 0
          },
          isMoving: enemyData.isMoving
        };

        const enemyResult = EnemyManager.createSpriteEnemyModel(newEnemy);
        if (!enemyResult || !enemyResult.model) {
          console.error('❌ Failed to create sprite enemy model for:', enemyData.id);
          return;
        }

        newEnemy.mesh = enemyResult.model;

        // Position the enemy
        enemyResult.model.position.set(
          enemyData.positionX,                                              // X coordinate from server
          this.movementController.getCurrentPlayerPosition()?.y || 0,      // Use player's real-time ground level for Y-axis (vertical)
          enemyData.positionY                                               // Server's positionY maps to Three.js Z-axis
        );

        // Set rotation if provided
        if (enemyData.rotationY !== undefined) {
          enemyResult.model.rotation.y = THREE.MathUtils.degToRad(enemyData.rotationY);
        }

        // Mark as enemy for scene preservation during floor changes
        enemyResult.model.userData.isEnemy = true;

        this.sceneManager.addToScene(enemyResult.model);

        this.enemies.set(enemyData.id, newEnemy);
      } catch (error) {
        console.error('❌ Error creating new enemy:', enemyData.id, error);
        // Clean up any partial state
        this.enemies.delete(enemyData.id);
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

        this.webSocketManager.send(JSON.stringify(actionMessage));
  }

  private handlePlayerAction(actionData: any): void {
        
    // Handle potential nested structure from server
    let playerId, action, data;
    
    if (actionData.action && typeof actionData.action === 'object') {
      // Server wrapped our action data in another layer
            playerId = actionData.action.playerId;
      action = actionData.action.action;
      data = actionData.action.data;
    } else {
      // Direct structure as expected
      playerId = actionData.playerId;
      action = actionData.action;
      data = actionData.data;
    }
    
        
    // Skip if this is the local player (we don't need to visualize our own actions)
    if (playerId === this.currentPlayerId) {
            return;
    }

    
    switch (action) {
      case 'spell_cast':
        this.handleSpellCastAction(playerId, data);
        break;
      default:
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
        
    if (this.onHealthUpdate) {
      this.onHealthUpdate({
        health: healthData.health,
        maxHealth: healthData.maxHealth,
        isAlive: healthData.isAlive
      });
    }

    // If player died, handle death
    if (!healthData.isAlive || healthData.health <= 0) {
            this.handlePlayerDeath();
    }
  }

  private async handlePlayerDeath(): Promise<void> {
        
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
                
        // Load floor A
        await this.loadFloor('A');
              }
    } catch (error) {
      console.error('❌ Error handling player death:', error);
    }
  }

  private handleDebugDeath(): void {
        
    // Update health to show death
    if (this.onHealthUpdate) {
      this.onHealthUpdate({
        health: 0,
        maxHealth: 100,
        isAlive: false
      });
    }

    // Trigger the death sequence (this will open character selection)
    this.handlePlayerDeath();
  }

  private handleRespawnSuccess(playerData: any): void {
        
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

        this.webSocketManager.send(JSON.stringify(respawnMessage));
  }

  private removePlayer(playerId: string): void {
        
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
          }
  }

  private removeEnemy(enemyId: string): void {
    console.log('🗑️ Removing enemy:', enemyId);
    
    const enemy = this.enemies.get(enemyId);
    
    if (enemy && enemy.mesh) {
      try {
        this.sceneManager.removeFromScene(enemy.mesh);
        EnemyManager.disposeEnemyMesh(enemy.mesh);
        EnemyManager.removeEnemy(enemyId);
        this.enemies.delete(enemyId);
        
        console.log('✅ Successfully removed enemy:', enemyId);
      } catch (error) {
        console.error('❌ Error removing enemy:', enemyId, error);
        // Force cleanup even if error occurs
        this.enemies.delete(enemyId);
        EnemyManager.removeEnemy(enemyId);
      }
    } else {
      // Clean up any orphaned data
      this.enemies.delete(enemyId);
      EnemyManager.removeEnemy(enemyId);
      console.log('🧹 Cleaned up orphaned enemy data:', enemyId);
    }
  }

  // Item management methods
  private handleItemSpawned(itemData: GameItem): void {
    console.log('🎒 Item spawned:', itemData);
    
    if (!this.localPlayerRef.current) {
      console.warn('⚠️ Cannot spawn item - no local player');
      return;
    }
    
    const playerGroundLevel = this.movementController.getCurrentPlayerPosition()?.y || 0;
    const item = ItemManager.createItemFromServerData(itemData, playerGroundLevel);
    
    try {
      const itemResult = ItemManager.createSpriteItemModel(item);
      if (!itemResult || !itemResult.model) {
        console.error('❌ Failed to create sprite item model for:', itemData.id);
        return;
      }
      
      item.mesh = itemResult.model;
      
      // Position the item
      itemResult.model.position.set(
        item.position.x,
        item.position.y,
        item.position.z
      );
      
      // Mark as item for scene preservation
      itemResult.model.userData.isItem = true;
      itemResult.model.userData.itemId = itemData.id;
      
      this.sceneManager.addToScene(itemResult.model);
      this.items.set(itemData.id, item);
      
      // Add to interaction manager
      const itemManager = ItemInteractionManager.getInstance();
      itemManager.addItem(item);
      
      console.log('✅ Successfully spawned item:', itemData.id);
    } catch (error) {
      console.error('❌ Error spawning item:', itemData.id, error);
    }
  }

  private handleItemDespawned(itemId: string): void {
    console.log('🗑️ Item despawned:', itemId);
    this.removeItem(itemId);
  }

  private handleItemPickedUp(itemId: string, playerId: string): void {
    console.log('🎒 Item picked up:', { itemId, playerId });
    this.removeItem(itemId);
  }

  private removeItem(itemId: string): void {
    console.log('🗑️ Removing item:', itemId);
    
    const item = this.items.get(itemId);
    
    if (item && item.mesh) {
      try {
        this.sceneManager.removeFromScene(item.mesh);
        ItemManager.removeItem(itemId);
        this.items.delete(itemId);
        
        // Remove from interaction manager
        const itemManager = ItemInteractionManager.getInstance();
        itemManager.removeItem(itemId);
        
        console.log('✅ Successfully removed item:', itemId);
      } catch (error) {
        console.error('❌ Error removing item:', itemId, error);
        // Force cleanup even if error occurs
        this.items.delete(itemId);
        ItemManager.removeItem(itemId);
      }
    } else {
      // Clean up any orphaned data
      this.items.delete(itemId);
      ItemManager.removeItem(itemId);
      console.log('🧹 Cleaned up orphaned item data:', itemId);
    }
  }

  private async handleItemPickup(itemData: ItemInteractionData): Promise<void> {
    try {
      const serverAddress = this.sceneManager.getServerAddress();
      if (!serverAddress) {
        console.error('❌ Server address not available for item pickup');
        return;
      }
      
      console.log('🎒 Attempting to pickup item:', itemData.itemName);
      
      // Hide item interaction popup during pickup
      const itemManager = ItemInteractionManager.getInstance();
      itemManager.forceHidePopup();
      
      // Call pickup API
      const response = await DungeonApi.pickupItem(serverAddress, itemData.itemId);
      
      if (response.success) {
        console.log('✅ Successfully picked up item:', response.item.name);
        // Item removal will be handled by the item-picked-up websocket message
      } else {
        console.error('❌ Failed to pickup item:', response);
      }
    } catch (error) {
      console.error('❌ Error during item pickup:', error);
    }
  }

  private async handleDropItem(itemId: string): Promise<void> {
    try {
      const serverAddress = this.sceneManager.getServerAddress();
      if (!serverAddress) {
        console.error('❌ Server address not available for item drop');
        return;
      }
      
      console.log('📦 Attempting to drop item:', itemId);
      
      // Call drop API
      const response = await DungeonApi.dropItem(serverAddress, itemId);
      
      if (response.success) {
        console.log('✅ Successfully dropped item:', itemId);
        // Show success toast
        const toastManager = ToastManager.getInstance();
        toastManager.showSuccess('Item dropped successfully!');
        // Refresh both inventory and equipment displays
        await this.refreshInventoryDisplays();
        // Item will appear in world via item-spawned websocket message
      } else {
        console.error('❌ Failed to drop item:', response);
        // Show error toast
        const toastManager = ToastManager.getInstance();
        toastManager.showError(response.message || 'Failed to drop item');
      }
    } catch (error) {
      console.error('❌ Error during item drop:', error);
    }
  }

  private async handleEquipItem(itemId: string): Promise<void> {
    try {
      const serverAddress = this.sceneManager.getServerAddress();
      if (!serverAddress) {
        console.error('❌ Server address not available for item equip');
        return;
      }
      
      console.log('⚔️ Attempting to equip item:', itemId);
      
      // Call equip API
      const response = await DungeonApi.equipItem(serverAddress, itemId);
      
      if (response.success) {
        console.log('✅ Successfully equipped item:', itemId);
        // Show success toast
        const toastManager = ToastManager.getInstance();
        toastManager.showSuccess('Item equipped successfully!');
        // Refresh both inventory and equipment displays
        await this.refreshInventoryDisplays();
      } else {
        console.error('❌ Failed to equip item:', response);
        // Show error toast
        const toastManager = ToastManager.getInstance();
        toastManager.showError(response.message || 'Failed to equip item');
      }
    } catch (error) {
      console.error('❌ Error during item equip:', error);
    }
  }

  private async handleUnequipItem(itemId: string): Promise<void> {
    try {
      const serverAddress = this.sceneManager.getServerAddress();
      if (!serverAddress) {
        console.error('❌ Server address not available for item unequip');
        return;
      }
      
      console.log('📤 Attempting to unequip item:', itemId);
      
      // Call unequip API
      const response = await DungeonApi.unequipItem(serverAddress, itemId);
      
      if (response.success) {
        console.log('✅ Successfully unequipped item:', itemId);
        // Show success toast
        const toastManager = ToastManager.getInstance();
        toastManager.showSuccess('Item unequipped successfully!');
        // Refresh both inventory and equipment displays
        await this.refreshInventoryDisplays();
      } else {
        console.error('❌ Failed to unequip item:', response);
        // Show error toast
        const toastManager = ToastManager.getInstance();
        toastManager.showError(response.message || 'Failed to unequip item');
      }
    } catch (error) {
      console.error('❌ Error during item unequip:', error);
    }
  }

  private async refreshInventoryDisplays(): Promise<void> {
    try {
      const inventoryManager = InventoryManager.getInstance();
      
      // Refresh inventory data (which will also refresh equipment panel)
      await inventoryManager.refreshInventory();
      
      console.log('✅ Refreshed inventory and equipment displays');
    } catch (error) {
      console.error('❌ Error refreshing inventory displays:', error);
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
            if (!this.webSocketManager.isConnected) {
                // The reconnection logic will be handled by the component
      }
    };

    const handleOffline = () => {
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
        this.handleUpstairsInteraction(stairData);
      },
      // Downstairs callback
      (stairData: StairInteractionData) => {
        this.handleDownstairsInteraction(stairData);
      }
    );
  }

  private setupItemInteractions(): void {
    const itemManager = ItemInteractionManager.getInstance();
    
    // Set up callback for item pickup
    itemManager.setCallback(
      (itemData: ItemInteractionData) => {
        this.handleItemPickup(itemData);
      }
    );
  }

  private setupInventoryInteractions(): void {
    const inventoryManager = InventoryManager.getInstance();
    
    // Set server address for API calls
    const serverAddress = this.sceneManager.getServerAddress();
    if (serverAddress) {
      inventoryManager.setServerAddress(serverAddress);
    }
    
    // Set up callbacks for inventory and equipment actions
    inventoryManager.setCallbacks({
      onDropItem: (itemId: string) => {
        this.handleDropItem(itemId);
      },
      onEquipItem: (itemId: string) => {
        this.handleEquipItem(itemId);
      },
      onUnequipItem: (itemId: string) => {
        this.handleUnequipItem(itemId);
      }
    });
  }

  private async handleUpstairsInteraction(stairData: StairInteractionData): Promise<void> {
                  
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
      }

  private resetPlayerToSpawn(): void {
    if (!this.localPlayerRef.current) return;
    
        
    // Reset to origin position (spawn point)
    this.localPlayerRef.current.position.set(0, 0, 0);
    
    // Position player on ground level for the new floor
    this.positionPlayerOnGround();
    
      }

  private positionPlayerAtStair(stairInfo: StairInfo, stairType: 'upward' | 'downward'): void {
    if (!this.localPlayerRef.current) return;
    
        
    // Convert grid coordinates to world coordinates (same logic as in StairInteractionManager)
    const cubeSize = CubeConfig.getCubeSize();
    const worldX = stairInfo.locationX * cubeSize + cubeSize / 2;
    const worldZ = stairInfo.locationY * cubeSize + cubeSize / 2;
    
    // Set player position at the stair location
    this.localPlayerRef.current.position.set(worldX, 0, worldZ);
    
    // Position player on ground level for the new floor
    this.positionPlayerOnGround();
    
      }

  private findStairWorldCoordinates(roomName: string, stairType: 'upward' | 'downward'): { x: number, y: number, z: number } | null {
    // Search through all objects in the scene to find stairs for the specified room
    const scene = this.sceneManager.scene;
    let foundStairData: any = null;

    scene.traverse((object) => {
      if (object.userData.type === 'stairs') {        
        if (object.userData.roomName === roomName) {
          const hasTargetStairType = stairType === 'upward' ? object.userData.hasUpwardStair : object.userData.hasDownwardStair;
          if (hasTargetStairType) {
            foundStairData = object.userData;
          }
        }
      }
    });

    if (foundStairData && typeof foundStairData.worldX === 'number') {
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
      
                                                
      // Get the floor layout to find all rooms
      const floorLayout = await DungeonApi.getFloorLayout(serverAddress, targetFloor);
      
      if (!floorLayout.success) {
        console.error(`${logPrefix} ❌ Failed to get floor layout for:`, targetFloor);
        this.resetPlayerToSpawn();
        return;
      }
      
      // Find all rooms on the target floor
      const allRooms = floorLayout.data.nodes.filter(node => node.isRoom);
            
      // Filter to only rooms that have the specific type of stair we're looking for
      const roomsWithRelevantStairs = allRooms.filter(room => {
        if (stairType === 'downward') {
          return room.hasDownwardStair;
        } else {
          return room.hasUpwardStair;
        }
      });
            
      const stairMappings: { roomName: string, upward?: string, downward?: string }[] = [];
      let matchingStair: StairInfo | undefined;
      let matchingRoomName: string | undefined;
      
      // Check each room with the relevant stair type for stairs that lead back to our original floor
      for (const room of roomsWithRelevantStairs) {
        try {
                    const stairsResponse = await DungeonApi.getRoomStairs(serverAddress, room.name);
          
          if (!stairsResponse.success) {
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
          
                    
          if (stairType === 'downward' && stairsResponse.data.downwardStair) {
            const stairDestination = stairsResponse.data.downwardStair.dungeonDagNodeName;
                        
            // Check both exact match and prefix match
            if (stairDestination === originalFloorPrefix || stairDestination === originalFloor) {
                            matchingStair = stairsResponse.data.downwardStair;
              matchingRoomName = room.name;
            } else {
                          }
          } else if (stairType === 'upward' && stairsResponse.data.upwardStair) {
            const stairDestination = stairsResponse.data.upwardStair.dungeonDagNodeName;
                        
            // Check both exact match and prefix match
            if (stairDestination === originalFloorPrefix || stairDestination === originalFloor) {
                            matchingStair = stairsResponse.data.upwardStair;
              matchingRoomName = room.name;
            } else {
                          }
          }
          
        } catch (error) {
          console.warn(`${logPrefix} ⚠️ Error checking stairs for room ${room.name}:`, error);
        }
      }
      
      // Log all stair mappings found
            
      if (matchingStair && matchingRoomName) {

        // Get world coordinates from the rendered stair model
        const stairWorldCoords = this.findStairWorldCoordinates(matchingRoomName, stairType);
        
        if (stairWorldCoords && this.localPlayerRef.current) {
                              
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
        }
        
        return;
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
              }
    }
  }

  async loadFloor(floorName?: string): Promise<void> {
    try {
      console.log(`🏗️ GameManager.loadFloor: Starting to load floor "${floorName}"`);
      
      // Get current floor to determine if this is a floor change
      const currentFloor = this.sceneManager.getCurrentFloor();
      const isFloorChange = currentFloor && floorName && currentFloor !== floorName;
      
      console.log(`🔍 Floor change detection: current="${currentFloor}", target="${floorName}", isChange=${isFloorChange}`);
      
      // Only clear items if we're actually changing floors
      if (isFloorChange) {
        console.log(`🧹 Clearing items due to floor change from "${currentFloor}" to "${floorName}"`);
        this.clearAllItems();
      } else {
        console.log(`🔄 Same floor or initial load - preserving existing items`);
      }
      
      // Count items before loading scenery
      const itemsBeforeScenery = this.sceneManager.scene.children.filter(child => child.userData.isItem).length;
      console.log(`🔍 GameManager.loadFloor: Found ${itemsBeforeScenery} items before loading scenery`);
      
      await this.sceneManager.loadScenery(floorName);
      
      // Count items after loading scenery but before loading items
      const itemsAfterScenery = this.sceneManager.scene.children.filter(child => child.userData.isItem).length;
      console.log(`🔍 GameManager.loadFloor: Found ${itemsAfterScenery} items after loading scenery, before loading items`);
      
      // Update collision data after loading new scenery
      this.movementController.updateCollisionData(this.sceneManager.scene);
      // Position player on ground
      this.positionPlayerOnGround();
      
      // Load items for the current floor (this will only add missing items, not clear existing ones)
      console.log(`🎒 GameManager.loadFloor: About to call loadFloorItems()`);
      await this.loadFloorItems();
      
      // Count items after loading items
      const itemsAfterItems = this.sceneManager.scene.children.filter(child => child.userData.isItem).length;
      console.log(`🔍 GameManager.loadFloor: Found ${itemsAfterItems} items after loading items`);
      
      // Reinitialize particle system after floor change
      if (!this.particleSystem.isInitialized()) {
        this.particleSystem.reinitialize();
      }
      
      // Notify about floor change
      const newCurrentFloor = this.sceneManager.getCurrentFloor();
      if (this.onFloorChange && newCurrentFloor) {
        this.onFloorChange(newCurrentFloor);
      }
      
    } catch (error) {
      console.error('Error loading floor:', error);
      throw error;
    }
  }

  private async loadFloorItems(): Promise<void> {
    try {
      const serverAddress = this.sceneManager.getServerAddress();
      if (!serverAddress) {
        console.warn('⚠️ Server address not available, skipping item loading');
        return;
      }

      // Get the current floor name
      const currentFloor = this.sceneManager.getCurrentFloor();
      if (!currentFloor) {
        console.warn('⚠️ Current floor not available, skipping item loading');
        return;
      }

      console.log('🎒 Loading items for current floor...', currentFloor);
      
      // Count existing items (don't clear them - they may be preserved or already correct)
      let existingItemCount = 0;
      const existingItems = new Set<string>();
      this.sceneManager.scene.traverse((child) => {
        if (child.userData.isItem && child.userData.itemId) {
          existingItemCount++;
          existingItems.add(child.userData.itemId);
        }
      });
      console.log(`🔍 Found ${existingItemCount} existing items in scene`);
      
      // Fetch items from server for the specific floor
      const itemsResponse = await DungeonApi.getFloorItems(serverAddress, currentFloor);
      
      if (itemsResponse.success && itemsResponse.data.items) {
        console.log(`🎒 Found ${itemsResponse.data.items.length} items on floor ${itemsResponse.data.floor}`);
        
        const playerGroundLevel = this.movementController.getCurrentPlayerPosition()?.y || 0;
        const itemsToAdd: Item[] = [];
        
        // Create items from server data - only add items that don't already exist
        for (const itemData of itemsResponse.data.items) {
          // Skip items that already exist in the scene
          if (existingItems.has(itemData.id)) {
            console.log(`⏭️ Skipping item ${itemData.id} - already exists in scene`);
            continue;
          }
          
          try {
            console.log(`➕ Adding new item: ${itemData.id} (${itemData.name})`);
            const item = ItemManager.createItemFromServerData(itemData, playerGroundLevel);
            const itemResult = ItemManager.createSpriteItemModel(item);
            
            if (itemResult && itemResult.model) {
              item.mesh = itemResult.model;
              
              // Position the item
              itemResult.model.position.set(
                item.position.x,
                item.position.y,
                item.position.z
              );
              
              // Mark as item for scene preservation
              itemResult.model.userData.isItem = true;
              itemResult.model.userData.itemId = itemData.id;
              
              this.sceneManager.addToScene(itemResult.model);
              this.items.set(itemData.id, item);
              itemsToAdd.push(item);
              
              console.log(`✅ Added item: ${itemData.name} at (${item.position.x}, ${item.position.z})`);
              
              // Verify item is actually in scene
              const itemInScene = this.sceneManager.scene.getObjectByProperty('uuid', itemResult.model.uuid);
              if (!itemInScene) {
                console.error(`❌ Item ${itemData.id} was added but not found in scene!`);
              } else {
                console.log(`✅ Item ${itemData.id} verified in scene with UUID: ${itemResult.model.uuid}`);
              }
            } else {
              console.error(`❌ Failed to create sprite model for item: ${itemData.id}`);
            }
          } catch (error) {
            console.error(`❌ Error creating item ${itemData.id}:`, error);
          }
        }
        
        // Initialize item interactions with ALL current items (existing + newly added)
        const itemManager = ItemInteractionManager.getInstance();
        const allCurrentItems = Array.from(this.items.values());
        itemManager.initializeItems(allCurrentItems);
        
        console.log(`🎯 Initialized ItemInteractionManager with ${allCurrentItems.length} total items (${itemsToAdd.length} newly added)`);
        
        // Final verification - count items actually in scene
        let finalItemCount = 0;
        this.sceneManager.scene.traverse((child) => {
          if (child.userData.isItem) {
            finalItemCount++;
          }
        });
        
        console.log(`🎒 Successfully added ${itemsToAdd.length} new items`);
        console.log(`🔍 Total items now in scene: ${finalItemCount}`);
        
      } else {
        console.log('🎒 No items found on current floor');
      }
    } catch (error) {
      console.error('❌ Error loading floor items:', error);
    }
  }

  private clearAllItems(): void {
    console.log('🧹 Clearing all items from scene...');
    
    // Remove items from scene
    this.items.forEach((item, itemId) => {
      if (item.mesh) {
        this.sceneManager.removeFromScene(item.mesh);
      }
    });
    
    // Clear item collections
    this.items.clear();
    ItemManager.clearAllItems();
    
    // Clear item interactions
    const itemManager = ItemInteractionManager.getInstance();
    itemManager.initializeItems([]);
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
        this.selectedCharacter = character;
    
    // Update MovementController with new character data
    this.movementController.updateSelectedCharacter(character);
    
    // If we have a local player, we should recreate it with the new character
    // This is more complex and might require reconnection for real-time sync
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
      totalPlayersInMap: this.players.size,
      totalAnimationsTracked: this.playersAnimations.size
    };
  }

  cleanup(): void {
    // Remove beforeunload event listener
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
    
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

    // Clean up enemies
    this.enemies.forEach((enemy) => {
      if (enemy.mesh) {
        EnemyManager.disposeEnemyMesh(enemy.mesh);
      }
      EnemyManager.removeEnemy(enemy.id);
    });
    this.enemies.clear();

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
