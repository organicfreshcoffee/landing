import * as THREE from 'three';
import { DungeonFloorTests } from './dungeonFloorTests';

// Mock the DungeonApi since we're testing with local data
jest.mock('../network/dungeonApi', () => ({
  DungeonApi: {
    getFloorLayout: jest.fn().mockRejectedValue(new Error('Mocked to use fallback'))
  }
}));

describe('Dungeon Floor Generation and Rendering Tests', () => {
  beforeEach(() => {
    // Clear any existing Three.js state
    jest.clearAllMocks();
  });

  describe('Parent-Child Overlap Tests', () => {
    test('should have no overlaps between parents and immediate children', () => {
      const result = DungeonFloorTests.testNoParentChildOverlaps();
      
      expect(result.success).toBe(true);
      expect(result.overlaps).toHaveLength(0);
      
      if (!result.success) {
        console.error('Overlap details:', result.overlaps);
        result.overlaps.forEach(overlap => {
          console.error(`Overlap between ${overlap.parentName} and ${overlap.childName}:`, overlap.overlapCoords);
        });
      }
    });

    test('should provide detailed overlap information when overlaps exist', () => {
      const result = DungeonFloorTests.testNoParentChildOverlaps();
      
      // The result should always have a meaningful message
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      
      // If there are overlaps, they should be well-documented
      if (result.overlaps.length > 0) {
        result.overlaps.forEach(overlap => {
          expect(overlap.parentName).toBeDefined();
          expect(overlap.childName).toBeDefined();
          expect(overlap.overlapCoords).toBeDefined();
          expect(Array.isArray(overlap.overlapCoords)).toBe(true);
        });
      }
    });
  });

  describe('Parent-Child Continuity Tests', () => {
    test('should have continuous walkable paths between parents and immediate children', () => {
      const result = DungeonFloorTests.testParentChildContinuity();
      
      expect(result.success).toBe(true);
      expect(result.gaps).toHaveLength(0);
      
      if (!result.success) {
        console.error('Gap details:', result.gaps);
        result.gaps.forEach(gap => {
          console.error(`Gap between ${gap.parentName} and ${gap.childName}: distance ${gap.gapDistance}`);
          console.error('Connection points:', gap.connectionPoints);
        });
      }
    });

    test('should identify gaps with precise distance measurements', () => {
      const result = DungeonFloorTests.testParentChildContinuity();
      
      // All gaps should have valid distance measurements
      result.gaps.forEach(gap => {
        expect(gap.gapDistance).toBeGreaterThan(1);
        expect(gap.connectionPoints.parent).toBeDefined();
        expect(gap.connectionPoints.child).toBeDefined();
        expect(typeof gap.connectionPoints.parent.x).toBe('number');
        expect(typeof gap.connectionPoints.parent.y).toBe('number');
        expect(typeof gap.connectionPoints.child.x).toBe('number');
        expect(typeof gap.connectionPoints.child.y).toBe('number');
      });
    });
  });

  describe('Specific Connection Tests', () => {
    test('root room A_A should connect properly to hallway A_AA', () => {
      const result = DungeonFloorTests.testSpecificConnections('A_A', 'A_AA');
      
      expect(result.success).toBe(true);
      expect(result.analysis.overlaps).toHaveLength(0);
      expect(result.analysis.closestDistance).toBeLessThanOrEqual(1);
      
      // Should have actual coordinates
      expect(result.analysis.parentCoords.length).toBeGreaterThan(0);
      expect(result.analysis.childCoords.length).toBeGreaterThan(0);
    });

    test('root room A_A should connect properly to hallway A_AB', () => {
      const result = DungeonFloorTests.testSpecificConnections('A_A', 'A_AB');
      
      expect(result.success).toBe(true);
      expect(result.analysis.overlaps).toHaveLength(0);
      expect(result.analysis.closestDistance).toBeLessThanOrEqual(1);
    });

    test('hallway A_AA should connect properly to room A_AAA', () => {
      const result = DungeonFloorTests.testSpecificConnections('A_AA', 'A_AAA');
      
      expect(result.success).toBe(true);
      expect(result.analysis.overlaps).toHaveLength(0);
      expect(result.analysis.closestDistance).toBeLessThanOrEqual(1);
    });

    test('room A_AAA should connect properly to both its children', () => {
      const leftResult = DungeonFloorTests.testSpecificConnections('A_AAA', 'A_AAAA');
      const rightResult = DungeonFloorTests.testSpecificConnections('A_AAA', 'A_AAAB');
      
      expect(leftResult.success).toBe(true);
      expect(rightResult.success).toBe(true);
      
      // Both should have no overlaps and be continuous
      expect(leftResult.analysis.overlaps).toHaveLength(0);
      expect(rightResult.analysis.overlaps).toHaveLength(0);
      expect(leftResult.analysis.closestDistance).toBeLessThanOrEqual(1);
      expect(rightResult.analysis.closestDistance).toBeLessThanOrEqual(1);
    });

    test('should fail gracefully for non-existent connections', () => {
      const result = DungeonFloorTests.testSpecificConnections('NonExistent', 'AlsoNonExistent');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('failed');
    });
  });

  describe('Comprehensive Test Suite', () => {
    test('should pass all tests for the complete dungeon floor', () => {
      const results = DungeonFloorTests.runAllTests();
      
      expect(results.overallSuccess).toBe(true);
      expect(results.results.overlapTest.success).toBe(true);
      expect(results.results.continuityTest.success).toBe(true);
      
      // All specific tests should pass
      results.results.specificTests.forEach((test, index) => {
        expect(test.success).toBe(true);
      });
      
      // Summary should indicate success
      expect(results.summary).toContain('✅ PASS');
      expect(results.summary).toContain('All tests passed');
    });

    test('should provide detailed failure information if any test fails', () => {
      const results = DungeonFloorTests.runAllTests();
      
      // Even if tests pass, the structure should be correct for failures
      expect(results.summary).toBeDefined();
      expect(results.results.overlapTest.message).toBeDefined();
      expect(results.results.continuityTest.message).toBeDefined();
      
      if (!results.overallSuccess) {
        console.log('Detailed failure analysis:');
        console.log(results.summary);
        
        if (!results.results.overlapTest.success) {
          console.log('Overlap failures:', results.results.overlapTest.overlaps);
        }
        
        if (!results.results.continuityTest.success) {
          console.log('Continuity failures:', results.results.continuityTest.gaps);
        }
        
        results.results.specificTests.forEach((test, index) => {
          if (!test.success) {
            console.log(`Specific test ${index} failed:`, test.message);
          }
        });
      }
    });
  });

  describe('Coordinate Analysis Tests', () => {
    test('should generate valid coordinates for all rooms', () => {
      const results = DungeonFloorTests.runAllTests();
      
      // All specific tests should have generated valid coordinates
      results.results.specificTests.forEach((test) => {
        if (test.success) {
          expect(test.analysis.parentCoords.length).toBeGreaterThan(0);
          expect(test.analysis.childCoords.length).toBeGreaterThan(0);
          
          // All coordinates should have valid x,y values
          test.analysis.parentCoords.forEach(coord => {
            expect(typeof coord.x).toBe('number');
            expect(typeof coord.y).toBe('number');
            expect(Number.isInteger(coord.x)).toBe(true);
            expect(Number.isInteger(coord.y)).toBe(true);
          });
          
          test.analysis.childCoords.forEach(coord => {
            expect(typeof coord.x).toBe('number');
            expect(typeof coord.y).toBe('number');
            expect(Number.isInteger(coord.x)).toBe(true);
            expect(Number.isInteger(coord.y)).toBe(true);
          });
        }
      });
    });

    test('should calculate distances correctly', () => {
      const result = DungeonFloorTests.testSpecificConnections('A_A', 'A_AA');
      
      if (result.success) {
        const distance = result.analysis.closestDistance;
        expect(typeof distance).toBe('number');
        expect(distance).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(distance)).toBe(true);
        
        // For a valid connection, distance should be 0 (overlap) or 1 (adjacent)
        expect(distance).toBeLessThanOrEqual(1);
      }
    });
  });
});
