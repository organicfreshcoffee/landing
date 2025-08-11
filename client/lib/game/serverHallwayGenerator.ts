import * as THREE from 'three';
import { ServerRoom, ServerFloorLayout, ServerHallway } from './serverFloorGenerator';

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
   * Generates hallways connecting rooms based on server floor layout
   * @param layout - The server floor layout with rooms and hallways
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
    
    // Generate doors for each room
    const roomDoors = this.generateRoomDoors(layout.rooms);
    
    // Create connections based on room hierarchy from server
    this.createServerBasedConnections(layout, roomDoors, connections);
    
    // Generate hallway segments from connections
    for (const connection of connections) {
      const pathSegments = this.generatePathSegments(connection, hallwayWidth);
      segments.push(...pathSegments);
    }
    
    // Find intersections where segments cross
    this.findIntersections(segments, intersections, hallwayWidth);
    
    console.log(`Generated server-based hallway network: ${connections.length} connections, ${segments.length} segments, ${intersections.length} intersections`);
    
    return { connections, segments, intersections, deadEnds };
  }
  
  /**
   * Generate doors for rooms based on their rectangular shape
   */
  private static generateRoomDoors(rooms: ServerRoom[]): Map<string, ServerDoor[]> {
    const roomDoors = new Map<string, ServerDoor[]>();
    
    rooms.forEach(room => {
      const doors: ServerDoor[] = [];
      const numDoors = 2 + Math.floor(Math.random() * 2); // 2-3 doors per room
      
      // Generate doors on room perimeter
      for (let i = 0; i < numDoors; i++) {
        const side = Math.floor(Math.random() * 4); // 0=bottom, 1=right, 2=top, 3=left
        const doorWidth = 2;
        
        let doorPosition: THREE.Vector2;
        const halfWidth = room.width / 2;
        const halfHeight = room.height / 2;
        
        switch (side) {
          case 0: // Bottom
            doorPosition = new THREE.Vector2(
              room.position.x + (Math.random() - 0.5) * room.width * 0.6,
              room.position.y - halfHeight
            );
            break;
          case 1: // Right
            doorPosition = new THREE.Vector2(
              room.position.x + halfWidth,
              room.position.y + (Math.random() - 0.5) * room.height * 0.6
            );
            break;
          case 2: // Top
            doorPosition = new THREE.Vector2(
              room.position.x + (Math.random() - 0.5) * room.width * 0.6,
              room.position.y + halfHeight
            );
            break;
          case 3: // Left
            doorPosition = new THREE.Vector2(
              room.position.x - halfWidth,
              room.position.y + (Math.random() - 0.5) * room.height * 0.6
            );
            break;
          default:
            doorPosition = new THREE.Vector2(room.position.x, room.position.y - halfHeight);
        }
        
        doors.push({
          position: doorPosition,
          width: doorWidth,
          roomId: room.id
        });
      }
      
      roomDoors.set(room.id, doors);
    });
    
    return roomDoors;
  }
  
  /**
   * Create connections based on server's room hierarchy (parent-child relationships)
   */
  private static createServerBasedConnections(
    layout: ServerFloorLayout,
    roomDoors: Map<string, ServerDoor[]>,
    connections: Connection[]
  ): void {
    const roomMap = new Map<string, ServerRoom>();
    layout.rooms.forEach(room => roomMap.set(room.id, room));
    
    // Create connections based on parent-child relationships
    for (const room of layout.rooms) {
      for (const childId of room.children) {
        const childRoom = roomMap.get(childId);
        if (childRoom) {
          const connection = this.createConnection(room, childRoom, roomDoors);
          if (connection) {
            connections.push(connection);
          }
        }
      }
    }
    
    // Ensure all rooms are connected by creating a minimum spanning tree if needed
    this.ensureAllRoomsConnected(layout.rooms, roomDoors, connections);
  }
  
  /**
   * Creates a connection between two rooms using their closest doors
   */
  private static createConnection(
    room1: ServerRoom,
    room2: ServerRoom,
    roomDoors: Map<string, ServerDoor[]>
  ): Connection | null {
    const doors1 = roomDoors.get(room1.id);
    const doors2 = roomDoors.get(room2.id);
    
    if (!doors1 || !doors2) return null;
    
    // Find the closest pair of doors
    let bestConnection: Connection | null = null;
    let shortestDistance = Infinity;
    
    for (const door1 of doors1) {
      for (const door2 of doors2) {
        const distance = door1.position.distanceTo(door2.position);
        
        if (distance < shortestDistance) {
          shortestDistance = distance;
          bestConnection = {
            fromRoomId: room1.id,
            toRoomId: room2.id,
            fromDoor: door1,
            toDoor: door2
          };
        }
      }
    }
    
    return bestConnection;
  }
  
  /**
   * Ensure all rooms are connected using minimum spanning tree
   */
  private static ensureAllRoomsConnected(
    rooms: ServerRoom[],
    roomDoors: Map<string, ServerDoor[]>,
    existingConnections: Connection[]
  ): void {
    // Create a graph of existing connections
    const connected = new Set<string>();
    const adjacencyList = new Map<string, Set<string>>();
    
    rooms.forEach(room => adjacencyList.set(room.id, new Set()));
    
    existingConnections.forEach(conn => {
      adjacencyList.get(conn.fromRoomId)?.add(conn.toRoomId);
      adjacencyList.get(conn.toRoomId)?.add(conn.fromRoomId);
    });
    
    // Find connected components using DFS
    const visited = new Set<string>();
    const components: string[][] = [];
    
    rooms.forEach(room => {
      if (!visited.has(room.id)) {
        const component: string[] = [];
        this.dfs(room.id, adjacencyList, visited, component);
        components.push(component);
      }
    });
    
    // Connect components if there are multiple
    if (components.length > 1) {
      for (let i = 1; i < components.length; i++) {
        // Find closest rooms between components
        let bestConnection: Connection | null = null;
        let shortestDistance = Infinity;
        
        for (const roomId1 of components[0]) {
          for (const roomId2 of components[i]) {
            const room1 = rooms.find(r => r.id === roomId1);
            const room2 = rooms.find(r => r.id === roomId2);
            
            if (room1 && room2) {
              const distance = room1.position.distanceTo(room2.position);
              if (distance < shortestDistance) {
                const connection = this.createConnection(room1, room2, roomDoors);
                if (connection) {
                  shortestDistance = distance;
                  bestConnection = connection;
                }
              }
            }
          }
        }
        
        if (bestConnection) {
          existingConnections.push(bestConnection);
          // Merge component i into component 0
          components[0].push(...components[i]);
        }
      }
    }
  }
  
  /**
   * Depth-first search for finding connected components
   */
  private static dfs(
    nodeId: string,
    adjacencyList: Map<string, Set<string>>,
    visited: Set<string>,
    component: string[]
  ): void {
    visited.add(nodeId);
    component.push(nodeId);
    
    const neighbors = adjacencyList.get(nodeId);
    if (neighbors) {
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          this.dfs(neighbor, adjacencyList, visited, component);
        }
      });
    }
  }
  
  /**
   * Generates path segments for a connection
   */
  private static generatePathSegments(connection: Connection, width: number): HallwaySegment[] {
    const segments: HallwaySegment[] = [];
    
    // Create a simple straight line segment (can be enhanced with L-shaped paths)
    const segmentId = `${connection.fromRoomId}_to_${connection.toRoomId}`;
    
    segments.push({
      id: segmentId,
      start: connection.fromDoor.position,
      end: connection.toDoor.position,
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
}
