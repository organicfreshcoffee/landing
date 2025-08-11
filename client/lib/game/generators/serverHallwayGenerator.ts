import * as THREE from 'three';
import { ServerRoom, ServerFloorLayout, ServerHallway } from '../types/generator';

// Simplified door interface for server-based rooms
export interface ServerDoor {
  position: THREE.Vector2; // World position of the door
  width: number;
  roomId: string;
}

export interface Connection {
  fromRoomId: string;
  toRoomId: string;
  fromDoor: ServerDoor;
  toDoor: ServerDoor;
  hallwayLength?: number; // From server data if available
}

export interface HallwaySegment {
  id: string;
  start: THREE.Vector2;
  end: THREE.Vector2;
  width: number;
  connectionIds: string[];
}

export interface HallwayIntersection {
  id: string;
  position: THREE.Vector2;
  radius: number;
  connectedSegments: string[];
}

export interface HallwayNetwork {
  connections: Connection[];
  segments: HallwaySegment[];
  intersections: HallwayIntersection[];
  deadEnds: THREE.Vector2[];
}

export class ServerHallwayGenerator {
  /**
   * Generates hallway network from server floor layout
   * @param layout - The server floor layout with calculated positions
   * @param hallwayWidth - Width of hallways (default: 3)
   */
  static generateHallwayNetwork(
    layout: ServerFloorLayout,
    hallwayWidth: number = 3
  ): HallwayNetwork {
    const connections: Connection[] = [];
    const segments: HallwaySegment[] = [];
    const intersections: HallwayIntersection[] = [];
    const deadEnds: THREE.Vector2[] = [];
    
    // Convert server hallways to segments using their calculated positions
    layout.hallways.forEach((hallway) => {
      console.log(`🛤️ Processing hallway ${hallway.id} for segment generation`);
      
      if (hallway.segments && hallway.segments.length > 0) {
        hallway.segments.forEach((segment, segIndex) => {
          const hallwaySegment: HallwaySegment = {
            id: `${hallway.id}_segment_${segIndex}`,
            start: segment.start.clone(),
            end: segment.end.clone(),
            width: hallwayWidth,
            connectionIds: [hallway.id]
          };
          segments.push(hallwaySegment);
          console.log(`✅ Created segment: ${hallwaySegment.id} from (${segment.start.x}, ${segment.start.y}) to (${segment.end.x}, ${segment.end.y})`);
        });
      } else {
        console.log(`⚠️ Hallway ${hallway.id} has no segments calculated`);
        
        // Fallback: if no segments calculated, try to create from start/end positions
        if (hallway.startPosition && hallway.endPosition) {
          const hallwaySegment: HallwaySegment = {
            id: `${hallway.id}_fallback_segment`,
            start: hallway.startPosition.clone(),
            end: hallway.endPosition.clone(),
            width: hallwayWidth,
            connectionIds: [hallway.id]
          };
          segments.push(hallwaySegment);
          console.log(`✅ Created fallback segment: ${hallwaySegment.id} from (${hallway.startPosition.x}, ${hallway.startPosition.y}) to (${hallway.endPosition.x}, ${hallway.endPosition.y})`);
        } else {
          console.log(`❌ Hallway ${hallway.id} has no position data at all`);
        }
      }
    });

    // Create connections based on parent-child relationships
    this.createHierarchyBasedConnections(layout, connections, hallwayWidth);
    
    // Find intersections where segments cross
    this.findIntersections(segments, intersections, hallwayWidth);
    
    console.log(`Generated server-based hallway network: ${connections.length} connections, ${segments.length} segments, ${intersections.length} intersections`);
    
    return { connections, segments, intersections, deadEnds };
  }

  /**
   * Create connections based on the server hierarchy
   * SIMPLIFIED: Only create connections for root and immediate children
   */
  private static createHierarchyBasedConnections(
    layout: ServerFloorLayout,
    connections: Connection[],
    hallwayWidth: number
  ): void {
    console.log(`🔗 Creating connections for ${layout.nodeMap.size} nodes`);
    
    // Process each node and create connections to its children
    layout.nodeMap.forEach((node, nodeName) => {
      console.log(`🔗 Node ${nodeName} has ${node.children.length} children: [${node.children.join(', ')}]`);
      
      node.children.forEach((childName: string) => {
        const childNode = layout.nodeMap.get(childName);
        if (!childNode) {
          console.log(`⚠️ Child node ${childName} not found in nodeMap`);
          return;
        }

        console.log(`🔗 Creating connection: ${nodeName} -> ${childName}`);

        // Create connection between parent and child
        const connection = this.createDirectConnection(node, childNode, hallwayWidth);
        if (connection) {
          connections.push(connection);
          console.log(`✅ Connection created: ${connection.fromRoomId} -> ${connection.toRoomId}`);
        } else {
          console.log(`❌ Failed to create connection: ${nodeName} -> ${childName}`);
        }
      });
    });
  }

  /**
   * Create a direct connection between two nodes
   */
  private static createDirectConnection(
    fromNode: ServerRoom | ServerHallway,
    toNode: ServerRoom | ServerHallway,
    hallwayWidth: number
  ): Connection | null {
    // Get connection points
    const fromDoor = this.getNodeConnectionPoint(fromNode);
    const toDoor = this.getNodeConnectionPoint(toNode);

    if (!fromDoor || !toDoor) return null;

    return {
      fromRoomId: fromNode.id,
      toRoomId: toNode.id,
      fromDoor,
      toDoor,
      hallwayLength: this.isHallway(toNode) ? toNode.length : undefined
    };
  }

  /**
   * Get the connection point for a node (room or hallway)
   */
  private static getNodeConnectionPoint(node: ServerRoom | ServerHallway): ServerDoor | null {
    if (this.isRoom(node)) {
      const room = node as ServerRoom;
      // For rooms, use the room center as the connection point
      // The actual door positions are handled by the room renderer
      return {
        position: room.position.clone(),
        width: 2,
        roomId: room.id
      };
    } else {
      const hallway = node as ServerHallway;
      // For hallways, use the start position as the connection point
      if (hallway.startPosition) {
        return {
          position: hallway.startPosition.clone(),
          width: 2,
          roomId: hallway.id
        };
      }
      
      console.log(`⚠️ Hallway ${hallway.id} has no start position`);
      return null;
    }
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
   * Finds intersections between hallway segments
   */
  private static findIntersections(
    segments: HallwaySegment[],
    intersections: HallwayIntersection[],
    defaultRadius: number
  ): void {
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const seg1 = segments[i];
        const seg2 = segments[j];
        
        const intersection = this.lineIntersection(
          seg1.start, seg1.end,
          seg2.start, seg2.end
        );
        
        if (intersection) {
          const intersectionId = `intersection_${i}_${j}`;
          intersections.push({
            id: intersectionId,
            position: intersection,
            radius: Math.max(seg1.width, seg2.width) / 2,
            connectedSegments: [seg1.id, seg2.id]
          });
        }
      }
    }
  }
  
  /**
   * Calculates intersection point of two lines
   */
  private static lineIntersection(
    p1: THREE.Vector2, p2: THREE.Vector2,
    p3: THREE.Vector2, p4: THREE.Vector2
  ): THREE.Vector2 | null {
    const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(denom) < 0.0001) return null; // Parallel lines
    
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denom;
    
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return new THREE.Vector2(
        p1.x + t * (p2.x - p1.x),
        p1.y + t * (p2.y - p1.y)
      );
    }
    
    return null;
  }
}
