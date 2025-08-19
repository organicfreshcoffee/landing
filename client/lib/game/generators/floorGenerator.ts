import * as THREE from 'three';
import { DungeonApi } from '../network/dungeonApi';
import { 
  DungeonNode, 
  FloorLayoutResponse,
  GeneratedFloorResponse,
  ServerGeneratedFloorData
} from '../types/api';
import {
  ServerRoom,
  ServerHallway,
  ServerFloorLayout
} from '../types/generator';

export interface DungeonDagData {
  dungeonDagNodeName: string;
  nodes: DungeonNode[];
}

/**
 * FloorGenerator - Now primarily a data fetcher and converter
 * 
 * Since floor generation is now handled server-side, this class focuses on:
 * 1. Fetching server-generated floor data
 * 2. Converting server data to client format
 * 3. Providing fallback mechanisms
 * 4. Utility functions for working with floor data
 */
export class FloorGenerator {
  /**
   * Fetches floor layout from server using new generated floor endpoint
   */
  static async getFloorLayout(serverAddress: string, dungeonDagNodeName: string): Promise<ServerFloorLayout> {
    try {
      // First try the new server-side generated floor endpoint
      const response = await DungeonApi.getGeneratedFloor(serverAddress, dungeonDagNodeName);
      
      if (!response.success) {
        throw new Error('Failed to get generated floor layout from server');
      }

      return this.convertServerGeneratedData(response.data);
    } catch (error) {
      console.error('Error fetching generated floor layout:', error);
      console.log('🔄 Falling back to legacy DAG-based generation...');
      
      try {
        // Fall back to legacy endpoint and client-side generation
        const legacyResponse = await DungeonApi.getFloorLayout(serverAddress, dungeonDagNodeName);
        
        if (!legacyResponse.success) {
          throw new Error('Failed to get legacy floor layout from server');
        }

        return this.processServerResponse(legacyResponse.data);
      } catch (legacyError) {
        console.error('Legacy generation also failed:', legacyError);
        console.log('🔄 Falling back to sample data for development...');
        
        // Last resort: use sample data
        return this.getSampleFloorLayout(dungeonDagNodeName);
      }
    }
  }

  /**
   * Convert server-generated floor data to client format
   */
  static convertServerGeneratedData(data: ServerGeneratedFloorData): ServerFloorLayout {
    console.log(`🏗️ Converting server-generated floor data for ${data.dungeonDagNodeName}`);
    
    // Convert rooms
    const rooms: ServerRoom[] = data.rooms.map(room => ({
      id: room.id,
      name: room.name,
      position: new THREE.Vector2(room.position.x, room.position.y),
      width: room.width,
      height: room.height,
      hasUpwardStair: room.hasUpwardStair,
      hasDownwardStair: room.hasDownwardStair,
      stairLocationX: room.stairLocationX,
      stairLocationY: room.stairLocationY,
      children: room.children,
      parentDirection: room.parentDirection as "left" | "right" | "center" | undefined,
      parentDoorOffset: room.parentDoorOffset,
      doorPosition: new THREE.Vector2(room.doorPosition.x, room.doorPosition.y),
      doorSide: room.doorSide as "top" | "right" | "bottom" | "left"
    }));

    // Convert hallways
    const hallways: ServerHallway[] = data.hallways.map(hallway => ({
      id: hallway.id,
      name: hallway.name,
      length: hallway.length,
      parentDirection: hallway.parentDirection as "left" | "right" | "center" | undefined,
      parentDoorOffset: hallway.parentDoorOffset,
      children: hallway.children,
      startPosition: new THREE.Vector2(hallway.startPosition.x, hallway.startPosition.y),
      endPosition: new THREE.Vector2(hallway.endPosition.x, hallway.endPosition.y),
      direction: new THREE.Vector2(hallway.direction.x, hallway.direction.y),
      segments: hallway.segments.map(segment => ({
        start: new THREE.Vector2(segment.start.x, segment.start.y),
        end: new THREE.Vector2(segment.end.x, segment.end.y),
        direction: new THREE.Vector2(segment.direction.x, segment.direction.y),
        length: segment.length
      }))
    }));

    // Create node map for lookups
    const nodeMap = new Map<string, ServerRoom | ServerHallway>();
    rooms.forEach(room => nodeMap.set(room.name, room));
    hallways.forEach(hallway => nodeMap.set(hallway.name, hallway));

    console.log(`✅ Converted ${rooms.length} rooms and ${hallways.length} hallways from server data`);

    return {
      dungeonDagNodeName: data.dungeonDagNodeName,
      rooms,
      hallways,
      bounds: data.bounds,
      nodeMap,
      rootNode: data.rootNode,
      // Store the server's pre-calculated tiles for efficient rendering
      serverFloorTiles: data.floorTiles,
      serverRoomTiles: data.roomTiles,
      serverHallwayTiles: data.hallwayTiles
    };
  }

  /**
   * Check if the layout has server-generated tiles
   */
  static hasServerTiles(layout: ServerFloorLayout): boolean {
    return !!(layout.serverFloorTiles && layout.serverFloorTiles.length > 0);
  }

  /**
   * Get all floor tiles from the layout (either server-generated or client-generated)
   */
  static getAllFloorTiles(layout: ServerFloorLayout): Array<{ x: number; y: number }> {
    // Use server tiles if available
    if (layout.serverFloorTiles && layout.serverFloorTiles.length > 0) {
      console.log(`🚀 Using ${layout.serverFloorTiles.length} server-generated floor tiles`);
      return layout.serverFloorTiles;
    }

    // Fall back to generating tiles from rooms and hallways (legacy behavior)
    console.log(`⚙️ Generating floor tiles from ${layout.rooms.length} rooms and ${layout.hallways.length} hallways`);
    const tiles: Array<{ x: number; y: number }> = [];
    
    // Add room tiles
    layout.rooms.forEach(room => {
      for (let x = 0; x < room.width; x++) {
        for (let y = 0; y < room.height; y++) {
          tiles.push({
            x: room.position.x + x,
            y: room.position.y + y
          });
        }
      }
    });

    // Add hallway tiles (simplified generation)
    layout.hallways.forEach(hallway => {
      if (hallway.segments) {
        hallway.segments.forEach(segment => {
          const dx = segment.end.x - segment.start.x;
          const dy = segment.end.y - segment.start.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const steps = Math.max(1, Math.ceil(length));
          
          for (let i = 0; i < steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = Math.round(segment.start.x + (dx * t));
            const y = Math.round(segment.start.y + (dy * t));
            tiles.push({ x, y });
          }
        });
      }
    });

    // Remove duplicates
    const uniqueTiles = new Map<string, { x: number; y: number }>();
    tiles.forEach(tile => {
      const key = `${tile.x},${tile.y}`;
      uniqueTiles.set(key, tile);
    });

    return Array.from(uniqueTiles.values());
  }

  /**
   * Get sample floor layout for development/testing (LEGACY FALLBACK)
   */
  static async getSampleFloorLayout(dungeonDagNodeName: string): Promise<ServerFloorLayout> {
    console.log(`📋 Using sample DAG data for ${dungeonDagNodeName}`);
    
    // Minimal sample data for testing
    const sampleData: DungeonDagData = {
      "dungeonDagNodeName": dungeonDagNodeName,
      "nodes": [
        {
          "_id": "sample_root",
          "name": "A_A",
          "dungeonDagNodeName": dungeonDagNodeName,
          "children": ["A_AA"],
          "isRoom": true,
          "hasUpwardStair": true,
          "hasDownwardStair": false,
          "roomWidth": 10,
          "roomHeight": 10
        },
        {
          "_id": "sample_hallway",
          "name": "A_AA",
          "dungeonDagNodeName": dungeonDagNodeName,
          "children": [],
          "isRoom": false,
          "hallwayLength": 15,
          "parentDirection": "right",
          "parentDoorOffset": 5
        }
      ]
    };
    
    return this.processServerResponse(sampleData);
  }

  /**
   * Process DAG data into positioned floor layout (LEGACY - for fallback only)
   * @deprecated This method is used only as fallback when server-side generation fails
   * Most of the complex positioning logic has been removed since it's now handled server-side
   */
  static processServerResponse(dagData: DungeonDagData): ServerFloorLayout {
    const { dungeonDagNodeName, nodes } = dagData;
    
    console.warn('⚠️ Using legacy client-side generation - this should only happen as fallback');
    
    // Create a minimal layout with basic positioning
    const rooms: ServerRoom[] = [];
    const hallways: ServerHallway[] = [];
    const nodeMap = new Map<string, ServerRoom | ServerHallway>();
    
    // Find root node
    const rootNode = nodes.find(node => 
      !nodes.some(other => other.children.includes(node.name))
    );
    
    if (!rootNode) {
      throw new Error('No root node found in DAG');
    }

    // Simple conversion with minimal positioning
    nodes.forEach((node, index) => {
      if (node.isRoom) {
        const room: ServerRoom = {
          id: node._id,
          name: node.name,
          position: new THREE.Vector2(index * 15, 0), // Simple horizontal layout
          width: node.roomWidth || 8,
          height: node.roomHeight || 8,
          hasUpwardStair: node.hasUpwardStair || false,
          hasDownwardStair: node.hasDownwardStair || false,
          stairLocationX: node.stairLocationX,
          stairLocationY: node.stairLocationY,
          children: node.children,
          parentDirection: node.parentDirection,
          parentDoorOffset: node.parentDoorOffset,
          doorPosition: new THREE.Vector2(0, 0), // Basic door position
          doorSide: "right"
        };
        rooms.push(room);
        nodeMap.set(node.name, room);
      } else {
        const hallway: ServerHallway = {
          id: node._id,
          name: node.name,
          length: node.hallwayLength || 10,
          parentDirection: node.parentDirection,
          parentDoorOffset: node.parentDoorOffset,
          children: node.children,
          startPosition: new THREE.Vector2(index * 15 - 5, 0),
          endPosition: new THREE.Vector2(index * 15, 0),
          direction: new THREE.Vector2(1, 0),
          segments: [{
            start: new THREE.Vector2(index * 15 - 5, 0),
            end: new THREE.Vector2(index * 15, 0),
            direction: new THREE.Vector2(1, 0),
            length: 5
          }]
        };
        hallways.push(hallway);
        nodeMap.set(node.name, hallway);
      }
    });

    // Calculate minimal bounds
    const bounds = { width: nodes.length * 15, height: 20 };
    
    console.log(`🏗️ Legacy generation: ${rooms.length} rooms, ${hallways.length} hallways`);
    
    return {
      dungeonDagNodeName,
      rooms,
      hallways,
      bounds,
      nodeMap,
      rootNode: rootNode.name
    };
  }
}
