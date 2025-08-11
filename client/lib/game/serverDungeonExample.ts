/**
 * Example usage of the new server-based dungeon system
 * 
 * This example shows how to:
 * 1. Get the spawn location from the server
 * 2. Load a floor layout from the server
 * 3. Generate and render the floor using server data
 * 4. Handle player movement between floors
 */

import { ServerSceneryGenerator, ServerFloorGenerator, DungeonApi } from './index';
import * as THREE from 'three';

/**
 * Example: Initialize a game scene with server-based dungeon data
 */
export async function initializeServerDungeon(scene: THREE.Scene, serverAddress: string): Promise<void> {
  try {
    // 1. Get the spawn location for new players
    console.log('Getting spawn location...');
    const spawnFloor = await ServerFloorGenerator.getSpawnLocation(serverAddress);
    console.log(`Player should spawn on floor: ${spawnFloor}`);

    // 2. Load the floor layout from server
    console.log(`Loading floor layout for: ${spawnFloor}`);
    const floorResult = await ServerSceneryGenerator.generateServerFloor(scene, serverAddress, spawnFloor, {
      cubeSize: 1,
      roomHeight: 5,
      hallwayHeight: 5,
      wallColor: 0xcccccc,
      floorColor: 0x666666,
      hallwayWallColor: 0x888888,
      hallwayFloorColor: 0x444444
    });

    console.log('Server dungeon initialized successfully!');
    console.log(`Floor contains ${floorResult.floorLayout.rooms.length} rooms`);
    console.log(`Generated ${floorResult.hallwayNetwork.segments.length} hallway segments`);

    // 3. Log room details
    floorResult.floorLayout.rooms.forEach((room, index) => {
      console.log(`Room ${index + 1}: ${room.name} at (${room.position.x}, ${room.position.y})`);
      if (room.hasUpwardStair) console.log(`  - Has upward stair at (${room.stairLocationX}, ${room.stairLocationY})`);
      if (room.hasDownwardStair) console.log(`  - Has downward stair at (${room.stairLocationX}, ${room.stairLocationY})`);
    });

  } catch (error) {
    console.error('Failed to initialize server dungeon:', error);
    throw error;
  }
}

/**
 * Example: Handle player moving to a new floor
 */
export async function handlePlayerFloorChange(
  scene: THREE.Scene, 
  serverAddress: string,
  newFloorName: string
): Promise<void> {
  try {
    console.log(`Player moving to floor: ${newFloorName}`);

    // 1. Notify server about the movement
    await ServerFloorGenerator.notifyPlayerMovedFloor(serverAddress, newFloorName);
    console.log('Server notified of player movement');

    // 2. Clear current scenery
    ServerSceneryGenerator.clearScene(scene);

    // 3. Load new floor
    const floorResult = await ServerSceneryGenerator.generateServerFloor(scene, serverAddress, newFloorName);
    console.log(`Successfully loaded new floor: ${newFloorName}`);
    console.log(`New floor has ${floorResult.floorLayout.rooms.length} rooms`);

  } catch (error) {
    console.error(`Failed to change to floor ${newFloorName}:`, error);
    throw error;
  }
}

/**
 * Example: Get stair information for a specific room
 */
export async function getStairInfo(serverAddress: string, roomNodeName: string): Promise<void> {
  try {
    console.log(`Getting stair info for room: ${roomNodeName}`);
    
    const stairInfo = await DungeonApi.getRoomStairs(serverAddress, roomNodeName);
    
    if (stairInfo.success) {
      if (stairInfo.data.upwardStair) {
        console.log('Upward stair found:', stairInfo.data.upwardStair);
      }
      if (stairInfo.data.downwardStair) {
        console.log('Downward stair found:', stairInfo.data.downwardStair);
      }
      if (!stairInfo.data.upwardStair && !stairInfo.data.downwardStair) {
        console.log('No stairs found in this room');
      }
    }
  } catch (error) {
    console.error(`Failed to get stair info for ${roomNodeName}:`, error);
  }
}

/**
 * Example: Integration with existing game manager
 */
export class ServerDungeonIntegration {
  private currentFloor: string | null = null;
  private scene: THREE.Scene;
  private serverAddress: string;

  constructor(scene: THREE.Scene, serverAddress: string) {
    this.scene = scene;
    this.serverAddress = serverAddress;
  }

  /**
   * Initialize the dungeon system
   */
  async initialize(): Promise<void> {
    // Get spawn location and load initial floor
    this.currentFloor = await ServerFloorGenerator.getSpawnLocation(this.serverAddress);
    await this.loadFloor(this.currentFloor);
  }

  /**
   * Load a specific floor
   */
  async loadFloor(floorName: string): Promise<void> {
    if (this.currentFloor !== floorName) {
      // Notify server if changing floors
      if (this.currentFloor) {
        await ServerFloorGenerator.notifyPlayerMovedFloor(this.serverAddress, floorName);
      }
      
      // Clear and load new floor
      ServerSceneryGenerator.clearScene(this.scene);
      await ServerSceneryGenerator.generateServerFloor(this.scene, this.serverAddress, floorName);
      this.currentFloor = floorName;
      
      console.log(`Current floor: ${this.currentFloor}`);
    }
  }

  /**
   * Get current floor name
   */
  getCurrentFloor(): string | null {
    return this.currentFloor;
  }

  /**
   * Handle player using stairs
   */
  async useStairs(roomNodeName: string, direction: 'up' | 'down'): Promise<void> {
    try {
      const stairInfo = await DungeonApi.getRoomStairs(this.serverAddress, roomNodeName);
      
      if (stairInfo.success) {
        let targetFloor: string | null = null;
        
        if (direction === 'up' && stairInfo.data.upwardStair) {
          targetFloor = stairInfo.data.upwardStair.dungeonDagNodeName;
        } else if (direction === 'down' && stairInfo.data.downwardStair) {
          targetFloor = stairInfo.data.downwardStair.dungeonDagNodeName;
        }
        
        if (targetFloor) {
          await this.loadFloor(targetFloor);
          console.log(`Moved ${direction} to floor: ${targetFloor}`);
        } else {
          console.log(`No ${direction}ward stair available in this room`);
        }
      }
    } catch (error) {
      console.error(`Failed to use ${direction}ward stairs:`, error);
    }
  }
}

/**
 * Usage Example:
 * 
 * // In your game initialization:
 * const scene = new THREE.Scene();
 * const serverAddress = 'https://your-game-server.com'; // From dashboard server selection
 * const dungeonSystem = new ServerDungeonIntegration(scene, serverAddress);
 * await dungeonSystem.initialize();
 * 
 * // When player uses stairs:
 * await dungeonSystem.useStairs('A_A', 'down');
 * 
 * // When you need current floor:
 * const currentFloor = dungeonSystem.getCurrentFloor();
 */
