import * as THREE from 'three';
import { CubeFloorRenderer } from '../rendering/cubeFloorRenderer';

/**
 * Overlap Testing Utility - demonstrates the overlap detection system
 */
export class OverlapTestingUtility {
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Create a simple test scenario with overlapping room and hallway
   */
  public createOverlapTest(): THREE.Group {
    console.log('🧪 Creating overlap detection test...');

    // Clear any existing data
    CubeFloorRenderer.clearRegistry();

    // Test Room: 5x5 square at (0,0) to (4,4) - Blue
    const roomCoordinates = CubeFloorRenderer.getAreaCoordinates(0, 0, 4, 4);
    CubeFloorRenderer.registerCubes(roomCoordinates, 0x0066ff, 'room');
    console.log(`🟦 Registered test room: ${roomCoordinates.length} cubes`);

    // Test Hallway: horizontal line from (-2,2) to (6,2) - Red (overlaps with room)
    const hallwayCoordinates = CubeFloorRenderer.getPathCoordinates(-2, 2, 6, 2, 1);
    CubeFloorRenderer.registerCubes(hallwayCoordinates, 0xff0000, 'hallway');
    console.log(`🟥 Registered test hallway: ${hallwayCoordinates.length} cubes`);

    // Render all cubes (overlaps should be purple)
    const testGroup = CubeFloorRenderer.renderAllCubes(this.scene);
    testGroup.name = 'OverlapTest';

    this.scene.add(testGroup);
    
    console.log('✅ Overlap test created - overlapping areas should be purple');
    return testGroup;
  }

  /**
   * Create a complex test with multiple overlapping elements
   */
  public createComplexOverlapTest(): THREE.Group {
    console.log('🧪 Creating complex overlap detection test...');

    // Clear any existing data
    CubeFloorRenderer.clearRegistry();

    // Room 1: 4x4 at (0,0) to (3,3)
    const room1Coords = CubeFloorRenderer.getAreaCoordinates(0, 0, 3, 3);
    CubeFloorRenderer.registerCubes(room1Coords, 0x0066ff, 'room');

    // Room 2: 3x3 at (2,2) to (4,4) - overlaps with Room 1
    const room2Coords = CubeFloorRenderer.getAreaCoordinates(2, 2, 4, 4);
    CubeFloorRenderer.registerCubes(room2Coords, 0x0066ff, 'room');

    // Hallway 1: vertical line from (1,-1) to (1,5)
    const hallway1Coords = CubeFloorRenderer.getPathCoordinates(1, -1, 1, 5, 1);
    CubeFloorRenderer.registerCubes(hallway1Coords, 0xff0000, 'hallway');

    // Hallway 2: horizontal line from (-1,3) to (5,3)
    const hallway2Coords = CubeFloorRenderer.getPathCoordinates(-1, 3, 5, 3, 1);
    CubeFloorRenderer.registerCubes(hallway2Coords, 0xff0000, 'hallway');

    // Render all cubes
    const testGroup = CubeFloorRenderer.renderAllCubes(this.scene);
    testGroup.name = 'ComplexOverlapTest';

    this.scene.add(testGroup);
    
    console.log('✅ Complex overlap test created');
    console.log('   - Blue cubes: rooms only');
    console.log('   - Red cubes: hallways only'); 
    console.log('   - Purple cubes: overlaps');
    
    return testGroup;
  }

  /**
   * Clear all test data
   */
  public clearTests(): void {
    CubeFloorRenderer.clearRegistry();
    
    const testGroups = this.scene.children.filter(child => 
      child.name === 'OverlapTest' || child.name === 'ComplexOverlapTest'
    );
    
    testGroups.forEach(group => this.scene.remove(group));
    console.log(`🧹 Cleared ${testGroups.length} test group(s)`);
  }

  /**
   * Create a test that mimics a real dungeon layout issue
   */
  public createDungeonLayoutTest(): THREE.Group {
    console.log('🧪 Creating dungeon layout gap test...');

    // Clear any existing data
    CubeFloorRenderer.clearRegistry();

    // Simulate server room data (mimicking actual dungeon generation)
    const serverRooms = [
      { id: 'room1', position: { x: 0, y: 0 }, width: 3, height: 3 },
      { id: 'room2', position: { x: 5, y: 0 }, width: 4, height: 4 },
      { id: 'room3', position: { x: 0, y: 5 }, width: 2, height: 2 }
    ];

    const serverHallways = [
      { 
        id: 'hall1',
        segments: [
          { start: { x: 3, y: 1 }, end: { x: 5, y: 1 } }
        ]
      },
      {
        id: 'hall2', 
        segments: [
          { start: { x: 1, y: 3 }, end: { x: 1, y: 5 } }
        ]
      }
    ];

    // Register rooms
    serverRooms.forEach(room => {
      const coords = CubeFloorRenderer.getAreaCoordinates(
        room.position.x,
        room.position.y,
        room.position.x + room.width - 1,
        room.position.y + room.height - 1
      );
      CubeFloorRenderer.registerCubes(coords, 0x0066ff, 'room');
      console.log(`🏠 Room ${room.id}: ${coords.length} cubes at (${room.position.x}, ${room.position.y})`);
    });

    // Register hallways
    serverHallways.forEach(hallway => {
      hallway.segments.forEach(segment => {
        const coords = CubeFloorRenderer.getPathCoordinates(
          segment.start.x,
          segment.start.y,
          segment.end.x,
          segment.end.y,
          1
        );
        CubeFloorRenderer.registerCubes(coords, 0xff0000, 'hallway');
        console.log(`🛤️ Hallway ${hallway.id}: ${coords.length} cubes from (${segment.start.x}, ${segment.start.y}) to (${segment.end.x}, ${segment.end.y})`);
      });
    });

    // Render all cubes
    const testGroup = CubeFloorRenderer.renderAllCubes(this.scene);
    testGroup.name = 'DungeonLayoutTest';

    this.scene.add(testGroup);
    
    console.log('✅ Dungeon layout test created - check for gaps or misalignment');
    return testGroup;
  }
}
