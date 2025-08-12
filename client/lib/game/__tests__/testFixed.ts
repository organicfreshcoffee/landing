import { DungeonFloorTests } from './dungeonFloorTests';

/**
 * Test the complex DAG with fixed positioning logic
 */
async function testComplexDagFixed() {
  console.log('🧪 Running Complex DAG Test with Fixed Positioning...');
  
  try {
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
      overlaps: connectionResult.analysis?.overlaps?.length || 0,
      distance: connectionResult.analysis?.closestDistance || 'N/A'
    });
    
    console.log('\n🔍 Testing Specific Connection: A_AA -> A_AAA');
    const connectionResult2 = DungeonFloorTests.testSpecificConnections('A_AA', 'A_AAA');
    console.log('Connection Test Result:', {
      success: connectionResult2.success,
      message: connectionResult2.message,
      overlaps: connectionResult2.analysis?.overlaps?.length || 0,
      distance: connectionResult2.analysis?.closestDistance || 'N/A'
    });
    
    // Overall assessment
    const allPassed = overlapResult.success && continuityResult.success && connectionResult.success && connectionResult2.success;
    
    console.log('\n🎯 Overall Assessment:');
    console.log(`   Overlap Test: ${overlapResult.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Continuity Test: ${continuityResult.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Connection A_A->A_AA: ${connectionResult.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Connection A_AA->A_AAA: ${connectionResult2.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   OVERALL: ${allPassed ? '🎉 ALL TESTS PASS!' : '❌ Some tests failed'}`);
    
    if (allPassed) {
      console.log('\n🎊 Success! The dungeon floor generation now:');
      console.log('   ✅ Has no overlaps between parent-child nodes');
      console.log('   ✅ Maintains continuity between connected areas');
      console.log('   ✅ Positions hallways correctly relative to rooms');
      console.log('   ✅ Creates a walkable, continuous floor layout');
    }
    
    console.log('\n✅ Complex DAG test complete!');
    
  } catch (error) {
    console.error('❌ Complex DAG test failed:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
testComplexDagFixed().catch(console.error);
