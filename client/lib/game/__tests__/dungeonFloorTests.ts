import * as THREE from 'three';
import { FloorGenerator, DungeonDagData } from '../generators/floorGenerator';
import { DungeonFloorRenderer } from '../rendering/dungeonFloorRenderer';
import { RoomRenderer } from '../rendering/roomRenderer';
import { HallwayRenderer } from '../rendering/hallwayRenderer';
import { CubeFloorRenderer, CubePosition } from '../rendering/cubeFloorRenderer';
import { ServerRoom, ServerHallway, ServerFloorLayout } from '../types/generator';

/**
 * Test suite for dungeon floor generation and rendering
 */
export class DungeonFloorTests {
  private static mockServerData: DungeonDagData = {
    "dungeonDagNodeName": "A",
    "nodes": [
      {
        "_id": "689a5c3269c66969a4da16fe",
        "name": "A_A",
        "dungeonDagNodeName": "A",
        "children": ["A_AA", "A_AB"],
        "isRoom": true,
        "hasUpwardStair": true,
        "hasDownwardStair": false,
        "roomWidth": 16,
        "roomHeight": 14
      },
      {
        "_id": "689a5c3269c66969a4da16ff",
        "name": "A_AA",
        "dungeonDagNodeName": "A",
        "children": ["A_AAA"],
        "isRoom": false,
        "hallwayLength": 28,
        "parentDirection": "center",
        "parentDoorOffset": 1
      },
      {
        "_id": "689a5c3269c66969a4da1700",
        "name": "A_AB",
        "dungeonDagNodeName": "A",
        "children": [],
        "isRoom": false,
        "hallwayLength": 21,
        "parentDirection": "right",
        "parentDoorOffset": 8
      },
      {
        "_id": "689a5c3269c66969a4da1701",
        "name": "A_AAA",
        "dungeonDagNodeName": "A",
        "children": ["A_AAAA", "A_AAAB"],
        "isRoom": true,
        "hasUpwardStair": false,
        "hasDownwardStair": true,
        "roomWidth": 8,
        "roomHeight": 20,
        "parentDoorOffset": 3,
        "parentDirection": "center",
        "stairLocationX": 0,
        "stairLocationY": 8
      },
      {
        "_id": "689a5c3269c66969a4da1702",
        "name": "A_AAAA",
        "dungeonDagNodeName": "A",
        "children": ["A_AAAAA"],
        "isRoom": false,
        "hallwayLength": 29,
        "parentDirection": "left",
        "parentDoorOffset": 6
      },
      {
        "_id": "689a5c3269c66969a4da1703",
        "name": "A_AAAB",
        "dungeonDagNodeName": "A",
        "children": [],
        "isRoom": false,
        "hallwayLength": 29,
        "parentDirection": "right",
        "parentDoorOffset": 4
      },
      {
        "_id": "689a5c3269c66969a4da1704",
        "name": "A_AAAAA",
        "dungeonDagNodeName": "A",
        "children": ["A_AAAAAA", "A_AAAAAB", "A_AAAAAC"],
        "isRoom": false,
        "hallwayLength": 27,
        "parentDirection": "right"
      },
      {
        "_id": "689a5c3269c66969a4da1705",
        "name": "A_AAAAAA",
        "dungeonDagNodeName": "A",
        "children": ["A_AAAAAAA", "A_AAAAAAB"],
        "isRoom": true,
        "hasUpwardStair": false,
        "hasDownwardStair": false,
        "roomWidth": 13,
        "roomHeight": 19,
        "parentDoorOffset": 5,
        "parentDirection": "left"
      },
      {
        "_id": "689a5c3269c66969a4da1706",
        "name": "A_AAAAAB",
        "dungeonDagNodeName": "A",
        "children": [],
        "isRoom": true,
        "hasUpwardStair": false,
        "hasDownwardStair": true,
        "roomWidth": 9,
        "roomHeight": 10,
        "parentDoorOffset": 2,
        "parentDirection": "center",
        "stairLocationX": 4,
        "stairLocationY": 9
      },
      {
        "_id": "689a5c3269c66969a4da1707",
        "name": "A_AAAAAC",
        "dungeonDagNodeName": "A",
        "children": [],
        "isRoom": true,
        "hasUpwardStair": false,
        "hasDownwardStair": false,
        "roomWidth": 9,
        "roomHeight": 16,
        "parentDoorOffset": 1,
        "parentDirection": "center"
      },
      {
        "_id": "689a5c3269c66969a4da1708",
        "name": "A_AAAAAAA",
        "dungeonDagNodeName": "A",
        "children": ["A_AAAAAAAA", "A_AAAAAAAB"],
        "isRoom": false,
        "hallwayLength": 25,
        "parentDirection": "left",
        "parentDoorOffset": 9
      },
      {
        "_id": "689a5c3269c66969a4da1709",
        "name": "A_AAAAAAB",
        "dungeonDagNodeName": "A",
        "children": [],
        "isRoom": false,
        "hallwayLength": 23,
        "parentDirection": "center",
        "parentDoorOffset": 10
      },
      {
        "_id": "689a5c3269c66969a4da170a",
        "name": "A_AAAAAAAA",
        "dungeonDagNodeName": "A",
        "children": ["A_AAAAAAAAA"],
        "isRoom": true,
        "hasUpwardStair": false,
        "hasDownwardStair": false,
        "roomWidth": 12,
        "roomHeight": 15,
        "parentDoorOffset": 5,
        "parentDirection": "center"
      },
      {
        "_id": "689a5c3269c66969a4da170b",
        "name": "A_AAAAAAAB",
        "dungeonDagNodeName": "A",
        "children": [],
        "isRoom": false,
        "hallwayLength": 15,
        "parentDirection": "right"
      },
      {
        "_id": "689a5c3269c66969a4da170c",
        "name": "A_AAAAAAAAA",
        "dungeonDagNodeName": "A",
        "children": ["A_AAAAAAAAAA", "A_AAAAAAAAAB"],
        "isRoom": false,
        "hallwayLength": 21,
        "parentDirection": "right",
        "parentDoorOffset": 6
      },
      {
        "_id": "689a5c3269c66969a4da170d",
        "name": "A_AAAAAAAAAA",
        "dungeonDagNodeName": "A",
        "children": ["A_AAAAAAAAAAA", "A_AAAAAAAAAAB", "A_AAAAAAAAAAC"],
        "isRoom": true,
        "hasUpwardStair": false,
        "hasDownwardStair": false,
        "roomWidth": 18,
        "roomHeight": 15,
        "parentDoorOffset": 7,
        "parentDirection": "center"
      },
      {
        "_id": "689a5c3269c66969a4da170e",
        "name": "A_AAAAAAAAAB",
        "dungeonDagNodeName": "A",
        "children": [],
        "isRoom": false,
        "hallwayLength": 27,
        "parentDirection": "right"
      },
      {
        "_id": "689a5c3269c66969a4da170f",
        "name": "A_AAAAAAAAAAA",
        "dungeonDagNodeName": "A",
        "children": ["A_AAAAAAAAAAAA"],
        "isRoom": false,
        "hallwayLength": 26,
        "parentDirection": "left",
        "parentDoorOffset": 10
      },
      {
        "_id": "689a5c3269c66969a4da1710",
        "name": "A_AAAAAAAAAAB",
        "dungeonDagNodeName": "A",
        "children": [],
        "isRoom": false,
        "hallwayLength": 29,
        "parentDirection": "left",
        "parentDoorOffset": 11
      },
      {
        "_id": "689a5c3269c66969a4da1711",
        "name": "A_AAAAAAAAAAC",
        "dungeonDagNodeName": "A",
        "children": [],
        "isRoom": false,
        "hallwayLength": 24,
        "parentDirection": "left",
        "parentDoorOffset": 5
      },
      {
        "_id": "689a5c3269c66969a4da1712",
        "name": "A_AAAAAAAAAAAA",
        "dungeonDagNodeName": "A",
        "children": [],
        "isRoom": true,
        "hasUpwardStair": false,
        "hasDownwardStair": false,
        "roomWidth": 9,
        "roomHeight": 20,
        "parentDoorOffset": 4,
        "parentDirection": "left"
      }
    ]
  };

  /**
   * Test that no parent and immediate child overlap
   */
  static testNoParentChildOverlaps(): {
    success: boolean;
    overlaps: Array<{
      parentName: string;
      childName: string;
      overlapCoords: CubePosition[];
    }>;
    message: string;
  } {
    console.log(`🧪 Testing: No Parent-Child Overlaps`);
    
    try {
      // Generate floor layout
      const layout = FloorGenerator.processServerResponse(this.mockServerData);
      const scene = new THREE.Scene();
      
      // Clear any existing cube registrations
      CubeFloorRenderer.clearRegistry();
      
      // Render the complete floor
      const result = DungeonFloorRenderer.renderDungeonFloorFromLayout(scene, layout, {
        cubeSize: 1,
        roomColor: 0x0080ff,
        hallwayColor: 0xff0000,
        yOffset: 0,
        hallwayWidth: 2,
        showDoors: true,
        showStairs: false,
        showDebug: false
      });
      
      const overlaps: Array<{
        parentName: string;
        childName: string;
        overlapCoords: CubePosition[];
      }> = [];
      
      // Check each parent-child relationship
      for (const parent of [...layout.rooms, ...layout.hallways]) {
        for (const childName of parent.children) {
          const child = layout.nodeMap.get(childName);
          if (!child) continue;
          
          // Get coordinates for parent and child
          const parentCoords = this.getNodeCoordinates(parent, layout);
          const childCoords = this.getNodeCoordinates(child, layout);
          
          // Find overlapping coordinates
          const overlapCoords = this.findOverlappingCoordinates(parentCoords, childCoords);
          
          if (overlapCoords.length > 0) {
            overlaps.push({
              parentName: parent.name,
              childName: childName,
              overlapCoords
            });
            
            console.error(`❌ Overlap found between ${parent.name} and ${childName}:`, overlapCoords);
          }
        }
      }
      
      const success = overlaps.length === 0;
      const message = success 
        ? `✅ No overlaps found between ${layout.rooms.length + layout.hallways.length} nodes`
        : `❌ Found ${overlaps.length} parent-child overlaps`;
      
      console.log(message);
      return { success, overlaps, message };
      
    } catch (error) {
      console.error(`❌ Test failed with error:`, error);
      return {
        success: false,
        overlaps: [],
        message: `Test failed: ${error}`
      };
    }
  }

  /**
   * Test that parents and immediate children form continuous walkable paths
   */
  static testParentChildContinuity(): {
    success: boolean;
    gaps: Array<{
      parentName: string;
      childName: string;
      gapDistance: number;
      connectionPoints: {
        parent: CubePosition;
        child: CubePosition;
      };
    }>;
    message: string;
  } {
    console.log(`🧪 Testing: Parent-Child Continuity`);
    
    try {
      // Generate floor layout
      const layout = FloorGenerator.processServerResponse(this.mockServerData);
      const scene = new THREE.Scene();
      
      CubeFloorRenderer.clearRegistry();
      
      const result = DungeonFloorRenderer.renderDungeonFloorFromLayout(scene, layout, {
        cubeSize: 1,
        roomColor: 0x0080ff,
        hallwayColor: 0xff0000,
        yOffset: 0,
        hallwayWidth: 2,
        showDoors: true,
        showStairs: false,
        showDebug: false
      });
      
      const gaps: Array<{
        parentName: string;
        childName: string;
        gapDistance: number;
        connectionPoints: {
          parent: CubePosition;
          child: CubePosition;
        };
      }> = [];
      
      // Check each parent-child relationship for continuity
      for (const parent of [...layout.rooms, ...layout.hallways]) {
        for (const childName of parent.children) {
          const child = layout.nodeMap.get(childName);
          if (!child) continue;
          
          // Get coordinates for parent and child
          const parentCoords = this.getNodeCoordinates(parent, layout);
          const childCoords = this.getNodeCoordinates(child, layout);
          
          // Find closest connection points
          const connectionAnalysis = this.analyzeConnection(parent, child, parentCoords, childCoords);
          
          if (connectionAnalysis.gapDistance > 1) {
            gaps.push({
              parentName: parent.name,
              childName: childName,
              gapDistance: connectionAnalysis.gapDistance,
              connectionPoints: connectionAnalysis.connectionPoints
            });
            
            console.error(`❌ Gap found between ${parent.name} and ${childName}: distance ${connectionAnalysis.gapDistance}`);
          } else if (connectionAnalysis.gapDistance === 1) {
            console.log(`✅ Adjacent connection between ${parent.name} and ${childName}`);
          } else {
            console.log(`✅ Overlapping connection between ${parent.name} and ${childName}`);
          }
        }
      }
      
      const success = gaps.length === 0;
      const message = success 
        ? `✅ All parent-child connections are continuous`
        : `❌ Found ${gaps.length} gaps in parent-child connections`;
      
      console.log(message);
      return { success, gaps, message };
      
    } catch (error) {
      console.error(`❌ Test failed with error:`, error);
      return {
        success: false,
        gaps: [],
        message: `Test failed: ${error}`
      };
    }
  }

  /**
   * Test specific parent-child pairs for detailed analysis
   */
  static testSpecificConnections(
    parentName: string, 
    childName: string
  ): {
    success: boolean;
    analysis: {
      parentCoords: CubePosition[];
      childCoords: CubePosition[];
      overlaps: CubePosition[];
      closestDistance: number;
      connectionPoints: {
        parent: CubePosition;
        child: CubePosition;
      };
    };
    message: string;
  } {
    console.log(`🧪 Testing Specific Connection: ${parentName} -> ${childName}`);
    
    try {
      const layout = FloorGenerator.processServerResponse(this.mockServerData);
      const scene = new THREE.Scene();
      
      CubeFloorRenderer.clearRegistry();
      
      const result = DungeonFloorRenderer.renderDungeonFloorFromLayout(scene, layout, {
        cubeSize: 1,
        roomColor: 0x0080ff,
        hallwayColor: 0xff0000,
        yOffset: 0,
        hallwayWidth: 2,
        showDoors: true,
        showStairs: false,
        showDebug: false
      });
      
      // Find the specific nodes
      const parent = [...layout.rooms, ...layout.hallways].find(n => n.name === parentName);
      const child = layout.nodeMap.get(childName);
      
      if (!parent || !child) {
        throw new Error(`Could not find parent ${parentName} or child ${childName}`);
      }
      
      const parentCoords = this.getNodeCoordinates(parent, layout);
      const childCoords = this.getNodeCoordinates(child, layout);
      const overlaps = this.findOverlappingCoordinates(parentCoords, childCoords);
      const connectionAnalysis = this.analyzeConnection(parent, child, parentCoords, childCoords);
      
      console.log(`📊 Analysis for ${parentName} -> ${childName}:`);
      console.log(`   Parent coordinates: ${parentCoords.length}`);
      console.log(`   Child coordinates: ${childCoords.length}`);
      console.log(`   Overlaps: ${overlaps.length}`);
      console.log(`   Closest distance: ${connectionAnalysis.gapDistance}`);
      console.log(`   Connection points:`, connectionAnalysis.connectionPoints);
      
      const success = overlaps.length === 0 && connectionAnalysis.gapDistance <= 1;
      const message = success 
        ? `✅ Connection is valid (no overlaps, continuous)`
        : `❌ Connection has issues: ${overlaps.length} overlaps, distance ${connectionAnalysis.gapDistance}`;
      
      return {
        success,
        analysis: {
          parentCoords,
          childCoords,
          overlaps,
          closestDistance: connectionAnalysis.gapDistance,
          connectionPoints: connectionAnalysis.connectionPoints
        },
        message
      };
      
    } catch (error) {
      console.error(`❌ Test failed with error:`, error);
      return {
        success: false,
        analysis: {
          parentCoords: [],
          childCoords: [],
          overlaps: [],
          closestDistance: Infinity,
          connectionPoints: { parent: { x: 0, y: 0 }, child: { x: 0, y: 0 } }
        },
        message: `Test failed: ${error}`
      };
    }
  }

  /**
   * Run all tests and provide a comprehensive report
   */
  static runAllTests(): {
    overallSuccess: boolean;
    results: {
      overlapTest: ReturnType<typeof DungeonFloorTests.testNoParentChildOverlaps>;
      continuityTest: ReturnType<typeof DungeonFloorTests.testParentChildContinuity>;
      specificTests: Array<ReturnType<typeof DungeonFloorTests.testSpecificConnections>>;
    };
    summary: string;
  } {
    console.log(`🧪 Running Complete Dungeon Floor Test Suite`);
    console.log(`📋 Test Data: ${this.mockServerData.nodes.length} nodes`);
    
    const overlapTest = this.testNoParentChildOverlaps();
    const continuityTest = this.testParentChildContinuity();
    
    // Test some specific connections
    const specificTests = [
      this.testSpecificConnections("A_A", "A_AA"),
      this.testSpecificConnections("A_A", "A_AB"),
      this.testSpecificConnections("A_AA", "A_AAA"),
      this.testSpecificConnections("A_AAA", "A_AAAA"),
      this.testSpecificConnections("A_AAA", "A_AAAB")
    ];
    
    const overallSuccess = overlapTest.success && continuityTest.success && 
                          specificTests.every(test => test.success);
    
    const summary = `
🧪 DUNGEON FLOOR TEST SUMMARY
==============================
Overall Result: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}

Overlap Test: ${overlapTest.success ? '✅ PASS' : '❌ FAIL'}
- ${overlapTest.message}

Continuity Test: ${continuityTest.success ? '✅ PASS' : '❌ FAIL'}
- ${continuityTest.message}

Specific Connection Tests: ${specificTests.filter(t => t.success).length}/${specificTests.length} passed

${overallSuccess ? 
  '🎉 All tests passed! The dungeon floor generates correctly with no overlaps and continuous connections.' :
  '⚠️  Some tests failed. Check the detailed results for issues to fix.'}
`;
    
    console.log(summary);
    
    return {
      overallSuccess,
      results: {
        overlapTest,
        continuityTest,
        specificTests
      },
      summary
    };
  }

  // Helper methods

  /**
   * Get coordinates for a node (room or hallway)
   */
  private static getNodeCoordinates(
    node: ServerRoom | ServerHallway, 
    layout: ServerFloorLayout
  ): CubePosition[] {
    if ('width' in node) {
      // It's a room
      return RoomRenderer.getRoomArea(node);
    } else {
      // It's a hallway - we need to generate its coordinates
      const scene = new THREE.Scene();
      CubeFloorRenderer.clearRegistry();
      const coords = HallwayRenderer.renderHallway(scene, node, {
        cubeSize: 1,
        hallwayColor: 0xff0000,
        width: 2
      });
      return coords;
    }
  }

  /**
   * Find overlapping coordinates between two sets
   */
  private static findOverlappingCoordinates(
    coords1: CubePosition[], 
    coords2: CubePosition[]
  ): CubePosition[] {
    const overlaps: CubePosition[] = [];
    const coords2Set = new Set(coords2.map(c => `${c.x},${c.y}`));
    
    for (const coord of coords1) {
      if (coords2Set.has(`${coord.x},${coord.y}`)) {
        overlaps.push(coord);
      }
    }
    
    return overlaps;
  }

  /**
   * Analyze connection between parent and child
   */
  private static analyzeConnection(
    parent: ServerRoom | ServerHallway,
    child: ServerRoom | ServerHallway,
    parentCoords: CubePosition[],
    childCoords: CubePosition[]
  ): {
    gapDistance: number;
    connectionPoints: {
      parent: CubePosition;
      child: CubePosition;
    };
  } {
    let minDistance = Infinity;
    let closestParent: CubePosition = { x: 0, y: 0 };
    let closestChild: CubePosition = { x: 0, y: 0 };
    
    // Find the closest points between parent and child
    for (const pCoord of parentCoords) {
      for (const cCoord of childCoords) {
        const distance = Math.sqrt(
          Math.pow(pCoord.x - cCoord.x, 2) + Math.pow(pCoord.y - cCoord.y, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestParent = pCoord;
          closestChild = cCoord;
        }
      }
    }
    
    return {
      gapDistance: minDistance,
      connectionPoints: {
        parent: closestParent,
        child: closestChild
      }
    };
  }
}
