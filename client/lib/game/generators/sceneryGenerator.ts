import * as THREE from 'three';
import { FloorRenderer, DungeonDagData } from '../rendering/floorRenderer';
import { ServerSceneryOptions } from '../types/generator';
import { CubeFloorRenderer } from '../rendering/cubeFloorRenderer';
import { CubeConfig } from '../config/cubeConfig';
import { DungeonApi } from '../network/dungeonApi';
import { GeneratedFloorTilesResponse } from '../types/api';

export class ServerSceneryGenerator {
  /**
   * Generates a complete floor layout using server data
   * @param scene - The Three.js scene to add the floor to
   * @param serverAddress - The game server address to fetch data from
   * @param dungeonDagNodeName - The floor identifier from the server
   * @param options - Configuration options for rendering
   */
  static async generateServerFloor(
    scene: THREE.Scene,
    serverAddress: string,
    dungeonDagNodeName: string,
    options: ServerSceneryOptions = {}
  ): Promise<{
    floorLayout: GeneratedFloorTilesResponse;
    floorGroup: THREE.Group;
    wallGroup: THREE.Group | null;
    stairGroup: THREE.Group | null;
    overlapCount: number;
    wallCount: number;
    stairCount: number;
  }> {
    const {
      cubeSize = CubeConfig.getCubeSize(),
      floorColor = 0x0080ff, // Blue for rooms
      hallwayFloorColor = 0xff0000 // Red for hallways
    } = options;

        
    try {
      // Step 1: Use FloorRenderer to get and render the floor
            const floorLayout = await FloorRenderer.renderFloor(
        scene,
        serverAddress,
        dungeonDagNodeName,
        {
          cubeSize,
          roomColor: floorColor,
          hallwayColor: hallwayFloorColor,
          showWalls: true,
          showStairs: true
        }
      );

      // Create groups for organization
      const floorGroup = new THREE.Group();
      floorGroup.name = 'server-floor';
      scene.add(floorGroup);

      
      return {
        floorLayout,
        floorGroup,
        wallGroup: null, // FloorRenderer handles walls internally
        stairGroup: null, // FloorRenderer handles stairs internally
        overlapCount: 0, // No overlaps with server tiles
        wallCount: 0, // Handled internally by FloorRenderer
        stairCount: floorLayout.data.tiles.upwardStairTiles.length + floorLayout.data.tiles.downwardStairTiles.length,
      };
    } catch (error) {
      console.error('Error generating server floor:', error);
      throw error;
    }
  }

  /**
   * Get the spawn location for new players
   */
  static async getSpawnLocation(serverAddress: string): Promise<string> {
        try {
      // Get the player's current status from the API
      const currentStatusResponse = await DungeonApi.getCurrentStatus(serverAddress);
      
      if (currentStatusResponse.success && currentStatusResponse.data.currentFloor) {
                return currentStatusResponse.data.currentFloor;
      } else {
        console.warn(`⚠️ Failed to get current floor from API, using default spawn location`);
        return "A"; // Default to root node
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'PLAYER_NOT_ALIVE') {
                return "A"; // Default to root node for new players
      }
      console.error(`❌ Error getting current status from API:`, error);
            return "A"; // Default to root node as fallback
    }
  }

  /**
   * Notify server that player moved to a new floor
   */
  static async notifyPlayerMovedFloor(serverAddress: string, newFloorName: string): Promise<void> {
        try {
      await DungeonApi.notifyPlayerMovedFloor(serverAddress, newFloorName);
          } catch (error) {
      console.error(`❌ Failed to notify server of floor change to ${newFloorName}:`, error);
      throw error;
    }
  }

  /**
   * Clear all scenery from the scene while preserving important objects
   */
  static clearScene(scene: THREE.Scene): void {
    const objectsToRemove: THREE.Object3D[] = [];
    const objectsToPreserve: string[] = [];
    
    scene.traverse((child) => {
      // More comprehensive preservation logic
      const shouldPreserve = (
        child === scene || // The scene itself
        child.type === 'Camera' || 
        child.type === 'Light' ||
        child.type === 'AmbientLight' ||
        child.type === 'DirectionalLight' ||
        child.type === 'PointLight' ||
        child.type === 'HemisphereLight' ||
        child.type === 'SpotLight' ||
        child.userData.isPlayer === true || // Current player
        child.userData.isOtherPlayer === true || // Other players
        child.userData.preserve === true || // Explicitly marked for preservation
        child.name === 'AllFloorCubes' || // Existing floor cubes (will be replaced)
        child.name?.includes('Player') || // Any object with "Player" in name
        child.name?.includes('player') || // Any object with "player" in name
        child.name?.includes('Character') || // Any character models
        child.name?.includes('character') || // Any character models
        (child.parent && child.parent.userData.isPlayer) || // Child of player
        (child.parent && child.parent.userData.isOtherPlayer) // Child of other player
      );
      
      if (shouldPreserve) {
        objectsToPreserve.push(child.name || child.type || 'unnamed');
      } else {
        objectsToRemove.push(child);
      }
    });
    
            
    // Remove objects in reverse order to avoid issues with nested objects
    objectsToRemove.reverse().forEach((obj) => {
      try {
        if (obj.parent) {
          obj.parent.remove(obj);
        }
        // Dispose of geometries and materials to prevent memory leaks
        if ('geometry' in obj && obj.geometry) {
          (obj as any).geometry.dispose();
        }
        if ('material' in obj && obj.material) {
          const material = (obj as any).material;
          if (Array.isArray(material)) {
            material.forEach((mat) => mat?.dispose());
          } else {
            material?.dispose();
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error removing object ${obj.name || obj.type}:`, error);
      }
    });
    
    // Double-check that important objects are still in the scene
    let playerCount = 0;
    let otherPlayerCount = 0;
    scene.traverse((child) => {
      if (child.userData.isPlayer) playerCount++;
      if (child.userData.isOtherPlayer) otherPlayerCount++;
    });
    
      }

  /**
   * Debug method to log all objects in the scene
   */
  static debugSceneObjects(scene: THREE.Scene): void {
        
    const objectSummary: { [key: string]: number } = {};
    const playerObjects: any[] = [];
    
    scene.traverse((child) => {
      const type = child.type || 'Unknown';
      objectSummary[type] = (objectSummary[type] || 0) + 1;
      
      // Log player-related objects
      if (child.userData.isPlayer || child.userData.isOtherPlayer || 
          child.name?.toLowerCase().includes('player') ||
          child.name?.toLowerCase().includes('character')) {
        playerObjects.push({
          name: child.name || 'unnamed',
          type: child.type,
          isPlayer: child.userData.isPlayer,
          isOtherPlayer: child.userData.isOtherPlayer,
          userData: child.userData
        });
      }
    });
    
    console.table(objectSummary);
      }

  /**
   * Alternative safer clear method - only removes specific scenery types
   */
  static clearSceneryOnly(scene: THREE.Scene): void {
    const objectsToRemove: THREE.Object3D[] = [];
    
    scene.traverse((child) => {
      // Only remove objects that are clearly scenery
      const isScenery = (
        child.name === 'AllFloorCubes' || // Previous floor cubes
        child.name === 'stairs' || // Stair group
        child.name === 'Ceiling' || // Ceiling group
        child.name === 'Walls' || // Wall group
        child.name?.includes('Room') ||
        child.name?.includes('Hallway') ||
        child.name?.includes('Floor') ||
        child.name?.includes('Wall') ||
        child.name?.includes('Scenery') ||
        child.userData.isScenery === true ||
        child.userData.type === 'stairs' || // Individual stair models
        child.userData.isCeiling === true || // Individual ceiling blocks
        (child.type === 'Mesh' && 
         !child.userData.isPlayer && 
         !child.userData.isOtherPlayer && 
         !child.userData.preserve &&
         (child as THREE.Mesh).material && 
         ((child as THREE.Mesh).material as THREE.MeshLambertMaterial).color &&
         // Check if it's a colored cube (likely floor/wall)
         (((child as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHex() === 0x0080ff || // Blue rooms
          ((child as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHex() === 0xff0000 || // Red hallways
          ((child as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHex() === 0x800080))  // Purple overlaps
      );
      
      if (isScenery) {
        objectsToRemove.push(child);
      }
    });
    
        
    objectsToRemove.forEach((obj) => {
      try {
        if (obj.parent) {
          obj.parent.remove(obj);
        }
        // Dispose of resources
        if ('geometry' in obj && obj.geometry) {
          (obj as any).geometry.dispose();
        }
        if ('material' in obj && obj.material) {
          const material = (obj as any).material;
          if (Array.isArray(material)) {
            material.forEach((mat) => mat?.dispose());
          } else {
            material?.dispose();
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error removing scenery object:`, error);
      }
    });
  }

  /**
   * Help debug player visibility issues - call from browser console
   */
  static debugPlayerVisibility(scene: THREE.Scene): void {
            
    let currentPlayers = 0;
    let otherPlayers = 0;
    let allPlayers = 0;
    
    scene.traverse((child) => {
      if (child.userData.isPlayer) {
        currentPlayers++;
        console.log(`👤 Current Player:`, {
          name: child.name,
          type: child.type,
          visible: child.visible,
          position: child.position,
          userData: child.userData,
          parent: child.parent?.name || 'scene'
        });
      }
      
      if (child.userData.isOtherPlayer) {
        otherPlayers++;
        console.log(`👥 Other Player:`, {
          name: child.name,
          type: child.type,
          visible: child.visible,
          position: child.position,
          userData: child.userData,
          parent: child.parent?.name || 'scene'
        });
      }
      
      if (child.name?.toLowerCase().includes('player') || 
          child.name?.toLowerCase().includes('character')) {
        allPlayers++;
        console.log(`🎭 Player-like object:`, {
          name: child.name,
          type: child.type,
          visible: child.visible,
          userData: child.userData
        });
      }
    });
    
        
    if (currentPlayers === 0) {
      console.error(`❌ No current player found! This indicates the player model was accidentally removed.`);
          }
  }
}