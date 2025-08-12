import * as THREE from 'three';
import { CubePosition } from '../rendering/cubeFloorRenderer';
import { ServerHallway, FloorHallwaySegment } from '../types/generator';

export interface HallwayGenerationOptions {
  width?: number;
  cornerRadius?: number;
  minimizeOverlaps?: boolean;
}

/**
 * Generates hallway floor coordinates for rendering
 */
export class HallwayGenerator {
  private static readonly DEFAULT_OPTIONS: Required<HallwayGenerationOptions> = {
    width: 2,
    cornerRadius: 1,
    minimizeOverlaps: true
  };

  /**
   * Generate floor coordinates for a single hallway
   */
  static generateHallwayFloor(
    hallway: ServerHallway,
    options: HallwayGenerationOptions = {}
  ): CubePosition[] {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    if (!hallway.segments || hallway.segments.length === 0) {
      console.warn(`No segments found for hallway ${hallway.name}`);
      return [];
    }

    let coordinates: CubePosition[] = [];
    
    // Generate coordinates for each segment
    hallway.segments.forEach(segment => {
      const segmentCoords = this.generateSegmentCoordinates(segment, opts.width);
      coordinates = coordinates.concat(segmentCoords);
    });

    // Remove duplicates to avoid overlaps
    if (opts.minimizeOverlaps) {
      coordinates = this.removeDuplicateCoordinates(coordinates);
    }

    console.log(`🛤️ Generated ${coordinates.length} floor cubes for hallway ${hallway.name}`);
    return coordinates;
  }

  /**
   * Generate floor coordinates for multiple hallways
   */
  static generateMultipleHallwayFloors(
    hallways: ServerHallway[],
    options: HallwayGenerationOptions = {}
  ): Map<string, CubePosition[]> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const hallwayFloors = new Map<string, CubePosition[]>();
    
    hallways.forEach(hallway => {
      const coordinates = this.generateHallwayFloor(hallway, opts);
      hallwayFloors.set(hallway.name, coordinates);
    });

    return hallwayFloors;
  }

  /**
   * Generate coordinates for a single hallway segment
   */
  private static generateSegmentCoordinates(
    segment: FloorHallwaySegment,
    width: number
  ): CubePosition[] {
    const coordinates: CubePosition[] = [];
    const { start, end } = segment;
    
    // Calculate direction and length
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {
      // Single point hallway
      return this.generateWidthCoordinates(start.x, start.y, width, segment.direction);
    }
    
    // Normalize direction
    const dirX = dx / length;
    const dirY = dy / length;
    
    // Calculate perpendicular for width
    const perpX = -dirY;
    const perpY = dirX;
    
    // Number of steps along the segment
    const steps = Math.max(1, Math.ceil(length));
    
    for (let i = 0; i <= steps; i++) {
      const t = steps > 0 ? i / steps : 0;
      const centerX = start.x + dirX * length * t;
      const centerY = start.y + dirY * length * t;
      
      // Add cubes for width
      const widthCoords = this.generateWidthCoordinates(
        centerX, 
        centerY, 
        width, 
        new THREE.Vector2(perpX, perpY)
      );
      
      coordinates.push(...widthCoords);
    }
    
    return coordinates;
  }

  /**
   * Generate coordinates for hallway width at a specific point
   */
  private static generateWidthCoordinates(
    centerX: number,
    centerY: number,
    width: number,
    perpDirection: THREE.Vector2
  ): CubePosition[] {
    const coordinates: CubePosition[] = [];
    
    for (let w = 0; w < width; w++) {
      const widthOffset = w - Math.floor(width / 2);
      const finalX = Math.round(centerX + perpDirection.x * widthOffset);
      const finalY = Math.round(centerY + perpDirection.y * widthOffset);
      
      coordinates.push({ x: finalX, y: finalY });
    }
    
    return coordinates;
  }

  /**
   * Remove duplicate coordinates
   */
  private static removeDuplicateCoordinates(coordinates: CubePosition[]): CubePosition[] {
    const uniqueCoords = new Map<string, CubePosition>();
    
    coordinates.forEach(coord => {
      const key = `${coord.x},${coord.y}`;
      uniqueCoords.set(key, coord);
    });
    
    return Array.from(uniqueCoords.values());
  }

  /**
   * Generate intersection coordinates where hallways meet
   */
  static generateIntersectionFloor(
    position: THREE.Vector2,
    width: number,
    radius: number = 1
  ): CubePosition[] {
    const coordinates: CubePosition[] = [];
    const centerX = Math.round(position.x);
    const centerY = Math.round(position.y);
    
    // Create a circular intersection area
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      for (let y = centerY - radius; y <= centerY + radius; y++) {
        const distance = Math.sqrt(
          Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
        );
        
        if (distance <= radius) {
          coordinates.push({ x, y });
        }
      }
    }
    
    return coordinates;
  }

  /**
   * Calculate hallway connection points for rooms
   */
  static calculateRoomConnectionPoint(
    roomPosition: THREE.Vector2,
    roomWidth: number,
    roomHeight: number,
    doorSide: 'top' | 'right' | 'bottom' | 'left',
    doorOffset: number = 0
  ): THREE.Vector2 {
    const { x, y } = roomPosition;
    
    switch (doorSide) {
      case 'top':
        return new THREE.Vector2(x + doorOffset, y + roomHeight);
      case 'bottom':
        return new THREE.Vector2(x + doorOffset, y - 1);
      case 'right':
        return new THREE.Vector2(x + roomWidth, y + doorOffset);
      case 'left':
        return new THREE.Vector2(x - 1, y + doorOffset);
      default:
        return new THREE.Vector2(x, y);
    }
  }

  /**
   * Generate smooth path coordinates between two points
   */
  static generateSmoothPath(
    start: THREE.Vector2,
    end: THREE.Vector2,
    width: number = 2
  ): CubePosition[] {
    const coordinates: CubePosition[] = [];
    
    // Use Bresenham-like algorithm for smooth path
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const sx = start.x < end.x ? 1 : -1;
    const sy = start.y < end.y ? 1 : -1;
    let err = dx - dy;
    
    let currentX = start.x;
    let currentY = start.y;
    
    while (true) {
      // Add width around current point
      for (let w = 0; w < width; w++) {
        const offset = w - Math.floor(width / 2);
        
        // Add perpendicular offset based on dominant direction
        if (dx > dy) {
          coordinates.push({ 
            x: Math.round(currentX), 
            y: Math.round(currentY + offset) 
          });
        } else {
          coordinates.push({ 
            x: Math.round(currentX + offset), 
            y: Math.round(currentY) 
          });
        }
      }
      
      if (currentX === end.x && currentY === end.y) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        currentX += sx;
      }
      if (e2 < dx) {
        err += dx;
        currentY += sy;
      }
    }
    
    return this.removeDuplicateCoordinates(coordinates);
  }
}
