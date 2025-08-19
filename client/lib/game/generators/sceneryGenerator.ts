import * as THREE from 'three';
import { FloorGenerator, DungeonDagData } from './floorGenerator';
import { ServerFloorLayout, ServerSceneryOptions } from '../types/generator';
import { DungeonFloorRenderer } from '../rendering/dungeonFloorRenderer';
import { CubeFloorRenderer } from '../rendering/cubeFloorRenderer';
import { CubeConfig } from '../config/cubeConfig';
import { DungeonApi } from '../network/dungeonApi';

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
    floorLayout: ServerFloorLayout;
    floorGroup: THREE.Group;
    wallGroup: THREE.Group | null;
    stairGroup: THREE.Group | null;
    roomCount: number;
    hallwayCount: number;
    overlapCount: number;
    wallCount: number;
    stairCount: number;
    totalArea: number;
  }> {
    const {
      cubeSize = CubeConfig.getCubeSize(),
      floorColor = 0x0080ff, // Blue for rooms
      hallwayFloorColor = 0xff0000 // Red for hallways
    } = options;

    console.log(`🏰 ServerSceneryGenerator: Starting floor generation for ${dungeonDagNodeName} from ${serverAddress}`);
    
    try {
      // Step 1: Get floor layout from server
      console.log(`📡 ServerSceneryGenerator: Fetching floor layout...`);
      const floorLayout = await FloorGenerator.getFloorLayout(serverAddress, dungeonDagNodeName);

      console.log(`🎯 Received layout: ${floorLayout.rooms.length} rooms, ${floorLayout.hallways.length} hallways`);
      console.log(`📐 Bounds: ${floorLayout.bounds.width}x${floorLayout.bounds.height}`);

      // Clear any existing cube registrations but preserve players and lighting
      CubeFloorRenderer.clearRegistry();
      
      // Use safer clearing method to avoid accidentally removing players
      this.clearSceneryOnly(scene);
      
      // Optional: Add debug logging to see what's in the scene
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 Before floor generation:`);
        this.debugSceneObjects(scene);
      }

      // Step 2: Choose optimal rendering method based on available data
      let result;
      if (FloorGenerator.hasServerTiles(floorLayout)) {
        console.log(`🚀 Using optimized server-tile rendering`);
        result = await DungeonFloorRenderer.renderFromServerTiles(scene, floorLayout, {
          cubeSize,
          roomColor: floorColor,
          hallwayColor: hallwayFloorColor,
          yOffset: 0,
          hallwayWidth: 1,
          showDoors: true,
          showStairs: false,
          showStairModels: true,
          showDebug: false
        });
      } else {
        console.log(`⚙️ Using legacy room/hallway rendering`);
        result = await DungeonFloorRenderer.renderDungeonFloorFromLayout(scene, floorLayout, {
          cubeSize,
          roomColor: floorColor,
          hallwayColor: hallwayFloorColor,
          yOffset: 0,
          hallwayWidth: 1,
          showDoors: true,
          showStairs: false,
          showStairModels: true,
          showDebug: false
        });
      }

      console.log(`✅ Server floor generation finished for: ${dungeonDagNodeName}`);
      console.log(`📊 Generated: ${result.roomCount} rooms, ${result.hallwayCount} hallways`);
      console.log(`🎯 Total area: ${result.totalArea} cubes`);
      console.log(`🟣 Overlaps: ${result.overlapCount} cubes`);
      console.log(`🧱 Walls: ${result.wallCount} cubes`);
      console.log(`🏗️ Stairs: ${result.stairCount} models`);

      return {
        floorLayout: result.layout,
        floorGroup: result.floorGroup,
        wallGroup: result.wallGroup,
        stairGroup: result.stairGroup,
        roomCount: result.roomCount,
        hallwayCount: result.hallwayCount,
        overlapCount: result.overlapCount,
        wallCount: result.wallCount,
        stairCount: result.stairCount,
        totalArea: result.totalArea
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
    console.log(`🎯 ServerSceneryGenerator: Getting current floor from ${serverAddress}`);
    try {
      // Get the player's current status from the API
      const currentStatusResponse = await DungeonApi.getCurrentStatus(serverAddress);
      
      if (currentStatusResponse.success && currentStatusResponse.data.currentFloor) {
        console.log(`✅ Using player's current floor: ${currentStatusResponse.data.currentFloor}`);
        return currentStatusResponse.data.currentFloor;
      } else {
        console.warn(`⚠️ Failed to get current floor from API, using default spawn location`);
        return "A"; // Default to root node
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'PLAYER_NOT_ALIVE') {
        console.log(`🎯 Player not alive, using default spawn location`);
        return "A"; // Default to root node for new players
      }
      console.error(`❌ Error getting current status from API:`, error);
      console.log(`🎯 Falling back to default spawn location`);
      return "A"; // Default to root node as fallback
    }
  }

  /**
   * Notify server that player moved to a new floor
   */
  static async notifyPlayerMovedFloor(serverAddress: string, newFloorName: string): Promise<void> {
    console.log(`📡 ServerSceneryGenerator: Notifying server of floor change to ${newFloorName}`);
    try {
      await DungeonApi.notifyPlayerMovedFloor(serverAddress, newFloorName);
      console.log(`✅ Successfully notified server of floor change to ${newFloorName}`);
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
    
    console.log(`🧹 Clearing ${objectsToRemove.length} scenery objects`);
    console.log(`🛡️ Preserving ${objectsToPreserve.length} objects: ${objectsToPreserve.slice(0, 5).join(', ')}${objectsToPreserve.length > 5 ? '...' : ''}`);
    
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
    
    console.log(`✅ After cleanup: ${playerCount} current players, ${otherPlayerCount} other players preserved`);
  }

  /**
   * Debug method to log all objects in the scene
   */
  static debugSceneObjects(scene: THREE.Scene): void {
    console.log(`🔍 Scene Debug - Total objects: ${scene.children.length}`);
    
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
    console.log(`👥 Player objects found:`, playerObjects);
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
    
    console.log(`🧹 Safely clearing ${objectsToRemove.length} scenery objects only`);
    
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
    console.log(`🔍 Player Visibility Debug`);
    console.log(`Browser: ${navigator.userAgent}`);
    
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
    
    console.log(`📊 Summary: ${currentPlayers} current players, ${otherPlayers} other players, ${allPlayers} total player-like objects`);
    
    if (currentPlayers === 0) {
      console.error(`❌ No current player found! This indicates the player model was accidentally removed.`);
      console.log(`💡 Try calling ServerSceneryGenerator.debugSceneObjects(scene) to see all objects`);
    }
  }
}