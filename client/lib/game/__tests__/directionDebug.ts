/**
 * Debug the direction calculation step by step
 */

async function debugDirectionCalculation() {
  console.log('🐛 Debugging Direction Calculation...');
  
  try {
    // Test simple parent room with center hallway
    const { FloorGenerator } = require('../generators/floorGenerator');
    
    // Let's manually trace through what should happen:
    console.log('\n📋 Expected Logic for Center Hallway from Room:');
    console.log('1. Room: (0,0) 6x4 (bounds: X=0-5, Y=0-3)');
    console.log('2. Child direction: "center" from room should go north');
    console.log('3. Hallway start should be at room north edge + gap');
    console.log('4. Hallway should extend northward (positive Y)');
    console.log('');
    
    // Create test case
    const testCase = {
      "dungeonDagNodeName": "DebugTest",
      "nodes": [
        {
          "_id": "root",
          "name": "Root",
          "children": ["Hall"],
          "isRoom": true,
          "roomWidth": 6,
          "roomHeight": 4
        },
        {
          "_id": "hall",
          "name": "Hall",
          "children": [],
          "isRoom": false,
          "hallwayLength": 3,
          "parentDirection": "center",
          "parentDoorOffset": 2
        }
      ]
    };
    
    // Test the absolute direction calculation manually
    console.log('🧭 Manual Direction Calculation:');
    
    // When a room is the root, what entrance direction does it have?
    // Let's assume it starts with 'south' entrance (standard default)
    const rootEntrance = 'south';
    console.log(`   Root room entrance: ${rootEntrance}`);
    
    // Child has parentDirection: "center"
    const childDirection = 'center';
    console.log(`   Child relative direction: ${childDirection}`);
    
    // Calculate absolute direction using the same logic as FloorGenerator
    const rotationMap: Record<string, Record<string, 'north' | 'south' | 'east' | 'west'>> = {
      'north': { left: 'west', right: 'east', center: 'north' },
      'south': { left: 'east', right: 'west', center: 'south' },
      'east': { left: 'north', right: 'south', center: 'east' },
      'west': { left: 'south', right: 'north', center: 'west' }
    };
    
    const absoluteDirection = rotationMap[rootEntrance][childDirection];
    console.log(`   Calculated absolute direction: ${absoluteDirection}`);
    
    // Get direction vector
    const getDirectionVector = (direction: 'north' | 'south' | 'east' | 'west') => {
      switch (direction) {
        case 'north': return { x: 0, y: 1 };
        case 'south': return { x: 0, y: -1 };
        case 'east': return { x: 1, y: 0 };
        case 'west': return { x: -1, y: 0 };
      }
    };
    
    const directionVector = getDirectionVector(absoluteDirection);
    console.log(`   Direction vector: (${directionVector.x}, ${directionVector.y})`);
    
    // Calculate child position
    const room = { position: { x: 0, y: 0 }, width: 6, height: 4 };
    const hallwayLength = 3;
    const offset = 2;
    const gap = 1;
    
    console.log('\n📍 Position Calculation:');
    console.log(`   Room: position(${room.position.x}, ${room.position.y}) size(${room.width}x${room.height})`);
    console.log(`   Offset: ${offset}, Gap: ${gap}, Length: ${hallwayLength}`);
    
    // Calculate where child should be positioned based on absolute direction
    let childPosition: { x: number; y: number };
    let childEntrance: string;
    
    switch (absoluteDirection) {
      case 'north': // Child extends north from parent
        childEntrance = 'south';
        childPosition = {
          x: room.position.x + offset,
          y: room.position.y + room.height + gap
        };
        break;
      case 'south': // Child extends south from parent
        childEntrance = 'north';
        childPosition = {
          x: room.position.x + offset,
          y: room.position.y - hallwayLength - gap
        };
        break;
      case 'east': // Child extends east from parent
        childEntrance = 'west';
        childPosition = {
          x: room.position.x + room.width + gap,
          y: room.position.y + offset
        };
        break;
      case 'west': // Child extends west from parent
        childEntrance = 'east';
        childPosition = {
          x: room.position.x - hallwayLength - gap,
          y: room.position.y + offset
        };
        break;
    }
    
    console.log(`   Child position: (${childPosition.x}, ${childPosition.y})`);
    console.log(`   Child entrance: ${childEntrance}`);
    
    // Calculate hallway end position
    const hallwayStart = childPosition;
    const hallwayEnd = {
      x: hallwayStart.x + directionVector.x * hallwayLength,
      y: hallwayStart.y + directionVector.y * hallwayLength
    };
    
    console.log(`   Hallway start: (${hallwayStart.x}, ${hallwayStart.y})`);
    console.log(`   Hallway end: (${hallwayEnd.x}, ${hallwayEnd.y})`);
    
    // Now run the actual FloorGenerator and compare
    console.log('\n🏗️ Actual FloorGenerator Result:');
    const layout = FloorGenerator.processServerResponse(testCase);
    
    if (layout.rooms && layout.hallways && layout.rooms.length > 0 && layout.hallways.length > 0) {
      const actualRoom = layout.rooms[0];
      const actualHallway = layout.hallways[0];
      
      console.log(`   Actual room: (${actualRoom.position.x}, ${actualRoom.position.y}) ${actualRoom.width}x${actualRoom.height}`);
      console.log(`   Actual hallway: start(${actualHallway.startPosition?.x}, ${actualHallway.startPosition?.y}) end(${actualHallway.endPosition?.x}, ${actualHallway.endPosition?.y})`);
      
      // Compare with our manual calculation
      const manualCorrect = 
        actualHallway.startPosition?.x === hallwayStart.x &&
        actualHallway.startPosition?.y === hallwayStart.y &&
        actualHallway.endPosition?.x === hallwayEnd.x &&
        actualHallway.endPosition?.y === hallwayEnd.y;
        
      console.log(`   Manual calculation matches: ${manualCorrect ? '✅ YES' : '❌ NO'}`);
      
      if (!manualCorrect) {
        console.log('   🔍 Differences:');
        if (actualHallway.startPosition) {
          console.log(`      Start: expected(${hallwayStart.x}, ${hallwayStart.y}) actual(${actualHallway.startPosition.x}, ${actualHallway.startPosition.y})`);
        }
        if (actualHallway.endPosition) {
          console.log(`      End: expected(${hallwayEnd.x}, ${hallwayEnd.y}) actual(${actualHallway.endPosition.x}, ${actualHallway.endPosition.y})`);
        }
      }
    }
    
    console.log('\n✅ Direction debugging complete!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the debug
if (require.main === module) {
  debugDirectionCalculation().catch(console.error);
}

export { debugDirectionCalculation };
