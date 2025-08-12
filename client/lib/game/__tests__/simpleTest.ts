import { DungeonFloorTests } from './dungeonFloorTests';
import { runAllSimplifiedTests, runSingleTest } from './simplifiedDagTest';

/**
 * Simple Node.js test runner to debug dungeon floor generation
 * Run with: npx tsx simpleTest.ts
 */
async function runSimpleTest() {
  console.log('🧪 Running Simple Dungeon Floor Test...');
  
  try {
    // COMMENTED OUT: Complex DAG test - focusing on simplified scenarios first
    /*
    console.log('📊 Testing Parent-Child Overlaps...');
    const overlapResult = DungeonFloorTests.testNoParentChildOverlaps();
    console.log('Overlap Test Result:', {
      success: overlapResult.success,
      overlapCount: overlapResult.overlaps?.length || 0,
      message: overlapResult.message
    });
    
    if (!overlapResult.success && overlapResult.overlaps) {
      console.log('First few overlaps:', overlapResult.overlaps.slice(0, 3));
    }
    
    console.log('\n📊 Testing Parent-Child Continuity...');
    const continuityResult = DungeonFloorTests.testParentChildContinuity();
    console.log('Continuity Test Result:', {
      success: continuityResult.success,
      gapCount: continuityResult.gaps?.length || 0,
      message: continuityResult.message
    });
    
    if (!continuityResult.success && continuityResult.gaps) {
      console.log('First few gaps:', continuityResult.gaps.slice(0, 3));
    }
    
    console.log('\n🔍 Testing Specific Connection: A_A -> A_AA');
    const connectionResult = DungeonFloorTests.testSpecificConnections('A_A', 'A_AA');
    console.log('Connection Test Result:', {
      success: connectionResult.success,
      message: connectionResult.message,
      analysis: connectionResult.analysis
    });
    */
    
    // NEW: Test simplified DAG scenarios
    console.log('🎯 Testing Simplified DAG Scenarios...');
    
    // Test individual scenarios
    console.log('\n1️⃣ Testing: Parent Room with Center Hallway');
    await runSingleTest('parentRoomCenterHallway');
    
    console.log('\n2️⃣ Testing: Parent Room with Left Hallway');
    await runSingleTest('parentRoomLeftHallway');
    
    console.log('\n3️⃣ Testing: Parent Room with Right Hallway');
    await runSingleTest('parentRoomRightHallway');
    
    console.log('\n4️⃣ Testing: Parent Hallway with Child Room');
    await runSingleTest('parentHallwayChildRoom');
    
    console.log('\n5️⃣ Testing: Room -> Hallway -> Room Chain');
    await runSingleTest('roomHallwayRoom');
    
    console.log('\n✅ Simplified tests complete!');
    
  } catch (error) {
    console.error('❌ Simple test failed:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
runSimpleTest().catch(console.error);
