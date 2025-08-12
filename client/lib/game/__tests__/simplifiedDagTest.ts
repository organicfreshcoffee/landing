import { DungeonFloorTests } from './dungeonFloorTests';

/**
 * Test simplified DAG scenarios with just 2-3 nodes
 * Focus on basic parent-child positioning logic
 */

// Simple test scenarios
const simpleTestCases = {
  // Test 1: Parent room with center hallway child
  parentRoomCenterHallway: {
    "dungeonDagNodeName": "SimpleTest1",
    "nodes": [
      {
        "_id": "simple1_root",
        "name": "Root",
        "children": ["CenterHall"],
        "isRoom": true,
        "roomWidth": 8,
        "roomHeight": 6
      },
      {
        "_id": "simple1_hall",
        "name": "CenterHall",
        "children": [],
        "isRoom": false,
        "hallwayLength": 4,
        "parentDirection": "center",
        "parentDoorOffset": 4
      }
    ]
  },

  // Test 2: Parent room with left hallway child
  parentRoomLeftHallway: {
    "dungeonDagNodeName": "SimpleTest2",
    "nodes": [
      {
        "_id": "simple2_root",
        "name": "Root",
        "children": ["LeftHall"],
        "isRoom": true,
        "roomWidth": 8,
        "roomHeight": 6
      },
      {
        "_id": "simple2_hall",
        "name": "LeftHall",
        "children": [],
        "isRoom": false,
        "hallwayLength": 4,
        "parentDirection": "left",
        "parentDoorOffset": 2
      }
    ]
  },

  // Test 3: Parent room with right hallway child
  parentRoomRightHallway: {
    "dungeonDagNodeName": "SimpleTest3",
    "nodes": [
      {
        "_id": "simple3_root",
        "name": "Root",
        "children": ["RightHall"],
        "isRoom": true,
        "roomWidth": 8,
        "roomHeight": 6
      },
      {
        "_id": "simple3_hall",
        "name": "RightHall",
        "children": [],
        "isRoom": false,
        "hallwayLength": 4,
        "parentDirection": "right",
        "parentDoorOffset": 2
      }
    ]
  },

  // Test 4: Parent hallway with child room
  parentHallwayChildRoom: {
    "dungeonDagNodeName": "SimpleTest4",
    "nodes": [
      {
        "_id": "simple4_root",
        "name": "RootHall",
        "children": ["ChildRoom"],
        "isRoom": false,
        "hallwayLength": 6
      },
      {
        "_id": "simple4_room",
        "name": "ChildRoom",
        "children": [],
        "isRoom": true,
        "roomWidth": 6,
        "roomHeight": 8,
        "parentDirection": "center",
        "parentDoorOffset": 3
      }
    ]
  },

  // Test 5: Chain of 3 nodes: Room -> Hallway -> Room
  roomHallwayRoom: {
    "dungeonDagNodeName": "SimpleTest5",
    "nodes": [
      {
        "_id": "simple5_root",
        "name": "StartRoom",
        "children": ["MiddleHall"],
        "isRoom": true,
        "roomWidth": 6,
        "roomHeight": 4
      },
      {
        "_id": "simple5_hall",
        "name": "MiddleHall",
        "children": ["EndRoom"],
        "isRoom": false,
        "hallwayLength": 3,
        "parentDirection": "center",
        "parentDoorOffset": 3
      },
      {
        "_id": "simple5_end",
        "name": "EndRoom",
        "children": [],
        "isRoom": true,
        "roomWidth": 4,
        "roomHeight": 5,
        "parentDirection": "center",
        "parentDoorOffset": 1
      }
    ]
  }
};

/**
 * Test a specific simplified scenario
 */
function testSimplifiedScenario(testName: string, dagData: any) {
  console.log(`\n🧪 Testing Simplified Scenario: ${testName}`);
  console.log(`📋 DAG Data:`, JSON.stringify(dagData, null, 2));
  
  try {
    // Import the FloorGenerator to test with our simplified data
    const { FloorGenerator } = require('../generators/floorGenerator');
    
    // Generate layout from simplified DAG
    const layout = FloorGenerator.processServerResponse(dagData);
    console.log(`✅ Layout Generated:`, {
      rooms: layout.rooms.length,
      hallways: layout.hallways.length
    });
    
    // Show room positions
    console.log(`🏠 Room positions:`);
    layout.rooms.forEach(room => {
      console.log(`   ${room.name}: (${room.position.x}, ${room.position.y}) ${room.width}x${room.height}`);
    });
    
    // Show hallway positions
    console.log(`🛤️ Hallway positions:`);
    layout.hallways.forEach(hallway => {
      console.log(`   ${hallway.name}: start(${hallway.startPosition?.x || 'N/A'}, ${hallway.startPosition?.y || 'N/A'}) end(${hallway.endPosition?.x || 'N/A'}, ${hallway.endPosition?.y || 'N/A'}) length=${hallway.length}`);
    });
    
    // Test the layout with DungeonFloorRenderer
    const { DungeonFloorRenderer } = require('../rendering/dungeonFloorRenderer');
    
    // Create a mock scene for rendering
    const mockScene = { add: () => {}, remove: () => {} };
    
    // Render the layout
    console.log(`🎨 Rendering layout...`);
    const stats = DungeonFloorRenderer.renderDungeonFloorFromLayout(layout, mockScene);
    console.log(`📊 Render stats:`, stats);
    
    // Use CubeFloorRenderer to analyze coordinates
    const { CubeFloorRenderer } = require('../rendering/cubeFloorRenderer');
    const cubeRenderer = new CubeFloorRenderer();
    
    console.log(`🧊 Analyzing cube coordinates...`);
    
    // Analyze each parent-child relationship
    layout.rooms.forEach(room => {
      if (room.name === 'Root' || room.name === 'StartRoom' || room.name === 'RootHall') {
        // Find children
        const originalNode = dagData.nodes.find((n: any) => n.name === room.name);
        if (originalNode && originalNode.children.length > 0) {
          originalNode.children.forEach((childName: string) => {
            const childRoom = layout.rooms.find(r => r.name === childName);
            const childHallway = layout.hallways.find(h => h.name === childName);
            
            if (childRoom || childHallway) {
              console.log(`🔍 Analyzing connection: ${room.name} -> ${childName}`);
              
              // Get parent coordinates
              const parentCoords = cubeRenderer.getRoomCoordinates(
                room.position.x, room.position.y, room.width, room.height
              );
              
              let childCoords: any[] = [];
              if (childRoom) {
                childCoords = cubeRenderer.getRoomCoordinates(
                  childRoom.position.x, childRoom.position.y, childRoom.width, childRoom.height
                );
              } else if (childHallway && childHallway.segments) {
                childCoords = cubeRenderer.getHallwayCoordinates(childHallway.segments);
              }
              
              // Check for overlaps
              const overlaps = cubeRenderer.findOverlaps(parentCoords, childCoords);
              
              console.log(`   Parent coords: ${parentCoords.length}, Child coords: ${childCoords.length}`);
              console.log(`   Overlaps: ${overlaps.length}`);
              
              if (overlaps.length > 0) {
                console.log(`   ❌ Overlap coordinates:`, overlaps.slice(0, 5));
              } else {
                console.log(`   ✅ No overlaps detected`);
              }
              
              // Check distance between closest points
              let minDistance = Infinity;
              parentCoords.forEach(pCoord => {
                childCoords.forEach(cCoord => {
                  const distance = Math.abs(pCoord.x - cCoord.x) + Math.abs(pCoord.y - cCoord.y);
                  minDistance = Math.min(minDistance, distance);
                });
              });
              
              console.log(`   Closest distance: ${minDistance === Infinity ? 'N/A' : minDistance}`);
            }
          });
        }
      }
    });
    
    return { success: true, layout, stats };
    
  } catch (error) {
    console.error(`❌ Test failed:`, error);
    return { success: false, error };
  }
}

/**
 * Run all simplified tests
 */
async function runAllSimplifiedTests() {
  console.log('🚀 Running All Simplified DAG Tests...');
  
  const results: Record<string, any> = {};
  
  for (const [testName, dagData] of Object.entries(simpleTestCases)) {
    const result = testSimplifiedScenario(testName, dagData);
    results[testName] = result;
    
    // Add separator between tests
    console.log('\n' + '='.repeat(60));
  }
  
  // Summary
  console.log('\n📊 Test Summary:');
  Object.entries(results).forEach(([testName, result]) => {
    console.log(`   ${testName}: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  return results;
}

/**
 * Run just one specific test
 */
async function runSingleTest(testName: keyof typeof simpleTestCases) {
  if (!(testName in simpleTestCases)) {
    console.error(`❌ Test '${testName}' not found. Available tests:`, Object.keys(simpleTestCases));
    return;
  }
  
  return testSimplifiedScenario(testName, simpleTestCases[testName]);
}

// Export for use in other test files
export { simpleTestCases, testSimplifiedScenario, runAllSimplifiedTests, runSingleTest };

// If run directly
if (require.main === module) {
  // Comment out the complex DAG test for now
  console.log('📝 Complex DAG test commented out - focusing on simplified scenarios');
  
  // Run all simplified tests
  runAllSimplifiedTests().catch(console.error);
}
