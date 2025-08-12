import { FloorGenerator } from '../generators/floorGenerator';

// Test specific overlap scenarios to understand the issue
const complexDagData = {
  "_id": "A",
  "name": "A_A",
  "dagNodeType": "room",
  "isRoom": true,
  "roomWidth": 16,
  "roomHeight": 14,
  "hasUpwardStair": false,
  "hasDownwardStair": false,
  "children": [
    {
      "_id": "A_A_to_A_AA",
      "name": "A_AA",
      "dagNodeType": "hallway",
      "isRoom": false,
      "hallwayLength": 29,
      "parentDirection": "center",
      "parentDoorOffset": 0,
      "children": [
        {
          "_id": "A_AA_to_A_AAA",
          "name": "A_AAA",
          "dagNodeType": "room",
          "isRoom": true,
          "roomWidth": 8,
          "roomHeight": 20,
          "hasUpwardStair": false,
          "hasDownwardStair": false,
          "parentDirection": "center",
          "parentDoorOffset": 0,
          "children": []
        }
      ]
    }
  ]
};

console.log('🧪 Testing A_A -> A_AA -> A_AAA chain...');

// Process just this chain
const dagData = {
  dungeonDagNodeName: "A",
  nodes: [complexDagData]
};
const layout = FloorGenerator.processServerResponse(dagData);

console.log('\n📊 Layout Analysis:');
console.log(`   Rooms: ${layout.rooms.length}`);
console.log(`   Hallways: ${layout.hallways.length}`);

// Print detailed coordinates
layout.rooms.forEach((room: any) => {
  console.log(`   Room ${room.name}: (${room.position.x}, ${room.position.y}) ${room.width}x${room.height}`);
  console.log(`      Bounds: x=${room.position.x}-${room.position.x + room.width - 1}, y=${room.position.y}-${room.position.y + room.height - 1}`);
});

layout.hallways.forEach((hallway: any) => {
  console.log(`   Hallway ${hallway.name}: start(${hallway.startPosition.x}, ${hallway.startPosition.y}) -> end(${hallway.endPosition.x}, ${hallway.endPosition.y})`);
  console.log(`      Length: ${hallway.length}, Direction: (${hallway.direction.x}, ${hallway.direction.y})`);
});

// Manual overlap check
console.log('\n🔍 Manual Overlap Analysis:');

// Check A_AA hallway vs A_AAA room
const hallway_AA = layout.hallways.find((h: any) => h.name === 'A_AA')!;
const room_AAA = layout.rooms.find((r: any) => r.name === 'A_AAA')!

console.log(`\n   A_AA Hallway Analysis:`);
console.log(`      Start: (${hallway_AA.startPosition.x}, ${hallway_AA.startPosition.y})`);
console.log(`      End: (${hallway_AA.endPosition.x}, ${hallway_AA.endPosition.y})`);
console.log(`      Direction: (${hallway_AA.direction.x}, ${hallway_AA.direction.y})`);
console.log(`      Length: ${hallway_AA.length}`);

// Calculate hallway path manually
const hallwayCoords: Array<{x: number, y: number}> = [];
for (let i = 0; i < hallway_AA.length; i++) {
  const x = hallway_AA.startPosition.x + (hallway_AA.direction.x * i);
  const y = hallway_AA.startPosition.y + (hallway_AA.direction.y * i);
  hallwayCoords.push({x, y});
}

console.log(`      Path coordinates: ${hallwayCoords.slice(0, 5).map(c => `(${c.x},${c.y})`).join(', ')}...`);
console.log(`      Last few: ...${hallwayCoords.slice(-5).map(c => `(${c.x},${c.y})`).join(', ')}`);

console.log(`\n   A_AAA Room Analysis:`);
console.log(`      Position: (${room_AAA.position.x}, ${room_AAA.position.y})`);
console.log(`      Size: ${room_AAA.width}x${room_AAA.height}`);
console.log(`      Bounds: x=${room_AAA.position.x}-${room_AAA.position.x + room_AAA.width - 1}, y=${room_AAA.position.y}-${room_AAA.position.y + room_AAA.height - 1}`);

// Check for overlaps
const roomCoords: Array<{x: number, y: number}> = [];
for (let x = room_AAA.position.x; x < room_AAA.position.x + room_AAA.width; x++) {
  for (let y = room_AAA.position.y; y < room_AAA.position.y + room_AAA.height; y++) {
    roomCoords.push({x, y});
  }
}

const overlaps = hallwayCoords.filter(hCoord => 
  roomCoords.some(rCoord => rCoord.x === hCoord.x && rCoord.y === hCoord.y)
);

console.log(`\n   Overlap Analysis:`);
console.log(`      Hallway coordinates: ${hallwayCoords.length}`);
console.log(`      Room coordinates: ${roomCoords.length}`);
console.log(`      Overlapping coordinates: ${overlaps.length}`);

if (overlaps.length > 0) {
  console.log(`      First 5 overlaps: ${overlaps.slice(0, 5).map(c => `(${c.x},${c.y})`).join(', ')}`);
  
  // Find the connection point
  const lastHallwayCoord = hallwayCoords[hallwayCoords.length - 1];
  const firstRoomEdge = {
    x: room_AAA.position.x,
    y: room_AAA.position.y
  };
  
  console.log(`      Hallway end: (${lastHallwayCoord.x}, ${lastHallwayCoord.y})`);
  console.log(`      Room start: (${firstRoomEdge.x}, ${firstRoomEdge.y})`);
  console.log(`      Distance: ${Math.abs(lastHallwayCoord.x - firstRoomEdge.x) + Math.abs(lastHallwayCoord.y - firstRoomEdge.y)}`);
} else {
  console.log(`      ✅ No overlaps detected`);
}
