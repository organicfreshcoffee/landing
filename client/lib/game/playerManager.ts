import * as THREE from 'three';
import { Player, PlayerUpdate, ModelData, PlayerAnimationData } from './types';
import { ModelLoader } from './modelLoader';

export class PlayerManager {
  static generatePlayerColor(playerId: string): string {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', 
      '#ffeaa7', '#dda0dd', '#98d8c8', '#f7dc6f'
    ];
    const hash = playerId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }

  static async createPlayerModel(player: Player): Promise<{ 
    model: THREE.Object3D; 
    mixer?: THREE.AnimationMixer; 
    actions?: { [key: string]: THREE.AnimationAction } 
  }> {
    const modelData = await ModelLoader.loadPlayerModel();
    
    // Use the properly cloned scene directly
    const playerModel = modelData.scene;
    
    // Debug: Log what we're working with for positioning issues
    console.log(`Creating player model for ${player.id}:`, {
      modelBounds: new THREE.Box3().setFromObject(playerModel),
      playerPosition: player.position,
      groundOffset: modelData.groundOffset
    });
    
    // Fix SkinnedMesh coordinate system issues
    this.fixSkinnedMeshes(playerModel, player.id);
    
    // Create animation mixer and actions if animations are available
    const animationResult = this.setupAnimations(playerModel, modelData, player);
    
    // Apply player-specific properties and color
    this.applyPlayerStyling(playerModel, player);
    
    // Set world position and rotation
    this.positionPlayer(playerModel, player);
    
    return animationResult;
  }

  private static fixSkinnedMeshes(playerModel: THREE.Group, playerId: string): void {
    playerModel.traverse((child: THREE.Object3D) => {
      if (child.type === 'Bone' || child.type === 'SkinnedMesh') {
        console.log(`Player ${playerId} - ${child.type}:`, child.name, 'local pos:', child.position.toArray());
        
        // Fix SkinnedMesh coordinate system issues
        if (child.type === 'SkinnedMesh') {
          // Force the SkinnedMesh to respect parent transforms
          child.updateMatrixWorld(true);
          
          // Reset the SkinnedMesh to origin if it's not already there
          if (child.position.x !== 0 || child.position.y !== 0 || child.position.z !== 0) {
            console.log(`Resetting SkinnedMesh position for player ${playerId}`);
            child.position.set(0, 0, 0);
          }
          
          // Ensure the SkinnedMesh doesn't have its own transform that conflicts
          child.matrixAutoUpdate = true;
          
          // Additional fix: ensure the skeleton respects the parent transform
          const skinnedMesh = child as THREE.SkinnedMesh;
          if (skinnedMesh.skeleton) {
            skinnedMesh.skeleton.calculateInverses();
          }
          
          console.log(`Fixed SkinnedMesh for player ${playerId}`);
        }
      }
    });
  }

  private static setupAnimations(
    playerModel: THREE.Group, 
    modelData: ModelData, 
    player: Player
  ): { model: THREE.Object3D; mixer?: THREE.AnimationMixer; actions?: { [key: string]: THREE.AnimationAction } } {
    let mixer: THREE.AnimationMixer | undefined;
    let actions: { [key: string]: THREE.AnimationAction } = {};
    
    if (modelData.animations.length > 0) {
      mixer = new THREE.AnimationMixer(playerModel);
      
      // Create actions for each animation
      modelData.animations.forEach((clip) => {
        const action = mixer!.clipAction(clip);
        actions[clip.name] = action;
        
        // Set default properties for walk animation
        if (clip.name === 'StickMan_Run') {
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.clampWhenFinished = true;
          action.weight = 1.0;
          // Initialize based on player's current movement state
          action.reset();
          action.play();
          action.paused = !player.isMoving;
          action.enabled = true;
          
          // Set initial animation direction if player is moving
          if (player.isMoving) {
            action.timeScale = player.movementDirection === 'backward' ? -1 : 1;
          }
        }
      });
      
      console.log('Created animation actions for player:', Object.keys(actions));
    }

    return { model: playerModel, mixer, actions };
  }

  private static applyPlayerStyling(playerModel: THREE.Group, player: Player): void {
    playerModel.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        // Clone material to avoid sharing between players
        if (Array.isArray(child.material)) {
          child.material = child.material.map(mat => {
            const clonedMat = mat.clone();
            clonedMat.color.setHex(parseInt(player.color.replace('#', '0x')));
            return clonedMat;
          });
        } else {
          const clonedMaterial = child.material.clone();
          clonedMaterial.color.setHex(parseInt(player.color.replace('#', '0x')));
          child.material = clonedMaterial;
        }
      }
    });
  }

  private static positionPlayer(playerModel: THREE.Group, player: Player): void {
    console.log(`Setting player ${player.id} position to:`, player.position);
    playerModel.position.set(
      player.position.x,
      player.position.y,
      player.position.z
    );
    
    // Set only Y rotation with Math.PI offset to account for model's built-in rotation
    playerModel.rotation.set(
      0, // Keep character upright
      player.rotation.y + Math.PI,
      0  // Keep character upright
    );
    playerModel.castShadow = true;
    
    // Force update transforms and verify final positions
    playerModel.updateMatrixWorld(true);
    
    // Debug: Check final world positions after all transforms
    this.debugWorldPosition(playerModel, player);
  }

  private static debugWorldPosition(playerModel: THREE.Group, player: Player): void {
    playerModel.traverse((child: THREE.Object3D) => {
      if (child.type === 'SkinnedMesh') {
        const worldPos = child.getWorldPosition(new THREE.Vector3());
        console.log(`Final world position for player ${player.id} SkinnedMesh:`, worldPos.toArray());
        console.log(`Expected position:`, [player.position.x, player.position.y, player.position.z]);
        
        // If world position is still wrong, this indicates a deeper issue
        if (Math.abs(worldPos.x - player.position.x) > 0.1 || 
            Math.abs(worldPos.z - player.position.z) > 0.1) {
          console.warn(`⚠️  Player ${player.id} SkinnedMesh world position mismatch!`);
        }
      }
    });
  }

  static updatePlayerPosition(player: Player, playerData: PlayerUpdate): void {
    // Update existing player position
    player.position = playerData.position;
    if (playerData.rotation) {
      player.rotation = playerData.rotation;
    }
    
    // Update movement state for animation
    player.isMoving = playerData.isMoving;
    player.movementDirection = playerData.movementDirection;
    
    if (player.mesh) {
      player.mesh.position.set(
        playerData.position.x,
        playerData.position.y,
        playerData.position.z
      );
      if (playerData.rotation) {
        // Apply only Y rotation with Math.PI offset
        player.mesh.rotation.set(
          0,
          playerData.rotation.y + Math.PI,
          0
        );
      }
      
      // Force a render update
      if (player.mesh.parent) {
        player.mesh.updateMatrixWorld(true);
      }
    }
  }

  static updatePlayerAnimation(
    playerId: string, 
    playerData: PlayerUpdate, 
    playersAnimations: Map<string, PlayerAnimationData>
  ): void {
    const animData = playersAnimations.get(playerId);
    if (animData && animData.actions.StickMan_Run) {
      const walkAction = animData.actions.StickMan_Run;
      
      // Use the RECEIVED playerData.isMoving directly
      if (playerData.isMoving) {
        if (!walkAction.isRunning()) {
          walkAction.play();
        }
        walkAction.paused = false;
        walkAction.enabled = true;
        
        // Set animation direction based on movement
        if (playerData.movementDirection === 'backward') {
          walkAction.timeScale = -1;
        } else {
          walkAction.timeScale = 1;
        }
      } else {
        // Pause instead of stop to maintain smooth transitions
        walkAction.paused = true;
      }
    }
  }

  static disposePlayerMesh(mesh: THREE.Object3D): void {
    if (mesh instanceof THREE.Mesh) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    } else if (mesh instanceof THREE.Group) {
      // Dispose of all meshes in the group
      mesh.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    }
  }
}
