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
  parentDoorOffset?: number;
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
          parentDoorOffset: node.parentDoorOffset,
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
   * LIMITED TO 2 LEVELS: root + children + grandchildren only
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

    console.log(`🎯 2-Level hierarchy: Root node: ${rootNodeName}, children: ${rootNode.children.length}`);
    
    // Track positioned nodes
    const positioned = new Set<string>([rootNodeName]);
    
    // Use breadth-first traversal limited to 2 levels deep
    const queue: Array<{
      nodeName: string; 
      parentNode: ServerRoom | ServerHallway;
      parentDirection: "left" | "right" | "center";
      level: number; // Track depth level
    }> = [];

    // Add root's children to queue (level 1)
    rootNode.children.forEach(childName => {
      const childNode = nodeMap.get(childName);
      if (childNode) {
        queue.push({
          nodeName: childName,
          parentNode: rootNode,
          parentDirection: childNode.parentDirection || "center",
          level: 1
        });
      }
    });

    while (queue.length > 0) {
      const { nodeName, parentNode, parentDirection, level } = queue.shift()!;
      
      if (positioned.has(nodeName)) continue;
      
      const currentNode = nodeMap.get(nodeName);
      if (!currentNode) continue;

      console.log(`🎯 Positioning ${nodeName} (level ${level}) relative to ${parentNode.id} with direction ${parentDirection}`);

      // Position this node relative to its parent
      this.positionNodeRelativeToParent(currentNode, parentNode, parentDirection);
      positioned.add(nodeName);

      // Only add children if we're not at max depth (level 2 = grandchildren)
      if (level < 2) {
        currentNode.children.forEach(childName => {
          if (!positioned.has(childName)) {
            const childNode = nodeMap.get(childName);
            if (childNode) {
              queue.push({
                nodeName: childName,
                parentNode: currentNode,
                parentDirection: childNode.parentDirection || "center",
                level: level + 1
              });
            }
          }
        });
      } else {
        console.log(`🎯 Skipping children of ${nodeName} - reached max depth (level ${level})`);
      }
    }
    
    console.log(`🎯 Positioned ${positioned.size} nodes total (2 levels deep)`);
  }

  /**
   * Position a node relative to its parent based on parentDirection
   */
  private static positionNodeRelativeToParent(
    node: ServerRoom | ServerHallway,
    parentNode: ServerRoom | ServerHallway,
    direction: "left" | "right" | "center"
  ): void {
    console.log(`🎯 Positioning ${node.id} relative to ${parentNode.id} (${this.isRoom(parentNode) ? 'room' : 'hallway'}) with direction ${direction}`);
    
    if (this.isRoom(parentNode) && this.isHallway(node)) {
      // Parent is room, child is hallway - use precise door positioning
      this.positionHallwayFromParent(parentNode, node as ServerHallway);
    } else if (this.isRoom(parentNode)) {
      // Parent is room, child is room - use traditional positioning
      const SPACING = 25;
      this.positionFromRoom(node, parentNode as ServerRoom, direction, SPACING);
    } else {
      // Parent is hallway - position child from hallway end
      const SPACING = 25;
      this.positionFromHallway(node, parentNode as ServerHallway, direction, SPACING);
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
    if (!parentHallway.endPosition) {
      console.log(`⚠️ Parent hallway ${parentHallway.id} has no end position, cannot position child ${node.id}`);
      return;
    }
    
    const hallwayEnd = parentHallway.endPosition;
    
    // Get or calculate hallway direction
    let hallwayDir = parentHallway.direction;
    if (!hallwayDir && parentHallway.startPosition) {
      // Calculate direction from start to end
      hallwayDir = parentHallway.endPosition.clone().sub(parentHallway.startPosition).normalize();
    }
    
    if (!hallwayDir) {
      console.log(`⚠️ Cannot determine direction for hallway ${parentHallway.id}, using default direction`);
      hallwayDir = new THREE.Vector2(0, -1); // Default down
    }
    
    let newDirection = hallwayDir.clone();
    
    // Apply turn based on parentDirection
    switch (direction) {
      case "left":
        // Turn 90 degrees left (counterclockwise)
        newDirection = new THREE.Vector2(hallwayDir.y, -hallwayDir.x);
        break;
      case "right":
        // Turn 90 degrees right (clockwise)
        newDirection = new THREE.Vector2(-hallwayDir.y, hallwayDir.x);
        break;
      case "center":
      default:
        // Continue straight
        break;
    }

    console.log(`🎯 Positioning ${node.id} from hallway ${parentHallway.id} with direction ${direction}`);

    // Calculate proper offset to avoid wall overlaps but ensure tight connection
    const hallwayWidth = 3; // Default hallway width
    
    // For proper right-angle connections, position children right at the edge of the hallway
    // Different offsets for rooms vs hallways to ensure proper alignment
    let finalOffset: number;

    if (this.isRoom(node)) {
      // For rooms, position so the room's wall aligns properly with hallway
      const roomHalfWidth = node.width / 2;
      const roomHalfHeight = node.height / 2;
      
      if (direction === "left" || direction === "right") {
        // For left/right turns, position room so its closest edge is at hallway edge
        finalOffset = hallwayWidth / 2 + roomHalfWidth - 0.5; // Reduce gap slightly
      } else {
        // For center (straight), position room properly
        finalOffset = hallwayWidth / 2 + roomHalfHeight + 0.5;
      }
      
      node.position.set(
        hallwayEnd.x + newDirection.x * finalOffset,
        hallwayEnd.y + newDirection.y * finalOffset
      );
      console.log(`🎯 Room ${node.id} positioned at (${node.position.x}, ${node.position.y}) with offset ${finalOffset}`);
    } else {
      // For hallways connecting to hallways, extend further out to create proper right angle
      const hallway = node as ServerHallway;
      finalOffset = hallwayWidth / 2 + 1.5; // Increased from 0.5 to 1.5 for more forward distance
      
      hallway.startPosition = new THREE.Vector2(
        hallwayEnd.x + newDirection.x * finalOffset,
        hallwayEnd.y + newDirection.y * finalOffset
      );
      hallway.endPosition = new THREE.Vector2(
        hallway.startPosition.x + newDirection.x * hallway.length,
        hallway.startPosition.y + newDirection.y * hallway.length
      );
      hallway.direction = newDirection;
      
      console.log(`🎯 Hallway ${hallway.id} positioned from (${hallway.startPosition.x}, ${hallway.startPosition.y}) to (${hallway.endPosition.x}, ${hallway.endPosition.y}) with offset ${finalOffset}`);
      
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

    // Determine which side of the room the door should be on based on parentDirection
    let doorSide: "top" | "right" | "bottom" | "left" = "bottom";
    let doorPosition = new THREE.Vector2();

    // Map parentDirection to the side where the door should be (facing toward parent)
    switch (parentDirection) {
      case "center":
        // Child is below parent (parent comes from above), so door is on top
        doorSide = "top";
        const topOffset = Math.min(parentDoorOffset, width - 1);
        doorPosition = new THREE.Vector2(
          room.position.x - halfWidth + topOffset,
          room.position.y + halfHeight
        );
        break;
        
      case "left":
        // Child is to the LEFT of parent, so door faces RIGHT (toward parent)
        doorSide = "right";
        const rightOffset = Math.min(parentDoorOffset, height - 1);
        doorPosition = new THREE.Vector2(
          room.position.x + halfWidth,
          room.position.y - halfHeight + rightOffset
        );
        break;
        
      case "right":
        // Child is to the RIGHT of parent, so door faces LEFT (toward parent)
        doorSide = "left";
        const leftOffset = Math.min(parentDoorOffset, height - 1);
        doorPosition = new THREE.Vector2(
          room.position.x - halfWidth,
          room.position.y - halfHeight + leftOffset
        );
        break;
        
      default:
        // Default to bottom door
        doorSide = "bottom";
        const bottomOffset = Math.min(parentDoorOffset, width - 1);
        doorPosition = new THREE.Vector2(
          room.position.x - halfWidth + bottomOffset,
          room.position.y - halfHeight
        );
        break;
    }

    room.doorPosition = doorPosition;
    room.doorSide = doorSide;
    
    console.log(`🚪 Room ${room.id} door positioned on ${doorSide} side at (${doorPosition.x}, ${doorPosition.y})`);
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
   * Type guard to check if a node is a hallway
   */
  private static isHallway(node: ServerRoom | ServerHallway): node is ServerHallway {
    return 'length' in node;
  }

  /**
   * Position a hallway to start at the parent room's door with correct direction
   */
  private static positionHallwayFromParent(
    parentRoom: ServerRoom | ServerHallway,
    hallway: ServerHallway
  ): void {
    if (!this.isRoom(parentRoom)) {
      console.log(`⚠️ Parent is not a room, cannot position hallway ${hallway.id}`);
      return;
    }

    const room = parentRoom as ServerRoom;
    const parentDirection = hallway.parentDirection || "center";
    const parentDoorOffset = hallway.parentDoorOffset || (room.width / 2);

    console.log(`🚪➡️ Positioning hallway ${hallway.id} from room ${room.id}`);
    console.log(`🚪➡️ Direction: ${parentDirection}, Door offset: ${parentDoorOffset}, Hallway length: ${hallway.length}`);

    // Calculate door position on the parent room
    const doorPosition = this.calculateDoorWorldPosition(room, parentDirection, parentDoorOffset);
    
    // Calculate hallway direction vector based on parentDirection
    const directionVector = this.getDirectionVector(parentDirection);
    
    // Set hallway start and end positions
    hallway.startPosition = doorPosition.clone();
    hallway.endPosition = doorPosition.clone().add(directionVector.multiplyScalar(hallway.length));
    
    console.log(`🚪➡️ Hallway ${hallway.id}:`);
    console.log(`   Start: (${hallway.startPosition.x}, ${hallway.startPosition.y})`);
    console.log(`   End: (${hallway.endPosition.x}, ${hallway.endPosition.y})`);
    console.log(`   Direction vector: (${directionVector.x}, ${directionVector.y})`);

    // Create hallway segments
    this.calculateHallwaySegments(hallway);
  }

  /**
   * Calculate the world position of a door on a room
   */
  private static calculateDoorWorldPosition(
    room: ServerRoom,
    parentDirection: "left" | "right" | "center",
    parentDoorOffset: number
  ): THREE.Vector2 {
    const roomPos = room.position;
    const halfWidth = room.width / 2;
    const halfHeight = room.height / 2;

    let doorLocalPos = new THREE.Vector2();

    console.log(`🚪📍 Calculating door position for room ${room.id} (${room.width}x${room.height})`);
    console.log(`🚪📍 Direction: ${parentDirection}, Offset: ${parentDoorOffset}`);
    console.log(`🚪📍 Room half-dimensions: width=${halfWidth}, height=${halfHeight}`);

    // Calculate door position relative to room center based on direction
    switch (parentDirection) {
      case "center":
        // Bottom edge: offset from left side
        doorLocalPos.set(
          -halfWidth + parentDoorOffset,
          -halfHeight
        );
        console.log(`🚪📍 Center door: X = ${-halfWidth} + ${parentDoorOffset} = ${doorLocalPos.x}, Y = ${doorLocalPos.y}`);
        break;
      case "left":
        // Left edge: offset from top going down
        doorLocalPos.set(
          -halfWidth,
          halfHeight - parentDoorOffset
        );
        console.log(`🚪📍 Left door: X = ${doorLocalPos.x}, Y = ${halfHeight} - ${parentDoorOffset} = ${doorLocalPos.y}`);
        break;
      case "right":
        // Right edge: offset from top going down  
        doorLocalPos.set(
          halfWidth,
          halfHeight - parentDoorOffset
        );
        console.log(`🚪📍 Right door: X = ${doorLocalPos.x}, Y = ${halfHeight} - ${parentDoorOffset} = ${doorLocalPos.y}`);
        break;
    }

    // Convert to world position
    const worldPos = roomPos.clone().add(doorLocalPos);
    console.log(`🚪📍 Door world position: (${worldPos.x}, ${worldPos.y})`);
    return worldPos;
  }

  /**
   * Get direction vector for hallway based on parentDirection
   */
  private static getDirectionVector(parentDirection: "left" | "right" | "center"): THREE.Vector2 {
    switch (parentDirection) {
      case "center":
        return new THREE.Vector2(0, -1); // Down from bottom edge
      case "left":
        return new THREE.Vector2(-1, 0); // Left from left edge
      case "right":
        return new THREE.Vector2(1, 0); // Right from right edge
      default:
        return new THREE.Vector2(0, -1); // Default down
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
