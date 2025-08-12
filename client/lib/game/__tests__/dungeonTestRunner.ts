import { DungeonFloorTests } from './dungeonFloorTests';

/**
 * Browser-friendly test runner for debugging dungeon floor issues
 * Can be called from the browser console for immediate feedback
 */
export class DungeonTestRunner {
  /**
   * Run a quick test to check if the current floor generation is working
   */
  static quickTest(): void {
    console.log(`🚀 Running Quick Dungeon Floor Test...`);
    
    try {
      const overlapResult = DungeonFloorTests.testNoParentChildOverlaps();
      const continuityResult = DungeonFloorTests.testParentChildContinuity();
      
      console.log(`📊 Quick Test Results:`);
      console.log(`   Overlaps: ${overlapResult.success ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Continuity: ${continuityResult.success ? '✅ PASS' : '❌ FAIL'}`);
      
      if (!overlapResult.success) {
        console.error(`❌ Overlap Issues:`, overlapResult.overlaps);
      }
      
      if (!continuityResult.success) {
        console.error(`❌ Continuity Issues:`, continuityResult.gaps);
      }
      
      if (overlapResult.success && continuityResult.success) {
        console.log(`🎉 All quick tests passed!`);
      }
      
    } catch (error) {
      console.error(`❌ Quick test failed:`, error);
    }
  }

  /**
   * Run full test suite and log detailed results
   */
  static fullTest() {
    console.log(`🧪 Running Full Dungeon Floor Test Suite...`);
    
    try {
      const results = DungeonFloorTests.runAllTests();
      
      // Results are already logged by the test suite
      if (results.overallSuccess) {
        console.log(`🎉 All tests passed! Dungeon floor generation is working correctly.`);
      } else {
        console.error(`❌ Some tests failed. Check the detailed logs above.`);
      }
      
      return results;
      
    } catch (error) {
      console.error(`❌ Full test suite failed:`, error);
    }
  }

  /**
   * Test a specific connection and log detailed analysis
   */
  static testConnection(parentName: string, childName: string): void {
    console.log(`🔍 Testing Specific Connection: ${parentName} -> ${childName}`);
    
    try {
      const result = DungeonFloorTests.testSpecificConnections(parentName, childName);
      
      console.log(`Result: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Message: ${result.message}`);
      
      if (result.success) {
        console.log(`📊 Analysis:`);
        console.log(`   Parent coordinates: ${result.analysis.parentCoords.length}`);
        console.log(`   Child coordinates: ${result.analysis.childCoords.length}`);
        console.log(`   Overlaps: ${result.analysis.overlaps.length}`);
        console.log(`   Distance: ${result.analysis.closestDistance}`);
        console.log(`   Connection points:`, result.analysis.connectionPoints);
      } else {
        console.error(`❌ Connection failed analysis:`, result.analysis);
      }
      
    } catch (error) {
      console.error(`❌ Connection test failed:`, error);
    }
  }

  /**
   * Show all available test methods
   */
  static help(): void {
    console.log(`
🧪 Dungeon Test Runner Help
===========================

Available Methods:
- DungeonTestRunner.quickTest()      - Run basic overlap and continuity tests
- DungeonTestRunner.fullTest()       - Run complete test suite with detailed logging
- DungeonTestRunner.testConnection(parent, child) - Test specific parent-child connection
- DungeonTestRunner.help()           - Show this help message

Example Usage:
DungeonTestRunner.quickTest();
DungeonTestRunner.testConnection("A_A", "A_AA");
DungeonTestRunner.fullTest();

Available Connections to Test:
- "A_A" -> "A_AA" (root room to center hallway)
- "A_A" -> "A_AB" (root room to right hallway)  
- "A_AA" -> "A_AAA" (center hallway to room)
- "A_AAA" -> "A_AAAA" (room to left hallway)
- "A_AAA" -> "A_AAAB" (room to right hallway)
- And more... (see test data for full hierarchy)
`);
  }

  /**
   * Validate that the cube floor renderer is working correctly
   */
  static validateCubeRenderer(): void {
    console.log(`🧊 Validating Cube Floor Renderer...`);
    
    try {
      // This will use the CubeFloorRenderer directly to check coordinate generation
      const result = DungeonFloorTests.testSpecificConnections("A_A", "A_AA");
      
      if (result.success && result.analysis.parentCoords.length > 0 && result.analysis.childCoords.length > 0) {
        console.log(`✅ Cube renderer is generating coordinates correctly`);
        console.log(`   Root room (A_A): ${result.analysis.parentCoords.length} cubes`);
        console.log(`   Hallway (A_AA): ${result.analysis.childCoords.length} cubes`);
        
        // Show sample coordinates
        console.log(`   Sample root room coords:`, result.analysis.parentCoords.slice(0, 5));
        console.log(`   Sample hallway coords:`, result.analysis.childCoords.slice(0, 5));
      } else {
        console.error(`❌ Cube renderer validation failed`);
        console.error(`   Result:`, result);
      }
      
    } catch (error) {
      console.error(`❌ Cube renderer validation error:`, error);
    }
  }
}

// Make it available globally for browser console usage
if (typeof window !== 'undefined') {
  (window as any).DungeonTestRunner = DungeonTestRunner;
  console.log(`🌐 DungeonTestRunner is now available in the browser console!`);
  console.log(`📖 Type 'DungeonTestRunner.help()' for usage instructions.`);
}
