import * as THREE from 'three';
import { HallwayNetwork, HallwaySegment, HallwayIntersection } from '../types/generator';
import { CubeFloorRenderer } from './cubeFloorRenderer';

export interface HallwayRenderOptions {
  cubeSize?: number;
  floorColor?: number;
}

export class HallwayRenderer {
  /**
   * Renders the complete hallway network using only cube floors (no walls)
   */
  static renderHallwayNetwork(
    scene: THREE.Scene,
    network: HallwayNetwork,
    options: HallwayRenderOptions = {}
  ): THREE.Group {
    const {
      cubeSize = 1,
      floorColor = 0x444444
    } = options;

    const hallwayGroup = new THREE.Group();
    hallwayGroup.name = 'HallwayNetwork';

    // Render all hallway segments as cube floors
    network.segments.forEach(segment => {
      const segmentGroup = this.renderHallwaySegmentFloor(
        segment, 
        cubeSize, 
        floorColor
      );
      hallwayGroup.add(segmentGroup);
    });

    // Render intersections as cube floors
    network.intersections.forEach(intersection => {
      const intersectionGroup = this.renderIntersectionFloor(intersection, cubeSize, floorColor);
      hallwayGroup.add(intersectionGroup);
    });

    // Render dead ends as cube floors
    network.deadEnds.forEach((deadEnd, index) => {
      const deadEndGroup = this.renderDeadEndFloor(deadEnd, index, cubeSize, floorColor);
      hallwayGroup.add(deadEndGroup);
    });

    scene.add(hallwayGroup);
    return hallwayGroup;
  }

  /**
   * Renders a single hallway segment using cube floors only
   */
  private static renderHallwaySegmentFloor(
    segment: HallwaySegment,
    cubeSize: number,
    floorColor: number
  ): THREE.Group {
    const segmentGroup = new THREE.Group();
    segmentGroup.name = `HallwaySegment_${segment.id}`;

    // Calculate hallway direction and length
    const direction = new THREE.Vector2(
      segment.end.x - segment.start.x,
      segment.end.y - segment.start.y
    );
    const length = direction.length();
    direction.normalize();

    // Calculate how many cubes we need along the length
    const numCubesLength = Math.ceil(length / cubeSize);
    
    // Calculate how many cubes we need for width (default hallway width of 3 units = 3 cubes)
    const hallwayWidthInCubes = Math.max(1, Math.floor(segment.width / cubeSize));
    
    // Generate cube coordinates for this hallway segment
    const coordinates: Array<{ x: number; y: number }> = [];
    
    for (let i = 0; i < numCubesLength; i++) {
      // Progress along the hallway from start to end
      const t = i / (numCubesLength - 1 || 1); // Avoid division by zero
      
      // Calculate center position at this point along the hallway
      const centerX = segment.start.x + direction.x * length * t;
      const centerY = segment.start.y + direction.y * length * t;
      
      // Convert to cube grid coordinates
      const cubeX = Math.round(centerX / cubeSize);
      const cubeY = Math.round(centerY / cubeSize);
      
      // Add cubes for the width of the hallway
      for (let w = 0; w < hallwayWidthInCubes; w++) {
        // Calculate perpendicular offset for width
        const perpendicular = new THREE.Vector2(-direction.y, direction.x);
        const widthOffset = (w - Math.floor(hallwayWidthInCubes / 2));
        
        const finalX = cubeX + Math.round(perpendicular.x * widthOffset);
        const finalY = cubeY + Math.round(perpendicular.y * widthOffset);
        
        coordinates.push({ x: finalX, y: finalY });
      }
    }

    // Remove duplicates (in case multiple calculations result in same cube)
    const uniqueCoordinates = coordinates.filter((coord, index, arr) => 
      arr.findIndex(c => c.x === coord.x && c.y === coord.y) === index
    );

    // Render all the cube floors
    const floorGroup = CubeFloorRenderer.renderCubeFloorCoordinates(
      uniqueCoordinates,
      {
        cubeSize,
        floorColor,
        yOffset: 0
      }
    );
    
    floorGroup.name = 'HallwayFloor';
    segmentGroup.add(floorGroup);

    console.log(`🛤️ Hallway ${segment.id}: Rendered ${uniqueCoordinates.length} floor cubes`);

    return segmentGroup;
  }

  /**
   * Renders a hallway intersection using cube floors only
   */
  private static renderIntersectionFloor(
    intersection: HallwayIntersection,
    cubeSize: number,
    floorColor: number
  ): THREE.Group {
    const intersectionGroup = new THREE.Group();
    intersectionGroup.name = `Intersection_${intersection.id}`;

    // Convert intersection center to cube coordinates
    const centerCubeX = Math.round(intersection.position.x / cubeSize);
    const centerCubeY = Math.round(intersection.position.y / cubeSize);
    
    // Calculate radius in cube units
    const radiusInCubes = Math.max(2, Math.ceil(intersection.radius / cubeSize));
    
    // Generate cube coordinates in a circular pattern
    const coordinates: Array<{ x: number; y: number }> = [];
    
    for (let x = -radiusInCubes; x <= radiusInCubes; x++) {
      for (let y = -radiusInCubes; y <= radiusInCubes; y++) {
        const distance = Math.sqrt(x * x + y * y);
        if (distance <= radiusInCubes) {
          coordinates.push({ 
            x: centerCubeX + x, 
            y: centerCubeY + y 
          });
        }
      }
    }

    // Render all the cube floors
    const floorGroup = CubeFloorRenderer.renderCubeFloorCoordinates(
      coordinates,
      {
        cubeSize,
        floorColor,
        yOffset: 0
      }
    );
    
    floorGroup.name = 'IntersectionFloor';
    intersectionGroup.add(floorGroup);

    console.log(`🔄 Intersection ${intersection.id}: Rendered ${coordinates.length} floor cubes`);

    return intersectionGroup;
  }

  /**
   * Renders a dead-end using cube floors only
   */
  private static renderDeadEndFloor(
    deadEndPos: THREE.Vector2,
    index: number,
    cubeSize: number,
    floorColor: number
  ): THREE.Group {
    const deadEndGroup = new THREE.Group();
    deadEndGroup.name = `DeadEnd_${index}`;

    // Convert dead end position to cube coordinates
    const centerCubeX = Math.round(deadEndPos.x / cubeSize);
    const centerCubeY = Math.round(deadEndPos.y / cubeSize);
    
    // Create a small area of cube floors (3x3 grid)
    const coordinates: Array<{ x: number; y: number }> = [];
    
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        coordinates.push({ 
          x: centerCubeX + x, 
          y: centerCubeY + y 
        });
      }
    }

    // Render all the cube floors
    const floorGroup = CubeFloorRenderer.renderCubeFloorCoordinates(
      coordinates,
      {
        cubeSize,
        floorColor,
        yOffset: 0
      }
    );
    
    floorGroup.name = 'DeadEndFloor';
    deadEndGroup.add(floorGroup);

    console.log(`⚫ Dead End ${index}: Rendered ${coordinates.length} floor cubes`);

    return deadEndGroup;
  }

  /**
   * Alternative method to render a simple hallway between two points
   * Useful for connecting rooms directly
   */
  static renderSimpleHallway(
    scene: THREE.Scene,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number = 3,
    options: HallwayRenderOptions = {}
  ): THREE.Group {
    const {
      cubeSize = 1,
      floorColor = 0x444444
    } = options;

    // Create a simple hallway segment
    const segment: HallwaySegment = {
      id: `simple_${startX}_${startY}_${endX}_${endY}`,
      start: new THREE.Vector2(startX, startY),
      end: new THREE.Vector2(endX, endY),
      width,
      connectionIds: []
    };

    return this.renderHallwaySegmentFloor(segment, cubeSize, floorColor);
  }

  /**
   * Removes all hallways from the scene
   */
  static clearHallways(scene: THREE.Scene): void {
    const hallwaysToRemove = scene.children.filter(child => child.name === 'HallwayNetwork');
    hallwaysToRemove.forEach(hallway => {
      scene.remove(hallway);
      // Dispose of geometries and materials to free memory
      hallway.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    });
    console.log(`Removed ${hallwaysToRemove.length} hallway network(s) from scene`);
    
    // Clean up shared cube renderer resources
    CubeFloorRenderer.dispose();
  }
}
