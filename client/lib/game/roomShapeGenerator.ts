import * as THREE from 'three';

export interface Door {
  edgeIndex: number;
  position: number; // 0.0 to 1.0 along the edge
  width: number; // door width in units
}

export interface RoomShape {
  vertices: THREE.Vector2[];
  edges: { start: THREE.Vector2; end: THREE.Vector2; length: number }[];
  doors: Door[];
  shapeType: 'rectangle';
  width: number;
  height: number;
}

export class RoomShapeGenerator {
  /**
   * Generates a rectangular room shape with doors
   * @param minWidth - Minimum width of the room (default: 8)
   * @param maxWidth - Maximum width of the room (default: 15)
   * @param minHeight - Minimum height of the room (default: 8)
   * @param maxHeight - Maximum height of the room (default: 15)
   * @param minDoors - Minimum number of doors (default: 1)
   * @param maxDoors - Maximum number of doors (default: 3)
   * @param doorWidth - Width of each door (default: 2)
   */
  static generateRoomShape(
    minWidth: number = 8,
    maxWidth: number = 15,
    minHeight: number = 8,
    maxHeight: number = 15,
    minDoors: number = 1,
    maxDoors: number = 3,
    doorWidth: number = 2
  ): RoomShape {
    // Generate random room dimensions
    const width = minWidth + Math.random() * (maxWidth - minWidth);
    const height = minHeight + Math.random() * (maxHeight - minHeight);
    
    // Create rectangular vertices (centered at origin)
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    
    const vertices: THREE.Vector2[] = [
      new THREE.Vector2(-halfWidth, -halfHeight), // Bottom-left
      new THREE.Vector2(halfWidth, -halfHeight),  // Bottom-right
      new THREE.Vector2(halfWidth, halfHeight),   // Top-right
      new THREE.Vector2(-halfWidth, halfHeight)   // Top-left
    ];

    // Generate edges from vertices
    const edges = [];
    for (let i = 0; i < vertices.length; i++) {
      const start = vertices[i];
      const end = vertices[(i + 1) % vertices.length];
      const length = start.distanceTo(end);
      edges.push({ start, end, length });
    }

    // Generate doors
    const numDoors = Math.floor(Math.random() * (maxDoors - minDoors + 1)) + minDoors;
    const doors: Door[] = [];
    const usedEdges = new Set<number>();

    for (let i = 0; i < numDoors; i++) {
      // Find an edge that's long enough for a door and hasn't been used
      let attempts = 0;
      let edgeIndex: number;
      
      do {
        edgeIndex = Math.floor(Math.random() * edges.length);
        attempts++;
      } while (
        (edges[edgeIndex].length < doorWidth * 1.5 || usedEdges.has(edgeIndex)) && 
        attempts < 20
      );

      if (attempts < 20) {
        usedEdges.add(edgeIndex);
        
        // Position door randomly along the edge, but not too close to vertices
        const minPosition = 0.2;
        const maxPosition = 0.8;
        const position = minPosition + Math.random() * (maxPosition - minPosition);
        
        doors.push({
          edgeIndex,
          position,
          width: doorWidth
        });
      }
    }

    console.log(`Generated rectangular room: ${width.toFixed(1)} x ${height.toFixed(1)}, ${doors.length} doors`);

    return {
      vertices,
      edges,
      doors,
      shapeType: 'rectangle',
      width,
      height
    };
  }

  /**
   * Gets the world position of a door
   */
  static getDoorWorldPosition(shape: RoomShape, door: Door): { start: THREE.Vector2; end: THREE.Vector2; center: THREE.Vector2 } {
    const edge = shape.edges[door.edgeIndex];
    const edgeDirection = new THREE.Vector2(edge.end.x - edge.start.x, edge.end.y - edge.start.y);
    
    // Calculate door center position along edge
    const doorCenter = new THREE.Vector2(
      edge.start.x + edgeDirection.x * door.position,
      edge.start.y + edgeDirection.y * door.position
    );
    
    // Calculate door start and end positions
    const halfWidth = door.width / 2;
    const normalizedDirection = edgeDirection.clone().normalize();
    
    const doorStart = new THREE.Vector2(
      doorCenter.x - normalizedDirection.x * halfWidth,
      doorCenter.y - normalizedDirection.y * halfWidth
    );
    
    const doorEnd = new THREE.Vector2(
      doorCenter.x + normalizedDirection.x * halfWidth,
      doorCenter.y + normalizedDirection.y * halfWidth
    );
    
    return { start: doorStart, end: doorEnd, center: doorCenter };
  }
}
