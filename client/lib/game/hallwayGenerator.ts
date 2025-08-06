import * as THREE from 'three';
import { Room, FloorLayout } from './floorGenerator';
import { RoomShape, Door } from './roomShapeGenerator';

export interface Connection {
  fromRoomId: string;
  toRoomId: string;
  fromDoor: Door;
  toDoor: Door;
  fromDoorWorldPos: THREE.Vector2;
  toDoorWorldPos: THREE.Vector2;
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

export class HallwayGenerator {
  /**
   * Generates hallways connecting rooms, ensuring all rooms are connected
   * @param layout - The floor layout with rooms
   * @param roomShapes - Map of room ID to room shape data
   * @param hallwayWidth - Width of hallways (default: 3)
   * @param maxHallwayLength - Maximum length for direct connections (default: 40)
   * @param deadEndProbability - Probability of creating dead-end hallways (default: 0.2)
   */
  static generateHallwayNetwork(
    layout: FloorLayout,
    roomShapes: Map<string, RoomShape>,
    hallwayWidth: number = 3,
    maxHallwayLength: number = 40,
    deadEndProbability: number = 0.2
  ): HallwayNetwork {
    const connections: Connection[] = [];
    const segments: HallwaySegment[] = [];
    const intersections: HallwayIntersection[] = [];
    const deadEnds: THREE.Vector2[] = [];
    
    // Create minimum spanning tree to ensure all rooms are connected
    const mst = this.createMinimumSpanningTree(layout);
    
    // Generate connections for MST edges
    for (const edge of mst) {
      const connection = this.createConnection(
        edge.room1, edge.room2, roomShapes, layout
      );
      if (connection) {
        connections.push(connection);
      }
    }
    
    // Add additional connections for variety (with probability)
    this.addAdditionalConnections(layout, roomShapes, connections, 0.3, maxHallwayLength);
    
    // Generate hallway segments from connections
    for (const connection of connections) {
      const pathSegments = this.generatePathSegments(connection, hallwayWidth);
      segments.push(...pathSegments);
    }
    
    // Find intersections where segments cross
    this.findIntersections(segments, intersections, hallwayWidth);
    
    // Generate some dead-end hallways for variety
    this.generateDeadEnds(segments, deadEnds, deadEndProbability, hallwayWidth);
    
    console.log(`Generated hallway network: ${connections.length} connections, ${segments.length} segments, ${intersections.length} intersections`);
    
    return { connections, segments, intersections, deadEnds };
  }
  
  /**
   * Creates minimum spanning tree to ensure all rooms are connected
   */
  private static createMinimumSpanningTree(layout: FloorLayout): { room1: Room; room2: Room; distance: number }[] {
    const edges: { room1: Room; room2: Room; distance: number }[] = [];
    
    // Generate all possible edges
    for (let i = 0; i < layout.rooms.length; i++) {
      for (let j = i + 1; j < layout.rooms.length; j++) {
        const room1 = layout.rooms[i];
        const room2 = layout.rooms[j];
        const distance = room1.position.distanceTo(room2.position);
        edges.push({ room1, room2, distance });
      }
    }
    
    // Sort edges by distance
    edges.sort((a, b) => a.distance - b.distance);
    
    // Kruskal's algorithm
    const mst: { room1: Room; room2: Room; distance: number }[] = [];
    const connected = new Set<string>();
    const components = new Map<string, string>();
    
    // Initialize each room as its own component
    layout.rooms.forEach(room => {
      components.set(room.id, room.id);
    });
    
    function findRoot(id: string): string {
      if (components.get(id) !== id) {
        components.set(id, findRoot(components.get(id)!));
      }
      return components.get(id)!;
    }
    
    for (const edge of edges) {
      const root1 = findRoot(edge.room1.id);
      const root2 = findRoot(edge.room2.id);
      
      if (root1 !== root2) {
        mst.push(edge);
        components.set(root1, root2);
        
        if (mst.length === layout.rooms.length - 1) {
          break;
        }
      }
    }
    
    return mst;
  }
  
  /**
   * Creates a connection between two rooms
   */
  private static createConnection(
    room1: Room,
    room2: Room,
    roomShapes: Map<string, RoomShape>,
    layout: FloorLayout
  ): Connection | null {
    const shape1 = roomShapes.get(room1.id);
    const shape2 = roomShapes.get(room2.id);
    
    if (!shape1 || !shape2) return null;
    
    // Find the best doors to connect (closest to each other)
    let bestConnection: Connection | null = null;
    let shortestDistance = Infinity;
    
    for (const door1 of shape1.doors) {
      for (const door2 of shape2.doors) {
        // Calculate world positions of doors
        const door1WorldPos = this.getDoorWorldPosition(shape1, door1, room1.position);
        const door2WorldPos = this.getDoorWorldPosition(shape2, door2, room2.position);
        
        const distance = door1WorldPos.distanceTo(door2WorldPos);
        
        if (distance < shortestDistance) {
          shortestDistance = distance;
          bestConnection = {
            fromRoomId: room1.id,
            toRoomId: room2.id,
            fromDoor: door1,
            toDoor: door2,
            fromDoorWorldPos: door1WorldPos,
            toDoorWorldPos: door2WorldPos
          };
        }
      }
    }
    
    return bestConnection;
  }
  
  /**
   * Gets the world position of a door
   */
  private static getDoorWorldPosition(shape: RoomShape, door: Door, roomPosition: THREE.Vector2): THREE.Vector2 {
    const edge = shape.edges[door.edgeIndex];
    const edgeDirection = new THREE.Vector2(edge.end.x - edge.start.x, edge.end.y - edge.start.y);
    
    const doorCenter = new THREE.Vector2(
      edge.start.x + edgeDirection.x * door.position,
      edge.start.y + edgeDirection.y * door.position
    );
    
    return new THREE.Vector2(
      doorCenter.x + roomPosition.x,
      doorCenter.y + roomPosition.y
    );
  }
  
  /**
   * Adds additional connections for variety
   */
  private static addAdditionalConnections(
    layout: FloorLayout,
    roomShapes: Map<string, RoomShape>,
    existingConnections: Connection[],
    probability: number,
    maxLength: number
  ): void {
    const existingPairs = new Set<string>();
    existingConnections.forEach(conn => {
      existingPairs.add(`${conn.fromRoomId}-${conn.toRoomId}`);
      existingPairs.add(`${conn.toRoomId}-${conn.fromRoomId}`);
    });
    
    for (let i = 0; i < layout.rooms.length; i++) {
      for (let j = i + 1; j < layout.rooms.length; j++) {
        const room1 = layout.rooms[i];
        const room2 = layout.rooms[j];
        const pairKey = `${room1.id}-${room2.id}`;
        
        if (existingPairs.has(pairKey)) continue;
        
        const distance = room1.position.distanceTo(room2.position);
        if (distance > maxLength) continue;
        
        if (Math.random() < probability) {
          const connection = this.createConnection(room1, room2, roomShapes, layout);
          if (connection) {
            existingConnections.push(connection);
            existingPairs.add(pairKey);
            existingPairs.add(`${room2.id}-${room1.id}`);
          }
        }
      }
    }
  }
  
  /**
   * Generates path segments for a connection
   */
  private static generatePathSegments(connection: Connection, width: number): HallwaySegment[] {
    const segments: HallwaySegment[] = [];
    
    // For now, create a simple straight line (can be enhanced with L-shaped or more complex paths)
    const segmentId = `${connection.fromRoomId}_to_${connection.toRoomId}`;
    
    segments.push({
      id: segmentId,
      start: connection.fromDoorWorldPos,
      end: connection.toDoorWorldPos,
      width,
      connectionIds: [connection.fromRoomId, connection.toRoomId]
    });
    
    return segments;
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
  
  /**
   * Generates dead-end hallways for variety
   */
  private static generateDeadEnds(
    segments: HallwaySegment[],
    deadEnds: THREE.Vector2[],
    probability: number,
    width: number
  ): void {
    segments.forEach(segment => {
      if (Math.random() < probability) {
        // Create a dead end extending from a random point along the segment
        const t = 0.3 + Math.random() * 0.4; // 30% to 70% along the segment
        const segmentPoint = new THREE.Vector2(
          segment.start.x + t * (segment.end.x - segment.start.x),
          segment.start.y + t * (segment.end.y - segment.start.y)
        );
        
        // Create perpendicular direction for dead end
        const segmentDir = new THREE.Vector2(
          segment.end.x - segment.start.x,
          segment.end.y - segment.start.y
        ).normalize();
        
        const perpDir = new THREE.Vector2(-segmentDir.y, segmentDir.x);
        const deadEndLength = 5 + Math.random() * 10;
        
        const deadEndPoint = new THREE.Vector2(
          segmentPoint.x + perpDir.x * deadEndLength,
          segmentPoint.y + perpDir.y * deadEndLength
        );
        
        deadEnds.push(deadEndPoint);
      }
    });
  }
}
