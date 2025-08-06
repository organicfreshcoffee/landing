import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { ModelLoader } from './modelLoader';

export class SceneryGenerator {
  /**
   * Generates a polygonal room with walls made of cubes
   * @param scene - The Three.js scene to add the room to
   * @param cubeSize - Size of each cube used for walls (default: 1)
   * @param roomHeight - Fixed height of the room (default: 5)
   * @param minWalls - Minimum number of walls (default: 3)
   * @param maxWalls - Maximum number of walls (default: 8)
   * @param minRadius - Minimum radius of the room (default: 8)
   * @param maxRadius - Maximum radius of the room (default: 15)
   * @param wallColor - Color of the wall cubes (default: light gray)
   * @param floorColor - Color of the floor (default: dark gray)
   */
  static generateRoom(
    scene: THREE.Scene,
    cubeSize: number = 1,
    roomHeight: number = 5,
    minWalls: number = 3,
    maxWalls: number = 8,
    minRadius: number = 8,
    maxRadius: number = 15,
    wallColor: number = 0xcccccc,
    floorColor: number = 0x666666
  ): { vertices: THREE.Vector2[]; radius: number; walls: number; height: number } {
    // Generate random room parameters
    const numWalls = Math.floor(Math.random() * (maxWalls - minWalls + 1)) + minWalls;
    const radius = Math.random() * (maxRadius - minRadius) + minRadius;
    
    // Decide if this room should be concave (50% chance)
    const shouldBeConcave = Math.random() < 0.5;
    
    // Decide if this room should have a center vertex (25% chance)
    const shouldHaveCenterVertex = Math.random() < 0.25;
    const centerVertexIndex = shouldHaveCenterVertex ? Math.floor(Math.random() * numWalls) : -1;

    // Generate vertices for the polygon
    const vertices: THREE.Vector2[] = [];
    const angleStep = (Math.PI * 2) / numWalls;
    
    for (let i = 0; i < numWalls; i++) {
      const angle = i * angleStep;
      
      let finalRadius: number;
      
      // Check if this vertex should be at the center
      if (i === centerVertexIndex) {
        finalRadius = 0; // Place vertex at center (0,0)
      } else if (shouldBeConcave) {
        // For true concave shapes, we need some vertices to be MUCH closer to center
        // Create dramatic inward indentations
        if (i % 3 === 1) {
          // Every 3rd vertex (starting from 2nd) goes way inward to create concave sections
          finalRadius = radius * (0.15 + Math.random() * 0.25); // 15-40% of radius - very inward
        } else {
          // Other vertices stay near or beyond the base radius
          const radiusVariation = Math.random() * radius * 0.3; // 0-30% outward variation
          finalRadius = radius + radiusVariation;
        }
      } else {
        // Convex shape: all vertices stay outward from center
        const radiusVariation = (Math.random() - 0.2) * radius * 0.3; // Slightly outward bias
        const vertexRadius = radius + radiusVariation;
        const minVertexRadius = radius * 0.8; // Keep vertices well away from center
        finalRadius = Math.max(vertexRadius, minVertexRadius);
      }
      
      const x = Math.cos(angle) * finalRadius;
      const z = Math.sin(angle) * finalRadius;
      vertices.push(new THREE.Vector2(x, z));
    }

    // Create cube geometry and materials
    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const wallMaterial = new THREE.MeshLambertMaterial({ color: wallColor });
    const floorMaterial = new THREE.MeshLambertMaterial({ color: floorColor });

    // Create a group to hold all room elements
    const roomGroup = new THREE.Group();
    roomGroup.name = 'CubeRoom';

    // Generate walls made of cubes first to calculate exact wall positions
    const wallsGroup = new THREE.Group();
    wallsGroup.name = 'Walls';
    
    // Store all wall cube positions for floor calculation
    const wallPositions: THREE.Vector2[] = [];

    // Build walls along each edge of the polygon
    for (let i = 0; i < vertices.length; i++) {
      const currentVertex = vertices[i];
      const nextVertex = vertices[(i + 1) % vertices.length];
      
      // Calculate wall direction and length
      const wallDirection = new THREE.Vector2(
        nextVertex.x - currentVertex.x,
        nextVertex.y - currentVertex.y
      );
      const wallLength = wallDirection.length();
      wallDirection.normalize();
      
      // Calculate number of cubes needed for this wall
      const numCubes = Math.ceil(wallLength / cubeSize);
      
      // Place cubes along the wall
      for (let cubeIndex = 0; cubeIndex < numCubes; cubeIndex++) {
        for (let y = 0; y < roomHeight; y++) {
          const cube = new THREE.Mesh(cubeGeometry, wallMaterial);
          
          // Calculate position along the wall
          const t = (cubeIndex + 0.5) / numCubes; // Center the cube
          const cubeX = currentVertex.x + wallDirection.x * wallLength * t;
          const cubeZ = currentVertex.y + wallDirection.y * wallLength * t;
          
          cube.position.set(
            cubeX,
            (y * cubeSize) + (cubeSize / 2),
            cubeZ
          );
          cube.name = `Wall_${i}_${cubeIndex}_${y}`;
          wallsGroup.add(cube);
          
          // Store wall positions for floor boundary calculation (only bottom row)
          if (y === 0) {
            wallPositions.push(new THREE.Vector2(cubeX, cubeZ));
          }
        }
      }
    }

    // Create expanded vertices for floor that extends to wall edges
    // Use actual wall positions to ensure complete coverage
    const floorVertices: THREE.Vector2[] = [];
    
    // For each wall segment, create floor vertices that extend beyond the wall cubes
    for (let i = 0; i < vertices.length; i++) {
      const currentVertex = vertices[i];
      const nextVertex = vertices[(i + 1) % vertices.length];
      
      // Calculate wall direction
      const wallDirection = new THREE.Vector2(
        nextVertex.x - currentVertex.x,
        nextVertex.y - currentVertex.y
      );
      const wallLength = wallDirection.length();
      wallDirection.normalize();
      
      // Calculate perpendicular direction (pointing outward from polygon)
      const perpendicular = new THREE.Vector2(-wallDirection.y, wallDirection.x);
      
      // Determine if we need to flip the perpendicular to point outward
      const midPoint = new THREE.Vector2(
        (currentVertex.x + nextVertex.x) / 2,
        (currentVertex.y + nextVertex.y) / 2
      );
      const toCenter = new THREE.Vector2(-midPoint.x, -midPoint.y);
      
      // If perpendicular points toward center, flip it
      if (perpendicular.dot(toCenter) > 0) {
        perpendicular.multiplyScalar(-1);
      }
      
      // Create floor vertices that extend well beyond the wall cubes
      const extension = cubeSize * 1.0; // Full cube size extension to ensure coverage
      
      const floorVertex1 = new THREE.Vector2(
        currentVertex.x + perpendicular.x * extension,
        currentVertex.y + perpendicular.y * extension
      );
      
      const floorVertex2 = new THREE.Vector2(
        nextVertex.x + perpendicular.x * extension,
        nextVertex.y + perpendicular.y * extension
      );
      
      floorVertices.push(floorVertex1);
    }
    
    // Generate floor using the extended polygon shape
    const floorShape = new THREE.Shape(floorVertices);
    const floorGeometry = new THREE.ShapeGeometry(floorShape);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    floor.position.y = -cubeSize * 0.01; // Position very slightly below wall cubes to prevent z-fighting
    floor.name = 'Floor';
    roomGroup.add(floor);

    roomGroup.add(wallsGroup);

    // Add the room to the scene
    scene.add(roomGroup);

    const shapeType = shouldHaveCenterVertex ? 'center-vertex' : (shouldBeConcave ? 'concave' : 'convex');
    console.log(`Generated ${shapeType} ${numWalls}-sided room with radius ${radius.toFixed(2)} and height ${roomHeight}`);

    return {
      vertices: vertices,
      radius: radius,
      walls: numWalls,
      height: roomHeight * cubeSize
    };
  }

  /**
   * Removes all cube rooms from the scene
   */
  static clearCubeRooms(scene: THREE.Scene): void {
    const roomsToRemove = scene.children.filter(child => child.name === 'CubeRoom');
    roomsToRemove.forEach(room => {
      scene.remove(room);
      // Dispose of geometries and materials to free memory
      room.traverse((child) => {
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
    console.log(`Removed ${roomsToRemove.length} cube room(s) from scene`);
  }
}
