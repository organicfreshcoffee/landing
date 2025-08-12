import * as THREE from 'three';
import { DungeonApi } from '../network/dungeonApi';
import { 
  DungeonNode, 
  FloorLayoutResponse 
} from '../types/api';
import {
  ServerRoom,
  ServerHallway,
  FloorHallwaySegment,
  ServerFloorLayout
} from '../types/generator';

export interface DungeonDagData {
  dungeonDagNodeName: string;
  nodes: DungeonNode[];
}

export class FloorGenerator {
  /**
   * Fetches floor layout from server and converts to client format
   */
  static async getFloorLayout(serverAddress: string, dungeonDagNodeName: string): Promise<ServerFloorLayout> {
    try {
      const response = await DungeonApi.getFloorLayout(serverAddress, dungeonDagNodeName);
      
      if (!response.success) {
        throw new Error('Failed to get floor layout from server');
      }

      return this.processServerResponse(response.data);
    } catch (error) {
      console.error('Error fetching floor layout:', error);
      console.log('🔄 Falling back to sample data for development...');
      
      // Fall back to sample data if server is not available
      return this.getSampleFloorLayout(dungeonDagNodeName);
    }
  }

  /**
   * Get sample floor layout for development/testing
   */
  static async getSampleFloorLayout(dungeonDagNodeName: string): Promise<ServerFloorLayout> {
    console.log(`📋 Using sample DAG data for ${dungeonDagNodeName}`);
    
    // Import the sample data from the example
    const sampleData: DungeonDagData = {
      "dungeonDagNodeName": dungeonDagNodeName,
      "nodes": [
        {
          "_id": "689a5c3269c66969a4da16fe",
          "name": "A_A",
          "dungeonDagNodeName": dungeonDagNodeName,
          "children": ["A_AA", "A_AB"],
          "isRoom": true,
          "hasUpwardStair": true,
          "hasDownwardStair": false,
          "roomWidth": 16,
          "roomHeight": 14
        },
        {
          "_id": "689a5c3269c66969a4da16ff",
          "name": "A_AA",
          "dungeonDagNodeName": dungeonDagNodeName,
          "children": ["A_AAA"],
          "isRoom": false,
          "hallwayLength": 28,
          "parentDirection": "center",
          "parentDoorOffset": 1
        },
        {
          "_id": "689a5c3269c66969a4da1700",
          "name": "A_AB",
          "dungeonDagNodeName": dungeonDagNodeName,
          "children": [],
          "isRoom": false,
          "hallwayLength": 21,
          "parentDirection": "right",
          "parentDoorOffset": 8
        },
        {
          "_id": "689a5c3269c66969a4da1701",
          "name": "A_AAA",
          "dungeonDagNodeName": dungeonDagNodeName,
          "children": ["A_AAAA", "A_AAAB"],
          "isRoom": true,
          "hasUpwardStair": false,
          "hasDownwardStair": true,
          "roomWidth": 8,
          "roomHeight": 20,
          "parentDoorOffset": 3,
          "parentDirection": "center",
          "stairLocationX": 0,
          "stairLocationY": 8
        },
        {
          "_id": "689a5c3269c66969a4da1702",
          "name": "A_AAAA",
          "dungeonDagNodeName": dungeonDagNodeName,
          "children": ["A_AAAAA"],
          "isRoom": false,
          "hallwayLength": 29,
          "parentDirection": "left",
          "parentDoorOffset": 6
        },
        {
          "_id": "689a5c3269c66969a4da1703",
          "name": "A_AAAB",
          "dungeonDagNodeName": dungeonDagNodeName,
          "children": [],
          "isRoom": false,
          "hallwayLength": 29,
          "parentDirection": "right",
          "parentDoorOffset": 4
        }
        // Add a few more nodes for a good test case
      ]
    };
    
    return this.processServerResponse(sampleData);
  }

  /**
   * Process DAG data into positioned floor layout
   */
  static processServerResponse(dagData: DungeonDagData): ServerFloorLayout {
    const { dungeonDagNodeName, nodes } = dagData;
    
    // Create maps for quick lookup
    const nodeMap = new Map<string, DungeonNode>();
    const processedNodes = new Map<string, ServerRoom | ServerHallway>();
    
    nodes.forEach(node => nodeMap.set(node.name, node));
    
    // Find root node (no parent references it)
    const rootNode = nodes.find(node => 
      !nodes.some(other => other.children.includes(node.name))
    );
    
    if (!rootNode) {
      throw new Error('No root node found in DAG');
    }

    console.log(`🌳 Processing DAG with root: ${rootNode.name}`);
    
    // Start positioning from root room at origin
    this.processNode(rootNode, nodeMap, processedNodes, new THREE.Vector2(0, 0), 'north');
    
    // Separate rooms and hallways
    const rooms: ServerRoom[] = [];
    const hallways: ServerHallway[] = [];
    
    processedNodes.forEach(node => {
      if ('width' in node) {
        rooms.push(node as ServerRoom);
      } else {
        hallways.push(node as ServerHallway);
      }
    });

    // Calculate bounds
    const bounds = this.calculateBounds(rooms, hallways);
    
    console.log(`🏗️ Generated layout: ${rooms.length} rooms, ${hallways.length} hallways`);
    
    return {
      dungeonDagNodeName,
      rooms,
      hallways,
      bounds,
      nodeMap: processedNodes,
      rootNode: rootNode.name
    };
  }

  /**
   * Recursively process nodes and calculate positions
   */
  private static processNode(
    node: DungeonNode,
    nodeMap: Map<string, DungeonNode>,
    processedNodes: Map<string, ServerRoom | ServerHallway>,
    position: THREE.Vector2,
    entrance: 'north' | 'south' | 'east' | 'west'
  ): void {
    if (processedNodes.has(node.name)) {
      return; // Already processed
    }

    if (node.isRoom) {
      const room: ServerRoom = {
        id: node._id,
        name: node.name,
        position: position.clone(),
        width: node.roomWidth!,
        height: node.roomHeight!,
        hasUpwardStair: node.hasUpwardStair || false,
        hasDownwardStair: node.hasDownwardStair || false,
        stairLocationX: node.stairLocationX,
        stairLocationY: node.stairLocationY,
        children: node.children,
        parentDirection: node.parentDirection,
        parentDoorOffset: node.parentDoorOffset
      };

      // Calculate door position and side based on entrance direction
      this.calculateRoomDoor(room, entrance);
      
      processedNodes.set(node.name, room);
      
      // Process children from this room
      node.children.forEach(childName => {
        const childNode = nodeMap.get(childName);
        if (childNode) {
          const { childPosition, childEntrance } = this.calculateChildPosition(
            childNode, room, entrance
          );
          this.processNode(childNode, nodeMap, processedNodes, childPosition, childEntrance);
        }
      });
      
    } else {
      // Hallway node
      const hallway: ServerHallway = {
        id: node._id,
        name: node.name,
        length: node.hallwayLength!,
        parentDirection: node.parentDirection,
        parentDoorOffset: node.parentDoorOffset,
        children: node.children
      };

      // Calculate hallway path based on parent direction and entrance
      this.calculateHallwayPath(hallway, position, entrance);
      
      processedNodes.set(node.name, hallway);
      
      // Process children from end of hallway
      node.children.forEach(childName => {
        const childNode = nodeMap.get(childName);
        if (childNode) {
          const childEntrance = this.getOppositeDirection(hallway.direction!);
          this.processNode(childNode, nodeMap, processedNodes, hallway.endPosition!, childEntrance);
        }
      });
    }
  }

  /**
   * Calculate door position for a room based on entrance direction
   */
  private static calculateRoomDoor(room: ServerRoom, entrance: 'north' | 'south' | 'east' | 'west'): void {
    const { width, height, position } = room;
    
    // Map cardinal directions to door sides
    const doorSideMap = {
      'north': 'top' as const,
      'south': 'bottom' as const,
      'east': 'right' as const,
      'west': 'left' as const
    };
    
    room.doorSide = doorSideMap[entrance];
    
    switch (entrance) {
      case 'north': // Door on north wall (top)
        room.doorPosition = new THREE.Vector2(
          position.x + Math.floor(width / 2),
          position.y + height - 1
        );
        break;
      case 'south': // Door on south wall (bottom) 
        room.doorPosition = new THREE.Vector2(
          position.x + Math.floor(width / 2),
          position.y
        );
        break;
      case 'east': // Door on east wall (right)
        room.doorPosition = new THREE.Vector2(
          position.x + width - 1,
          position.y + Math.floor(height / 2)
        );
        break;
      case 'west': // Door on west wall (left)
        room.doorPosition = new THREE.Vector2(
          position.x,
          position.y + Math.floor(height / 2)
        );
        break;
    }
  }

    /**
   * Calculate the position for a child node relative to its parent
   */
  private static calculateChildPosition(
    childNode: DungeonDagNode,
    parentRoom: { position: THREE.Vector2; width: number; height: number },
    parentEntrance: 'north' | 'south' | 'east' | 'west'
  ): { childPosition: THREE.Vector2; childEntrance: 'north' | 'south' | 'east' | 'west' } {
    const { position, width, height } = parentRoom;
    const direction = childNode.parentDirection!;
    const offset = childNode.parentDoorOffset || 0;
    
    // Determine which side of the room based on entrance and relative direction
    let childEntrance: 'north' | 'south' | 'east' | 'west';
    let childPosition: THREE.Vector2;
    
    // Calculate absolute direction from relative direction
    const absoluteDirection = this.getAbsoluteDirection(parentEntrance, direction);
    
    // Add a minimal gap to prevent most overlaps but maintain connectivity
    const gap = 0;
    
    switch (absoluteDirection) {
      case 'north': // Child extends north from parent
        childEntrance = 'south';
        childPosition = new THREE.Vector2(
          position.x + offset,
          position.y + height + gap
        );
        break;
      case 'south': // Child extends south from parent
        childEntrance = 'north';
        childPosition = new THREE.Vector2(
          position.x + offset,
          position.y - (childNode.isRoom ? childNode.roomHeight! : 1) - gap
        );
        break;
      case 'east': // Child extends east from parent
        childEntrance = 'west';
        childPosition = new THREE.Vector2(
          position.x + width + gap,
          position.y + offset
        );
        break;
      case 'west': // Child extends west from parent
        childEntrance = 'east';
        childPosition = new THREE.Vector2(
          position.x - (childNode.isRoom ? childNode.roomWidth! : 1) - gap,
          position.y + offset
        );
        break;
    }
    
    return { childPosition, childEntrance };
  }

  /**
   * Calculate hallway path from start position
   */
  private static calculateHallwayPath(
    hallway: ServerHallway,
    startPosition: THREE.Vector2,
    entrance: 'north' | 'south' | 'east' | 'west'
  ): void {
    hallway.startPosition = startPosition.clone();
    
    // Direction vector based on parent direction
    let direction: THREE.Vector2;
    
    if (hallway.parentDirection) {
      // For hallways with a parent direction, we want to extend away from the parent
      // The entrance tells us which side of the parent we're on
      // We should extend in the opposite direction to go away from parent
      const awayDirection = this.getOppositeDirectionString(entrance);
      direction = this.getDirectionVector(awayDirection);
    } else {
      // Continue straight in the entrance direction
      direction = this.getDirectionVector(entrance);
    }
    
    hallway.direction = direction;
    hallway.endPosition = new THREE.Vector2(
      startPosition.x + direction.x * hallway.length,
      startPosition.y + direction.y * hallway.length
    );
    
    // Create segments for rendering
    hallway.segments = [{
      start: hallway.startPosition.clone(),
      end: hallway.endPosition.clone(),
      direction: direction.clone(),
      length: hallway.length
    }];
  }

  /**
   * Convert relative direction to absolute direction
   */
  private static getAbsoluteDirection(
    currentDirection: 'north' | 'south' | 'east' | 'west',
    relativeDirection: 'left' | 'right' | 'center'
  ): 'north' | 'south' | 'east' | 'west' {
    const rotationMap: Record<string, Record<string, 'north' | 'south' | 'east' | 'west'>> = {
      'north': { left: 'west', right: 'east', center: 'north' },
      'south': { left: 'east', right: 'west', center: 'south' },
      'east': { left: 'north', right: 'south', center: 'east' },
      'west': { left: 'south', right: 'north', center: 'west' }
    };
    
    return rotationMap[currentDirection][relativeDirection];
  }

  /**
   * Get direction vector for cardinal direction
   */
  private static getDirectionVector(direction: 'north' | 'south' | 'east' | 'west'): THREE.Vector2 {
    switch (direction) {
      case 'north': return new THREE.Vector2(0, 1);
      case 'south': return new THREE.Vector2(0, -1);
      case 'east': return new THREE.Vector2(1, 0);
      case 'west': return new THREE.Vector2(-1, 0);
    }
  }

  /**
   * Get opposite direction from string
   */
  private static getOppositeDirectionString(direction: 'north' | 'south' | 'east' | 'west'): 'north' | 'south' | 'east' | 'west' {
    switch (direction) {
      case 'north': return 'south';
      case 'south': return 'north';
      case 'east': return 'west';
      case 'west': return 'east';
    }
  }

  /**
   * Get opposite direction
   */
  private static getOppositeDirection(direction: THREE.Vector2): 'north' | 'south' | 'east' | 'west' {
    if (direction.x === 0 && direction.y === 1) return 'south';
    if (direction.x === 0 && direction.y === -1) return 'north';
    if (direction.x === 1 && direction.y === 0) return 'west';
    if (direction.x === -1 && direction.y === 0) return 'east';
    return 'north'; // fallback
  }

  /**
   * Create a bridge connection between a parent room and child to fill gaps
   */
  private static createBridgeConnection(
    parent: { position: THREE.Vector2; width: number; height: number },
    child: { position: THREE.Vector2; width: number; height: number },
    parentEntrance: 'north' | 'south' | 'east' | 'west',
    childEntrance: 'north' | 'south' | 'east' | 'west',
    bridgeName: string
  ): ServerHallway | null {
    // Determine connection points
    let startPoint: THREE.Vector2;
    let endPoint: THREE.Vector2;
    
    // Calculate connection points based on entrances
    switch (parentEntrance) {
      case 'north':
        startPoint = new THREE.Vector2(parent.position.x + parent.width / 2, parent.position.y + parent.height);
        break;
      case 'south':
        startPoint = new THREE.Vector2(parent.position.x + parent.width / 2, parent.position.y);
        break;
      case 'east':
        startPoint = new THREE.Vector2(parent.position.x + parent.width, parent.position.y + parent.height / 2);
        break;
      case 'west':
        startPoint = new THREE.Vector2(parent.position.x, parent.position.y + parent.height / 2);
        break;
    }
    
    switch (childEntrance) {
      case 'north':
        endPoint = new THREE.Vector2(child.position.x + child.width / 2, child.position.y + child.height);
        break;
      case 'south':
        endPoint = new THREE.Vector2(child.position.x + child.width / 2, child.position.y);
        break;
      case 'east':
        endPoint = new THREE.Vector2(child.position.x + child.width, child.position.y + child.height / 2);
        break;
      case 'west':
        endPoint = new THREE.Vector2(child.position.x, child.position.y + child.height / 2);
        break;
    }
    
    // Calculate distance to see if bridge is needed
    const distance = startPoint.distanceTo(endPoint);
    
    if (distance <= 1) {
      // No bridge needed, too close
      return null;
    }
    
    // Create bridge hallway
    const direction = new THREE.Vector2(endPoint.x - startPoint.x, endPoint.y - startPoint.y).normalize();
    
    const bridge: ServerHallway = {
      id: `bridge_${Date.now()}`,
      name: bridgeName,
      length: Math.ceil(distance),
      startPosition: startPoint,
      endPosition: endPoint,
      direction: direction,
      children: [], // Bridges don't have children
      segments: [{
        start: startPoint.clone(),
        end: endPoint.clone(),
        direction: direction.clone(),
        length: Math.ceil(distance)
      }]
    };
    
    return bridge;
  }

  /**
   * Calculate bounds of the entire floor
   */
  private static calculateBounds(rooms: ServerRoom[], hallways: ServerHallway[]): { width: number; height: number } {
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    
    // Check room bounds
    rooms.forEach(room => {
      minX = Math.min(minX, room.position.x);
      maxX = Math.max(maxX, room.position.x + room.width);
      minY = Math.min(minY, room.position.y);
      maxY = Math.max(maxY, room.position.y + room.height);
    });
    
    // Check hallway bounds
    hallways.forEach(hallway => {
      if (hallway.startPosition && hallway.endPosition) {
        minX = Math.min(minX, hallway.startPosition.x, hallway.endPosition.x);
        maxX = Math.max(maxX, hallway.startPosition.x, hallway.endPosition.x);
        minY = Math.min(minY, hallway.startPosition.y, hallway.endPosition.y);
        maxY = Math.max(maxY, hallway.startPosition.y, hallway.endPosition.y);
      }
    });
    
    return {
      width: maxX - minX,
      height: maxY - minY
    };
  }
}
