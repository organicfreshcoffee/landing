import { DungeonFloorTests } from './dungeonFloorTests';

/**
 * Test only the immediate parent-child overlap logic
 */
async function testImmediateParentChildOverlaps() {
  console.log('🎯 Testing Immediate Parent-Child Overlaps Only...');
  
  try {
    const result = DungeonFloorTests.testNoParentChildOverlaps();
    
    console.log('📊 Test Result:', {
      success: result.success,
      overlapCount: result.overlaps.length,
      message: result.message
    });
    
    if (!result.success) {
      console.log('\n🔍 Detailed Overlap Analysis:');
      result.overlaps.forEach((overlap, index) => {
        console.log(`\n${index + 1}. ${overlap.parentName} → ${overlap.childName}`);
        console.log(`   Overlapping coordinates: ${overlap.overlapCoords.length}`);
        console.log(`   First few overlaps:`, overlap.overlapCoords.slice(0, 5));
      });
      
      // Focus on the first overlap for detailed analysis
      if (result.overlaps.length > 0) {
        const firstOverlap = result.overlaps[0];
        console.log(`\n🧐 Detailed Analysis of: ${firstOverlap.parentName} → ${firstOverlap.childName}`);
        
        // Let's manually check this specific connection
        const connectionResult = DungeonFloorTests.testSpecificConnections(
          firstOverlap.parentName, 
          firstOverlap.childName
        );
        
        console.log('Connection Analysis:', {
          success: connectionResult.success,
          message: connectionResult.message,
          parentCoords: connectionResult.analysis.parentCoords.length,
          childCoords: connectionResult.analysis.childCoords.length,
          overlaps: connectionResult.analysis.overlaps.length,
          closestDistance: connectionResult.analysis.closestDistance
        });
        
        if (connectionResult.analysis.overlaps.length > 0) {
          console.log('Sample overlap coordinates:', connectionResult.analysis.overlaps.slice(0, 3));
        }
      }
    } else {
      console.log('✅ All immediate parent-child connections are clean!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
if (require.main === module) {
  testImmediateParentChildOverlaps().catch(console.error);
}

export { testImmediateParentChildOverlaps };
