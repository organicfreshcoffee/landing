import * as THREE from 'three';
import { HallwayNetwork, HallwaySegment, HallwayIntersection } from '../types/generator';

export interface HallwayRenderOptions {
  cubeSize?: number;
  hallwayHeight?: number;
  wallColor?: number;
  floorColor?: number;
}

export class HallwayRenderer {
  /**
   * Renders the complete hallway network
   */
  static renderHallwayNetwork(
    scene: THREE.Scene,
    network: HallwayNetwork,
    options: HallwayRenderOptions = {}
  ): THREE.Group {
    const {
      cubeSize = 1,
      hallwayHeight = 5,
      wallColor = 0x888888,
      floorColor = 0x444444
    } = options;

    const hallwayGroup = new THREE.Group();
    hallwayGroup.name = 'HallwayNetwork';

    // Render all hallway segments
    network.segments.forEach(segment => {
      const segmentGroup = this.renderHallwaySegment(
        segment, 
        cubeSize, 
        hallwayHeight, 
        wallColor, 
        floorColor
      );
      hallwayGroup.add(segmentGroup);
    });

    // Render intersections
    network.intersections.forEach(intersection => {
      const intersectionGroup = this.renderIntersection(intersection, cubeSize, hallwayHeight, wallColor, floorColor);
      hallwayGroup.add(intersectionGroup);
    });

    // Render dead ends
    network.deadEnds.forEach((deadEnd, index) => {
      const deadEndGroup = this.renderDeadEnd(deadEnd, index, cubeSize, hallwayHeight, wallColor, floorColor);
      hallwayGroup.add(deadEndGroup);
    });

    scene.add(hallwayGroup);
    return hallwayGroup;
  }

  /**
   * Renders a single hallway segment
   */
  private static renderHallwaySegment(
    segment: HallwaySegment,
    cubeSize: number,
    hallwayHeight: number,
    wallColor: number,
    floorColor: number
  ): THREE.Group {
    const segmentGroup = new THREE.Group();
    segmentGroup.name = `HallwaySegment_${segment.id}`;

    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const wallMaterial = new THREE.MeshLambertMaterial({ color: wallColor });
    const floorMaterial = new THREE.MeshLambertMaterial({ color: floorColor });

    // Calculate hallway direction and perpendicular
    const direction = new THREE.Vector2(
      segment.end.x - segment.start.x,
      segment.end.y - segment.start.y
    );
    const length = direction.length();
    direction.normalize();

    const perpendicular = new THREE.Vector2(-direction.y, direction.x);

    // Render floor
    const floorLength = length + cubeSize; // Extend slightly for seamless connections
    const floorWidth = segment.width + cubeSize; // Extend slightly for wall coverage
    
    const floorGeometry = new THREE.PlaneGeometry(floorLength, floorWidth);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    
    // Position and orient floor
    const floorCenter = new THREE.Vector2(
      (segment.start.x + segment.end.x) / 2,
      (segment.start.y + segment.end.y) / 2
    );
    
    console.log(`🛤️ Hallway ${segment.id}: direction=(${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}), length=${length.toFixed(2)}`);
    console.log(`🛤️ Start: (${segment.start.x}, ${segment.start.y}), End: (${segment.end.x}, ${segment.end.y})`);
    
    floor.position.set(floorCenter.x, -cubeSize * 0.01, floorCenter.y);
    
    // Rotate floor to be horizontal (XZ plane)
    floor.rotation.x = -Math.PI / 2;
    
    // Calculate Y rotation based on hallway direction
    // We need to map 2D direction to 3D rotation around Y axis
    let rotationY = Math.atan2(direction.y, direction.x);
    
    // Special handling for different directions to ensure floors are right-side up
    if (Math.abs(direction.x) > Math.abs(direction.y)) {
      // Horizontal hallway (left/right dominant)
      if (direction.x < 0) {
        // Going left - add 180° to flip
        rotationY += Math.PI;
      }
    } else {
      // Vertical hallway (up/down dominant)  
      if (direction.y < 0) {
        // Going down (center hallway) - apply specific rotations
        floor.rotation.z = Math.PI / 2;  // 90° in Z
        rotationY += Math.PI / 2;        // Additional 90° in Y
      }
    }
    
    floor.rotation.y = rotationY;
    
    console.log(`🛤️ Floor rotation: x=${floor.rotation.x.toFixed(2)}, y=${floor.rotation.y.toFixed(2)} (${(rotationY * 180 / Math.PI).toFixed(1)}°)`);
    
    floor.name = 'HallwayFloor';
    segmentGroup.add(floor);

    // Render walls along both sides
    const numCubes = Math.ceil(length / cubeSize);
    const wallOffset = segment.width / 2;

    // Left wall
    for (let i = 0; i < numCubes; i++) {
      const t = (i + 0.5) / numCubes;
      const wallPos = new THREE.Vector2(
        segment.start.x + direction.x * length * t,
        segment.start.y + direction.y * length * t
      );
      
      const leftWallPos = new THREE.Vector2(
        wallPos.x + perpendicular.x * wallOffset,
        wallPos.y + perpendicular.y * wallOffset
      );

      for (let y = 0; y < hallwayHeight; y++) {
        const cube = new THREE.Mesh(cubeGeometry, wallMaterial);
        cube.position.set(
          leftWallPos.x,
          (y * cubeSize) + (cubeSize / 2),
          leftWallPos.y
        );
        cube.name = `LeftWall_${segment.id}_${i}_${y}`;
        segmentGroup.add(cube);
      }
    }

    // Right wall
    for (let i = 0; i < numCubes; i++) {
      const t = (i + 0.5) / numCubes;
      const wallPos = new THREE.Vector2(
        segment.start.x + direction.x * length * t,
        segment.start.y + direction.y * length * t
      );
      
      const rightWallPos = new THREE.Vector2(
        wallPos.x - perpendicular.x * wallOffset,
        wallPos.y - perpendicular.y * wallOffset
      );

      for (let y = 0; y < hallwayHeight; y++) {
        const cube = new THREE.Mesh(cubeGeometry, wallMaterial);
        cube.position.set(
          rightWallPos.x,
          (y * cubeSize) + (cubeSize / 2),
          rightWallPos.y
        );
        cube.name = `RightWall_${segment.id}_${i}_${y}`;
        segmentGroup.add(cube);
      }
    }

    return segmentGroup;
  }

  /**
   * Renders a hallway intersection
   */
  private static renderIntersection(
    intersection: HallwayIntersection,
    cubeSize: number,
    hallwayHeight: number,
    wallColor: number,
    floorColor: number
  ): THREE.Group {
    const intersectionGroup = new THREE.Group();
    intersectionGroup.name = `Intersection_${intersection.id}`;

    const floorMaterial = new THREE.MeshLambertMaterial({ color: floorColor });
    const wallMaterial = new THREE.MeshLambertMaterial({ color: wallColor });
    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);

    // Render circular floor for intersection
    const floorRadius = intersection.radius + cubeSize;
    const floorGeometry = new THREE.CircleGeometry(floorRadius, 16);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    
    floor.position.set(intersection.position.x, -cubeSize * 0.01, intersection.position.y);
    // Rotate floor to be horizontal (XZ plane)
    floor.rotation.x = -Math.PI / 2;
    floor.name = 'IntersectionFloor';
    intersectionGroup.add(floor);

    // For now, skip adding intersection walls - let the hallway segments handle wall continuity
    // The intersection detection in renderHallwaySegment should prevent overlapping walls
    // TODO: Add sophisticated corner wall logic based on connected segment directions

    return intersectionGroup;
  }

  /**
   * Renders a dead-end hallway
   */
  private static renderDeadEnd(
    deadEndPos: THREE.Vector2,
    index: number,
    cubeSize: number,
    hallwayHeight: number,
    wallColor: number,
    floorColor: number
  ): THREE.Group {
    const deadEndGroup = new THREE.Group();
    deadEndGroup.name = `DeadEnd_${index}`;

    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const wallMaterial = new THREE.MeshLambertMaterial({ color: wallColor });
    const floorMaterial = new THREE.MeshLambertMaterial({ color: floorColor });

    // Create a small circular area for the dead end
    const deadEndRadius = 2;
    
    // Floor
    const floorGeometry = new THREE.CircleGeometry(deadEndRadius, 8);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.set(deadEndPos.x, -cubeSize * 0.01, deadEndPos.y);
    // Rotate floor to be horizontal (XZ plane)
    floor.rotation.x = -Math.PI / 2;
    floor.name = 'DeadEndFloor';
    deadEndGroup.add(floor);

    // Create walls around the dead end
    const wallRadius = deadEndRadius + cubeSize / 2;
    const numWallCubes = 8;
    
    for (let i = 0; i < numWallCubes; i++) {
      const angle = (i / numWallCubes) * Math.PI * 2;
      const wallX = deadEndPos.x + Math.cos(angle) * wallRadius;
      const wallZ = deadEndPos.y + Math.sin(angle) * wallRadius;
      
      for (let y = 0; y < hallwayHeight; y++) {
        const cube = new THREE.Mesh(cubeGeometry, wallMaterial);
        cube.position.set(
          wallX,
          (y * cubeSize) + (cubeSize / 2),
          wallZ
        );
        cube.name = `DeadEndWall_${index}_${i}_${y}`;
        deadEndGroup.add(cube);
      }
    }

    return deadEndGroup;
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
  }
}
