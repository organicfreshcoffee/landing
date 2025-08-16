import * as THREE from 'three';
import { GameState, GameMessage, Player, PlayerUpdate, PlayerAnimationData, CharacterData } from '../types';
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
    private onFloorChange?: (floorName: string) => void
  ) {
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
      (fromPos, toPos) => this.particleSystem.castSpell(fromPos, toPos)
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
        
        // Update stair interactions with current player position
        if (this.localPlayerRef.current) {
          const stairManager = StairInteractionManager.getInstance();
          stairManager.updatePlayerPosition(this.localPlayerRef.current.position);
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
    });

    // Set up visibility change handler
    this.setupVisibilityHandler();

    // Set up network connectivity handlers
    this.setupNetworkHandlers();
    
    // Set up stair interaction callbacks
    this.setupStairInteractions();
  }

  private async createLocalPlayer(): Promise<void> {
    console.log('🏃 Creating local player...');
    const localPlayerData = await ModelLoader.loadPlayerModel();
    const localPlayerScene = localPlayerData.scene;
    
    console.log('📊 Local player data:', {
      hasAnimations: localPlayerData.animations.length > 0,
      animationCount: localPlayerData.animations.length,
      sceneUUID: localPlayerScene.uuid
    });
    
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
          
          console.log('✅ Local player StickMan_Run action configured');
        }
      });
      
      // Start the walk animation in paused state so it's ready
      if (this.localPlayerActions.current.StickMan_Run) {
        const walkAction = this.localPlayerActions.current.StickMan_Run;
        walkAction.reset();
        walkAction.play();
        walkAction.paused = true;
        walkAction.enabled = true;
        
        console.log('🎭 Local player animation initialized:', {
          isRunning: walkAction.isRunning(),
          paused: walkAction.paused,
          enabled: walkAction.enabled,
          timeScale: walkAction.timeScale
        });
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
    const initialY = localPlayerData.groundOffset?.y || 0;
    localPlayerScene.position.set(
      localPlayerData.groundOffset?.x || 0,
      initialY,
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
    
    // Update collision data after loading scenery
    this.movementController.updateCollisionData(this.sceneManager.scene);
    
    // Position player on ground level
    this.positionPlayerOnGround();
    
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
    switch (message.type) {
      case 'player_moved':
        // Handle both new players joining and existing players moving
        // Character data is included in all movement messages
        if (message.data.playerId && message.data.position) {
          // Only log character data for new players
          const isNewPlayer = !this.players.has(message.data.playerId);
          if (isNewPlayer && message.data.character) {
            console.log('👥 New player joined:', message.data.character.name);
          }
          
          this.updatePlayer({
            id: message.data.playerId,
            position: message.data.position,
            rotation: message.data.rotation,
            isMoving: message.data.isMoving || false,
            movementDirection: message.data.movementDirection || 'none',
            character: message.data.character
          }).catch(console.error);
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
      // Update character data if provided
      if (playerData.character) {
        existingPlayer.character = playerData.character;
      }
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
        movementDirection: playerData.movementDirection || 'none',
        character: playerData.character
      };
      
      const playerResult = await PlayerManager.createPlayerModel(newPlayer);
      newPlayer.mesh = playerResult.model;
      
      // Mark as other player for scene preservation during floor changes
      playerResult.model.userData.isOtherPlayer = true;
      
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
    console.log('⬆️ Handling upstairs interaction for room:', stairData.roomName);
    
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
      }
      
      const targetFloor = stairsResponse.data.upwardStair.dungeonDagNodeName;
      const currentFloor = stairData.roomName; // The floor we're coming from
      console.log(`🔺 Going upstairs from ${currentFloor} to floor: ${targetFloor}`);
      
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
    console.log('⬇️ Handling downstairs interaction for room:', stairData.roomName);
    
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
      }
      
      const targetFloor = stairsResponse.data.downwardStair.dungeonDagNodeName;
      const currentFloor = stairData.roomName; // The floor we're coming from
      console.log(`🔻 Going downstairs from ${currentFloor} to floor: ${targetFloor}`);
      
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
    
    scene.traverse((object) => {
      if (object.userData.type === 'stairs' && object.userData.roomName === roomName) {
        const hasTargetStairType = stairType === 'upward' ? object.userData.hasUpwardStair : object.userData.hasDownwardStair;
        if (hasTargetStairType) {
          foundStairData = object.userData;
        }
      }
    });
    
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
          
          if (stairType === 'downward' && stairsResponse.data.downwardStair) {
            const stairDestination = stairsResponse.data.downwardStair.dungeonDagNodeName;
            console.log(`${logPrefix} 🔍 Room ${room.name} downward stair goes to: ${stairDestination}, comparing with prefix: ${originalFloorPrefix}`);
            if (stairDestination === originalFloorPrefix) {
              matchingStair = stairsResponse.data.downwardStair;
              matchingRoomName = room.name;
            }
          } else if (stairType === 'upward' && stairsResponse.data.upwardStair) {
            const stairDestination = stairsResponse.data.upwardStair.dungeonDagNodeName;
            console.log(`${logPrefix} 🔍 Room ${room.name} upward stair goes to: ${stairDestination}, comparing with prefix: ${originalFloorPrefix}`);
            if (stairDestination === originalFloorPrefix) {
              matchingStair = stairsResponse.data.upwardStair;
              matchingRoomName = room.name;
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
      players: Array.from(this.players.entries()).map(([id, player]) => ({
        id,
        position: player.position,
        character: player.character
      })),
      localPlayer: this.localPlayerRef.current?.position,
      localCharacter: this.selectedCharacter,
      animations: Array.from(this.playersAnimations.keys()),
      testRunner: AnimationTest.getDebugInfo()
    };
  }

  // Debug methods for animation testing
  toggleTestRunner(): void {
    AnimationTest.toggleTestRunner(this.sceneManager.scene);
  }

  removeTestRunner(): void {
    AnimationTest.removeTestRunner(this.sceneManager.scene);
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
