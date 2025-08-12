import { WallGenerator } from '../generators/wallGenerator';
import { CubePosition } from '../rendering/cubeFloorRenderer';

// Test wall generation around a simple floor pattern
console.log('🧪 Testing Wall Generation...');

// Create a simple 3x3 floor area
const floorCoords: CubePosition[] = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
  { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }
];

console.log(`📋 Input: ${floorCoords.length} floor coordinates`);
floorCoords.forEach(coord => {
  console.log(`   Floor at (${coord.x}, ${coord.y})`);
});

// Generate walls
const wallCoords = WallGenerator.generateWalls(floorCoords);

console.log(`🧱 Generated ${wallCoords.length} wall coordinates:`);
wallCoords.forEach(coord => {
  console.log(`   Wall at (${coord.x}, ${coord.y})`);
});

// Test wall bounds calculation
const bounds = WallGenerator.calculateWallBounds(wallCoords);
console.log(`📐 Wall bounds:`, bounds);

// Test more complex shape (L-shaped floor)
console.log('\n🧪 Testing L-shaped floor...');
const lShapeFloor: CubePosition[] = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: 2 }
];

console.log(`📋 L-shape input: ${lShapeFloor.length} floor coordinates`);
const lShapeWalls = WallGenerator.generateWalls(lShapeFloor);
console.log(`🧱 L-shape walls: ${lShapeWalls.length} wall coordinates`);

// Visualize the L-shape result
console.log('\n🎨 L-shape visualization:');
const minX = Math.min(...lShapeFloor.map(c => c.x), ...lShapeWalls.map(c => c.x));
const maxX = Math.max(...lShapeFloor.map(c => c.x), ...lShapeWalls.map(c => c.x));
const minY = Math.min(...lShapeFloor.map(c => c.y), ...lShapeWalls.map(c => c.y));
const maxY = Math.max(...lShapeFloor.map(c => c.y), ...lShapeWalls.map(c => c.y));

const floorSet = new Set(lShapeFloor.map(c => `${c.x},${c.y}`));
const wallSet = new Set(lShapeWalls.map(c => `${c.x},${c.y}`));

for (let y = maxY; y >= minY; y--) {
  let row = '';
  for (let x = minX; x <= maxX; x++) {
    const key = `${x},${y}`;
    if (floorSet.has(key)) {
      row += '🟦'; // Floor
    } else if (wallSet.has(key)) {
      row += '🧱'; // Wall
    } else {
      row += '⬜'; // Empty
    }
  }
  console.log(row);
}

console.log('\n✅ Wall generation test complete!');
