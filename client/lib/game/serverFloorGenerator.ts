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
  parentDirection?: "left" | "right" | "center";
  parentDoorOffset?: number;
  // Door position calculated from parentDirection and parentDoorOffset
  doorPosition?: THREE.Vector2;
  doorSide?: "top" | "right" | "bottom" | "left";
}

export interface ServerHallway {
  id: string;
  name: string;
  length: number;
  parentDirection?: "left" | "right" | "center";
  children: string[];
  // Calculated fields for rendering
  startPosition?: THREE.Vector2;
  endPosition?: THREE.Vector2;
  direction?: THREE.Vector2; // normalized direction vector
  segments?: HallwaySegment[];
}

export interface HallwaySegment {
  start: THREE.Vector2;
  end: THREE.Vector2;
  direction: THREE.Vector2;
  length: number;
}

export interface ServerFloorLayout {
  dungeonDagNodeName: string;
  rooms: ServerRoom[];
  hallways: ServerHallway[];
  bounds: { width: number; height: number };
  // Hierarchy map for easy lookup
  nodeMap: Map<string, ServerRoom | ServerHallway>;
  rootNode: string;
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
    const nodeMap = new Map<string, ServerRoom | ServerHallway>();
    
    // Find root node (the one that's not in any children array)
    const childrenSet = new Set<string>();
    nodes.forEach(node => node.children.forEach(child => childrenSet.add(child)));
    const rootNode = nodes.find(node => !childrenSet.has(node.name))?.name || nodes[0]?.name;
    
    // Convert all nodes first
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
          children: node.children,
          parentDirection: node.parentDirection,
          parentDoorOffset: node.parentDoorOffset
        };
        rooms.push(room);
        nodeMap.set(node.name, room);
      } else {
        // Convert hallway data
        const hallway: ServerHallway = {
          id: node.name,
          name: node.name,
          length: node.hallwayLength || 8,
          parentDirection: node.parentDirection,
          children: node.children
        };
        hallways.push(hallway);
        nodeMap.set(node.name, hallway);
      }
    });

    // Calculate positions using hierarchy-based algorithm
    this.calculateHierarchicalLayout(nodeMap, rootNode);

    // Calculate floor bounds
    const bounds = this.calculateFloorBounds(rooms);

    return {
      dungeonDagNodeName,
      rooms,
      hallways,
      bounds,
      nodeMap,
      rootNode
    };
  }

  /**
   * Calculate positions for all nodes using hierarchy-based layout algorithm
   */
  private static calculateHierarchicalLayout(
    nodeMap: Map<string, ServerRoom | ServerHallway>, 
    rootNodeName: string
  ): void {
    // Start with root node at origin
    const rootNode = nodeMap.get(rootNodeName);
    if (!rootNode) return;

    if (this.isRoom(rootNode)) {
      rootNode.position.set(0, 0);
      this.calculateDoorPosition(rootNode);
    }

    // Track positioned nodes
    const positioned = new Set<string>([rootNodeName]);
    
    // Use breadth-first traversal to position all connected nodes
    const queue: Array<{
      nodeName: string; 
      parentNode: ServerRoom | ServerHallway;
      parentDirection: "left" | "right" | "center";
    }> = [];

    // Add root's children to queue
    rootNode.children.forEach(childName => {
      const childNode = nodeMap.get(childName);
      if (childNode) {
        queue.push({
          nodeName: childName,
          parentNode: rootNode,
          parentDirection: childNode.parentDirection || "center"
        });
      }
    });

    while (queue.length > 0) {
      const { nodeName, parentNode, parentDirection } = queue.shift()!;
      
      if (positioned.has(nodeName)) continue;
      
      const currentNode = nodeMap.get(nodeName);
      if (!currentNode) continue;

      // Position this node relative to its parent
      this.positionNodeRelativeToParent(currentNode, parentNode, parentDirection);
      positioned.add(nodeName);

      // Add this node's children to the queue
      currentNode.children.forEach(childName => {
        if (!positioned.has(childName)) {
          const childNode = nodeMap.get(childName);
          if (childNode) {
            queue.push({
              nodeName: childName,
              parentNode: currentNode,
              parentDirection: childNode.parentDirection || "center"
            });
          }
        }
      });
    }
  }

  /**
   * Position a node relative to its parent based on parentDirection
   */
  private static positionNodeRelativeToParent(
    node: ServerRoom | ServerHallway,
    parentNode: ServerRoom | ServerHallway,
    direction: "left" | "right" | "center"
  ): void {
    const SPACING = 25; // Base spacing between nodes
    
    if (this.isRoom(parentNode)) {
      // Parent is a room - position child from room edge
      this.positionFromRoom(node, parentNode, direction, SPACING);
    } else {
      // Parent is a hallway - position child from hallway end
      this.positionFromHallway(node, parentNode, direction, SPACING);
    }

    // Calculate door position for rooms
    if (this.isRoom(node)) {
      this.calculateDoorPosition(node as ServerRoom);
    }
  }

  /**
   * Position a node from a room's edge
   */
  private static positionFromRoom(
    node: ServerRoom | ServerHallway,
    parentRoom: ServerRoom,
    direction: "left" | "right" | "center",
    spacing: number
  ): void {
    const roomWidth = parentRoom.width;
    const roomHeight = parentRoom.height;
    let offsetX = 0;
    let offsetY = 0;

    // Determine exit side based on number of children and direction
    const childIndex = parentRoom.children.indexOf(node.id);
    const totalChildren = parentRoom.children.length;
    
    if (totalChildren === 1) {
      // Single child - use direction to determine side
      switch (direction) {
        case "left":
          offsetX = -(roomWidth / 2 + spacing);
          break;
        case "right":
          offsetX = roomWidth / 2 + spacing;
          break;
        case "center":
        default:
          offsetY = roomHeight / 2 + spacing; // exit from top
          break;
      }
    } else {
      // Multiple children - distribute around room
      const angleStep = (Math.PI * 2) / totalChildren;
      const angle = childIndex * angleStep;
      const radius = Math.max(roomWidth, roomHeight) / 2 + spacing;
      
      offsetX = Math.cos(angle) * radius;
      offsetY = Math.sin(angle) * radius;
    }

    if (this.isRoom(node)) {
      node.position.set(
        parentRoom.position.x + offsetX,
        parentRoom.position.y + offsetY
      );
    } else {
      // For hallways, set start position and calculate segments
      const hallway = node as ServerHallway;
      hallway.startPosition = new THREE.Vector2(
        parentRoom.position.x + offsetX / 2, // Start closer to room
        parentRoom.position.y + offsetY / 2
      );
      
      hallway.endPosition = new THREE.Vector2(
        parentRoom.position.x + offsetX,
        parentRoom.position.y + offsetY
      );
      
      this.calculateHallwaySegments(hallway);
    }
  }

  /**
   * Position a node from a hallway's end
   */
  private static positionFromHallway(
    node: ServerRoom | ServerHallway,
    parentHallway: ServerHallway,
    direction: "left" | "right" | "center",
    spacing: number
  ): void {
    if (!parentHallway.endPosition || !parentHallway.direction) return;

    const hallwayEnd = parentHallway.endPosition;
    const hallwayDir = parentHallway.direction;
    
    let newDirection = hallwayDir.clone();
    
    // Apply turn based on parentDirection
    switch (direction) {
      case "left":
        // Turn 90 degrees left
        newDirection = new THREE.Vector2(-hallwayDir.y, hallwayDir.x);
        break;
      case "right":
        // Turn 90 degrees right
        newDirection = new THREE.Vector2(hallwayDir.y, -hallwayDir.x);
        break;
      case "center":
      default:
        // Continue straight
        break;
    }

    if (this.isRoom(node)) {
      node.position.set(
        hallwayEnd.x + newDirection.x * spacing,
        hallwayEnd.y + newDirection.y * spacing
      );
    } else {
      // For hallways connecting to hallways
      const hallway = node as ServerHallway;
      hallway.startPosition = hallwayEnd.clone();
      hallway.endPosition = new THREE.Vector2(
        hallwayEnd.x + newDirection.x * hallway.length,
        hallwayEnd.y + newDirection.y * hallway.length
      );
      hallway.direction = newDirection;
      
      this.calculateHallwaySegments(hallway);
    }
  }

  /**
   * Calculate door position for a room based on parentDirection and parentDoorOffset
   */
  private static calculateDoorPosition(room: ServerRoom): void {
    if (!room.parentDoorOffset) return;

    const { width, height, parentDirection, parentDoorOffset } = room;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Determine which side of the room the door should be on
    // This depends on where the connection to parent comes from
    let doorSide: "top" | "right" | "bottom" | "left" = "bottom";
    let doorPosition = new THREE.Vector2();

    // For now, place door on bottom side and use parentDoorOffset
    const offset = Math.min(parentDoorOffset, Math.min(width, height) - 1);
    doorPosition = new THREE.Vector2(
      room.position.x - halfWidth + offset,
      room.position.y - halfHeight
    );

    room.doorPosition = doorPosition;
    room.doorSide = doorSide;
  }

  /**
   * Calculate hallway segments for rendering
   */
  private static calculateHallwaySegments(hallway: ServerHallway): void {
    if (!hallway.startPosition || !hallway.endPosition) return;

    // For now, create a simple straight line segment
    // This can be enhanced later to handle more complex paths
    const segment: HallwaySegment = {
      start: hallway.startPosition,
      end: hallway.endPosition,
      direction: hallway.endPosition.clone().sub(hallway.startPosition).normalize(),
      length: hallway.startPosition.distanceTo(hallway.endPosition)
    };

    hallway.segments = [segment];
    hallway.direction = segment.direction;
  }

  /**
   * Type guard to check if a node is a room
   */
  private static isRoom(node: ServerRoom | ServerHallway): node is ServerRoom {
    return 'width' in node && 'height' in node;
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
