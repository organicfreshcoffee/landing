import * as THREE from 'three';
import { DungeonApi, DungeonNode, FloorLayoutResponse } from './dungeonApi';

// Updated interfaces to match server data structure
export interface ServerRoom {
  id: string;
  name: string;
  position: THREE.Vector2;
  width: number;
  height: number;
  hasUpwardStair: boolean;
  hasDownwardStair: boolean;
  stairLocationX?: number;
  stairLocationY?: number;
  children: string[];
}

export interface ServerHallway {
  id: string;
  name: string;
  length: number;
  // Note: Server provides length, client will need to calculate positions
  // based on room connections
}

export interface ServerFloorLayout {
  dungeonDagNodeName: string;
  rooms: ServerRoom[];
  hallways: ServerHallway[];
  bounds: { width: number; height: number };
}

export class ServerFloorGenerator {
  /**
   * Fetches floor layout from server and converts to client format
   */
  static async getFloorLayout(serverAddress: string, dungeonDagNodeName: string): Promise<ServerFloorLayout> {
    try {
      const response = await DungeonApi.getFloorLayout(serverAddress, dungeonDagNodeName);
      
      if (!response.success) {
        throw new Error('Failed to get floor layout from server');
      }

      return this.convertServerDataToClientFormat(response);
    } catch (error) {
      console.error('Error fetching floor layout:', error);
      throw error;
    }
  }

  /**
   * Converts server response data to client-compatible format
   */
  private static convertServerDataToClientFormat(response: FloorLayoutResponse): ServerFloorLayout {
    const { dungeonDagNodeName, nodes } = response.data;
    
    const rooms: ServerRoom[] = [];
    const hallways: ServerHallway[] = [];
    
    // Separate rooms and hallways
    nodes.forEach((node: DungeonNode) => {
      if (node.isRoom) {
        // Convert room data
        const room: ServerRoom = {
          id: node.name,
          name: node.name,
          position: new THREE.Vector2(0, 0), // Position will be calculated later
          width: node.roomWidth || 10,
          height: node.roomHeight || 10,
          hasUpwardStair: node.hasUpwardStair || false,
          hasDownwardStair: node.hasDownwardStair || false,
          stairLocationX: node.stairLocationX,
          stairLocationY: node.stairLocationY,
          children: node.children
        };
        rooms.push(room);
      } else {
        // Convert hallway data
        const hallway: ServerHallway = {
          id: node.name,
          name: node.name,
          length: node.hallwayLength || 8
        };
        hallways.push(hallway);
      }
    });

    // Calculate room positions based on layout algorithm
    this.calculateRoomPositions(rooms, hallways);

    // Calculate floor bounds
    const bounds = this.calculateFloorBounds(rooms);

    return {
      dungeonDagNodeName,
      rooms,
      hallways,
      bounds
    };
  }

  /**
   * Calculate positions for rooms based on their connections
   * This is a simplified layout algorithm - can be enhanced
   */
  private static calculateRoomPositions(rooms: ServerRoom[], hallways: ServerHallway[]): void {
    if (rooms.length === 0) return;

    // Start with the first room at origin
    rooms[0].position.set(0, 0);
    const positioned = new Set<string>([rooms[0].id]);
    
    // Use a simple grid-based layout for now
    const gridSize = Math.ceil(Math.sqrt(rooms.length));
    const cellSize = 30; // Base spacing between rooms
    
    let currentRow = 0;
    let currentCol = 1;
    
    for (let i = 1; i < rooms.length; i++) {
      const room = rooms[i];
      
      // Calculate grid position
      if (currentCol >= gridSize) {
        currentCol = 0;
        currentRow++;
      }
      
      const x = currentCol * cellSize;
      const y = currentRow * cellSize;
      
      room.position.set(x, y);
      currentCol++;
    }
  }

  /**
   * Calculate the bounds of the floor based on room positions
   */
  private static calculateFloorBounds(rooms: ServerRoom[]): { width: number; height: number } {
    if (rooms.length === 0) {
      return { width: 100, height: 100 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    rooms.forEach(room => {
      const halfWidth = room.width / 2;
      const halfHeight = room.height / 2;
      
      minX = Math.min(minX, room.position.x - halfWidth);
      maxX = Math.max(maxX, room.position.x + halfWidth);
      minY = Math.min(minY, room.position.y - halfHeight);
      maxY = Math.max(maxY, room.position.y + halfHeight);
    });

    const padding = 20; // Add some padding around rooms
    return {
      width: (maxX - minX) + padding * 2,
      height: (maxY - minY) + padding * 2
    };
  }

  /**
   * Get spawn location from server
   */
  static async getSpawnLocation(serverAddress: string): Promise<string> {
    try {
      console.log(`🎲 ServerFloorGenerator: Getting spawn location from ${serverAddress}`);
      const response = await DungeonApi.getSpawnLocation(serverAddress);
      
      if (!response.success) {
        throw new Error('Failed to get spawn location from server');
      }

      console.log(`🎯 ServerFloorGenerator: Spawn location is ${response.data.dungeonDagNodeName}`);
      return response.data.dungeonDagNodeName;
    } catch (error) {
      console.error('❌ Error fetching spawn location:', error);
      throw error;
    }
  }

  /**
   * Notify server that player moved to a new floor
   */
  static async notifyPlayerMovedFloor(serverAddress: string, newFloorName: string): Promise<void> {
    try {
      const response = await DungeonApi.notifyPlayerMovedFloor(serverAddress, newFloorName);
      
      if (!response.success) {
        throw new Error(`Failed to notify server: ${response.message}`);
      }
      
      console.log('Player movement notification sent:', response.message);
    } catch (error) {
      console.error('Error notifying player movement:', error);
      throw error;
    }
  }
}
