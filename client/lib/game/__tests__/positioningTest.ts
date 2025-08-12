/**
 * Ultra-simple positioning test - just analyze the coordinate generation
 * without involving the complex renderer system
 */

// Simple test to check positioning logic
async function testSimplePositioning() {
  console.log('🎯 Testing Simple Positioning Logic...');
  
  try {
    const { FloorGenerator } = require('../generators/floorGenerator');
    
    // Test 1: Parent room with center hallway
    const testCase1 = {
      "dungeonDagNodeName": "Test1",
      "nodes": [
        {
          "_id": "root",
          "name": "Root",
          "children": ["Hall"],
          "isRoom": true,
          "roomWidth": 8,
          "roomHeight": 6
        },
        {
          "_id": "hall",
          "name": "Hall",
          "children": [],
          "isRoom": false,
          "hallwayLength": 4,
          "parentDirection": "center",
          "parentDoorOffset": 4
        }
      ]
    };
    
    console.log('\n1️⃣ Test Case: Parent Room (8x6) + Center Hallway (length 4)');
    
    const layout1 = FloorGenerator.processServerResponse(testCase1);
    
    console.log('📊 Generated Layout:');
    console.log(`   Rooms: ${layout1.rooms?.length || 0}`);
    console.log(`   Hallways: ${layout1.hallways?.length || 0}`);
    
    if (layout1.rooms && layout1.rooms.length > 0) {
      const room = layout1.rooms[0];
      console.log(`   Room "${room.name}": position(${room.position.x}, ${room.position.y}) size(${room.width}x${room.height})`);
    }
    
    if (layout1.hallways && layout1.hallways.length > 0) {
      const hallway = layout1.hallways[0];
      console.log(`   Hallway "${hallway.name}": start(${hallway.startPosition?.x}, ${hallway.startPosition?.y}) end(${hallway.endPosition?.x}, ${hallway.endPosition?.y})`);
    }
    
    // Test basic overlap detection
    console.log('\n🔍 Manual Overlap Analysis:');
    
    if (layout1.rooms && layout1.hallways && layout1.rooms.length > 0 && layout1.hallways.length > 0) {
      const room = layout1.rooms[0];
      const hallway = layout1.hallways[0];
      
      // Room boundaries
      const roomMinX = room.position.x;
      const roomMaxX = room.position.x + room.width - 1;
      const roomMinY = room.position.y;
      const roomMaxY = room.position.y + room.height - 1;
      
      console.log(`   Room bounds: X(${roomMinX} to ${roomMaxX}) Y(${roomMinY} to ${roomMaxY})`);
      
      // Hallway path (assuming vertical for center direction)
      if (hallway.startPosition && hallway.endPosition) {
        const hallMinX = Math.min(hallway.startPosition.x, hallway.endPosition.x);
        const hallMaxX = Math.max(hallway.startPosition.x, hallway.endPosition.x);
        const hallMinY = Math.min(hallway.startPosition.y, hallway.endPosition.y);
        const hallMaxY = Math.max(hallway.startPosition.y, hallway.endPosition.y);
        
        console.log(`   Hallway bounds: X(${hallMinX} to ${hallMaxX}) Y(${hallMinY} to ${hallMaxY})`);
        
        // Check for overlap
        const xOverlap = !(roomMaxX < hallMinX || hallMaxX < roomMinX);
        const yOverlap = !(roomMaxY < hallMinY || hallMaxY < roomMinY);
        const hasOverlap = xOverlap && yOverlap;
        
        console.log(`   X overlap: ${xOverlap}, Y overlap: ${yOverlap}`);
        console.log(`   Overall overlap: ${hasOverlap ? '❌ YES' : '✅ NO'}`);
        
        // Check adjacency (distance between closest points)
        const xDistance = Math.max(0, Math.max(roomMinX - hallMaxX, hallMinX - roomMaxX));
        const xDistanceAlternate = Math.max(0, Math.max(hallMinX - roomMaxX, roomMinX - hallMaxX));
        const yDistance = Math.max(0, Math.max(roomMinY - hallMaxY, hallMinY - roomMaxY));
        const yDistanceAlternate = Math.max(0, Math.max(hallMinY - roomMaxY, roomMinY - hallMaxY));
        
        const minDistance = Math.min(xDistance + yDistanceAlternate, yDistance + xDistanceAlternate);
        console.log(`   Minimum distance: ${minDistance}`);
        console.log(`   Connection status: ${minDistance === 0 ? '🔗 TOUCHING' : minDistance === 1 ? '📏 ADJACENT' : '❌ GAP'}`);
      }
    }
    
    // Test different direction scenarios
    console.log('\n2️⃣ Testing Different Directions:');
    
    const directions = ['center', 'left', 'right'];
    
    for (const direction of directions) {
      console.log(`\n   🧭 Testing direction: ${direction}`);
      
      const testCase = {
        "dungeonDagNodeName": `Test_${direction}`,
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
            "parentDirection": direction,
            "parentDoorOffset": 2
          }
        ]
      };
      
      const layout = FloorGenerator.processServerResponse(testCase);
      
      if (layout.rooms && layout.hallways && layout.rooms.length > 0 && layout.hallways.length > 0) {
        const room = layout.rooms[0];
        const hallway = layout.hallways[0];
        
        console.log(`      Room: (${room.position.x}, ${room.position.y}) ${room.width}x${room.height}`);
        console.log(`      Hallway: start(${hallway.startPosition?.x}, ${hallway.startPosition?.y}) end(${hallway.endPosition?.x}, ${hallway.endPosition?.y})`);
        
        // Quick analysis of where the hallway is relative to room
        if (hallway.startPosition) {
          const startX = hallway.startPosition.x;
          const startY = hallway.startPosition.y;
          const roomCenterX = room.position.x + room.width / 2;
          const roomCenterY = room.position.y + room.height / 2;
          
          let relativePosition = '';
          if (startX < room.position.x) relativePosition += 'West ';
          if (startX >= room.position.x + room.width) relativePosition += 'East ';
          if (startY < room.position.y) relativePosition += 'South ';
          if (startY >= room.position.y + room.height) relativePosition += 'North ';
          
          console.log(`      Relative position: ${relativePosition || 'Inside/Edge'}`);
        }
      }
    }
    
    console.log('\n✅ Positioning analysis complete!');
    
  } catch (error) {
    console.error('❌ Positioning test failed:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
if (require.main === module) {
  testSimplePositioning().catch(console.error);
}

export { testSimplePositioning };
