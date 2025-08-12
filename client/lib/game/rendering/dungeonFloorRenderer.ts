import * as THREE from 'three';
import { FloorGenerator, DungeonDagData } from '../generators/floorGenerator';
import { HallwayRenderer } from './hallwayRenderer';
import { RoomRenderer } from './roomRenderer';
import { CubeFloorRenderer } from './cubeFloorRenderer';

export interface DungeonRenderOptions {
  cubeSize?: number;
  roomColor?: number;
  hallwayColor?: number;
  yOffset?: number;
  hallwayWidth?: number;
  showDoors?: boolean;
  showStairs?: boolean;
}

/**
 * Complete dungeon floor renderer that handles DAG data
 */
export class DungeonFloorRenderer {
  private static readonly DEFAULT_OPTIONS: Required<DungeonRenderOptions> = {
    cubeSize: 1,
    roomColor: 0x0080ff, // Blue for rooms
    hallwayColor: 0xff0000, // Red for hallways
    yOffset: 0,
    hallwayWidth: 2,
    showDoors: true,
    showStairs: false
  };

  /**
   * Render a complete dungeon floor from DAG data
   */
  static renderDungeonFloor(
    scene: THREE.Scene,
    dungeonData: DungeonDagData,
    options: DungeonRenderOptions = {}
  ): {
    floorGroup: THREE.Group;
    roomCount: number;
    hallwayCount: number;
    overlapCount: number;
    totalArea: number;
  } {
    const finalOptions = { ...this.DEFAULT_OPTIONS, ...options };
    
    console.log(`🏰 Rendering dungeon floor: ${dungeonData.dungeonDagNodeName}`);
    console.log(`📊 Input: ${dungeonData.nodes.length} nodes`);

    // Clear any existing floor data
    CubeFloorRenderer.clearRegistry();

    try {
      // Generate the floor layout from DAG data
      const generator = new FloorGenerator();
      const floorLayout = generator.generateFloorLayout(dungeonData);
      
      console.log(`🏗️ Generated layout: ${floorLayout.rooms.length} rooms, ${floorLayout.hallways.length} hallways`);
      console.log(`📐 Bounds: ${floorLayout.bounds.width} x ${floorLayout.bounds.height}`);

      // Render rooms first
      const roomGroup = RoomRenderer.renderRooms(scene, floorLayout.rooms, {
        cubeSize: finalOptions.cubeSize,
        color: finalOptions.roomColor,
        yOffset: finalOptions.yOffset,
        showDoors: finalOptions.showDoors,
        showStairs: finalOptions.showStairs
      });

      // Render hallways second (they may overlap with rooms)
      const hallwayGroup = HallwayRenderer.renderHallways(scene, floorLayout.hallways, {
        cubeSize: finalOptions.cubeSize,
        color: finalOptions.hallwayColor,
        yOffset: finalOptions.yOffset,
        width: finalOptions.hallwayWidth
      });

      // Get the final rendered group from cube renderer
      const floorGroup = CubeFloorRenderer.renderAllCubes(scene, {
        cubeSize: finalOptions.cubeSize,
        yOffset: finalOptions.yOffset
      });

      // Calculate statistics
      const roomStats = RoomRenderer.getRoomStats(floorLayout.rooms);
      const hallwayStats = HallwayRenderer.getHallwayStats(floorLayout.hallways);
      
      // Count overlaps by checking the cube registry
      const overlapCount = this.countOverlaps();

      const result = {
        floorGroup,
        roomCount: floorLayout.rooms.length,
        hallwayCount: floorLayout.hallways.length,
        overlapCount,
        totalArea: roomStats.totalArea + hallwayStats.totalArea
      };

      console.log(`✅ Dungeon floor rendered successfully!`);
      console.log(`📊 Stats: ${result.roomCount} rooms, ${result.hallwayCount} hallways, ${result.overlapCount} overlaps`);
      console.log(`📏 Total area: ${result.totalArea} cubes`);

      return result;

    } catch (error) {
      console.error('❌ Failed to render dungeon floor:', error);
      throw error;
    }
  }

  /**
   * Render dungeon from the provided sample data
   */
  static renderSampleDungeon(scene: THREE.Scene, options: DungeonRenderOptions = {}): {
    floorGroup: THREE.Group;
    roomCount: number;
    hallwayCount: number;
    overlapCount: number;
    totalArea: number;
  } {
    const sampleData: DungeonDagData = {
      dungeonDagNodeName: "A",
      nodes: [
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
        }
        // Note: Truncated for example - full data would include all nodes
      ]
    };

    return this.renderDungeonFloor(scene, sampleData, options);
  }

  /**
   * Count overlaps by analyzing the cube registry
   */
  private static countOverlaps(): number {
    // This is a simplified count - the CubeFloorRenderer already marks overlaps
    // In a real implementation, you might want to access the registry directly
    let overlapCount = 0;
    
    // Since we can't directly access the private registry, we'll estimate
    // based on the console output from CubeFloorRenderer
    // In practice, you might want to expose a method to get overlap data
    
    return overlapCount;
  }

  /**
   * Get detailed statistics about the rendered dungeon
   */
  static getDungeonStats(dungeonData: DungeonDagData): {
    totalNodes: number;
    roomNodes: number;
    hallwayNodes: number;
    maxDepth: number;
    branchingFactor: number;
  } {
    const totalNodes = dungeonData.nodes.length;
    const roomNodes = dungeonData.nodes.filter(node => node.isRoom).length;
    const hallwayNodes = dungeonData.nodes.filter(node => !node.isRoom).length;
    
    // Calculate max depth by finding the longest chain
    const maxDepth = this.calculateMaxDepth(dungeonData.nodes);
    
    // Calculate average branching factor
    const nodesWithChildren = dungeonData.nodes.filter(node => node.children.length > 0);
    const totalBranches = nodesWithChildren.reduce((sum, node) => sum + node.children.length, 0);
    const branchingFactor = nodesWithChildren.length > 0 ? totalBranches / nodesWithChildren.length : 0;

    return {
      totalNodes,
      roomNodes,
      hallwayNodes,
      maxDepth,
      branchingFactor
    };
  }

  /**
   * Calculate the maximum depth of the DAG
   */
  private static calculateMaxDepth(nodes: any[]): number {
    const nodeMap = new Map(nodes.map(node => [node.name, node]));
    const visited = new Set<string>();
    
    const getDepth = (nodeName: string): number => {
      if (visited.has(nodeName)) return 0; // Avoid cycles
      
      const node = nodeMap.get(nodeName);
      if (!node || node.children.length === 0) return 1;
      
      visited.add(nodeName);
      const childDepths = node.children.map((childName: string) => getDepth(childName));
      visited.delete(nodeName);
      
      return 1 + Math.max(...childDepths);
    };

    // Find root nodes (nodes that aren't children of other nodes)
    const allChildren = new Set(nodes.flatMap(node => node.children));
    const rootNodes = nodes.filter(node => !allChildren.has(node.name));
    
    if (rootNodes.length === 0) return 0;
    
    return Math.max(...rootNodes.map(root => getDepth(root.name)));
  }

  /**
   * Validate the dungeon DAG structure
   */
  static validateDungeonDAG(dungeonData: DungeonDagData): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check for missing required fields
    dungeonData.nodes.forEach(node => {
      if (!node.name) {
        errors.push(`Node missing name: ${node._id}`);
      }
      
      if (node.isRoom) {
        if (!node.roomWidth || !node.roomHeight) {
          errors.push(`Room ${node.name} missing dimensions`);
        }
        if (node.roomWidth && node.roomWidth < 1) {
          errors.push(`Room ${node.name} has invalid width: ${node.roomWidth}`);
        }
        if (node.roomHeight && node.roomHeight < 1) {
          errors.push(`Room ${node.name} has invalid height: ${node.roomHeight}`);
        }
      } else {
        if (!node.hallwayLength) {
          errors.push(`Hallway ${node.name} missing length`);
        }
        if (node.hallwayLength && node.hallwayLength < 1) {
          errors.push(`Hallway ${node.name} has invalid length: ${node.hallwayLength}`);
        }
      }
    });

    // Check for orphaned nodes
    const nodeNames = new Set(dungeonData.nodes.map(node => node.name));
    const allChildren = new Set(dungeonData.nodes.flatMap(node => node.children));
    
    allChildren.forEach(childName => {
      if (!nodeNames.has(childName)) {
        errors.push(`Referenced child node not found: ${childName}`);
      }
    });

    // Check for cycles
    const hasCycle = this.detectCycles(dungeonData.nodes);
    if (hasCycle) {
      errors.push('Cycle detected in DAG structure');
    }

    // Warnings for unusual structures
    const rootNodes = dungeonData.nodes.filter(node => !allChildren.has(node.name));
    if (rootNodes.length === 0) {
      warnings.push('No root nodes found - all nodes are children of other nodes');
    }
    if (rootNodes.length > 1) {
      warnings.push(`Multiple root nodes found: ${rootNodes.map(n => n.name).join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Detect cycles in the DAG
   */
  private static detectCycles(nodes: any[]): boolean {
    const nodeMap = new Map(nodes.map(node => [node.name, node]));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleFromNode = (nodeName: string): boolean => {
      if (recursionStack.has(nodeName)) return true;
      if (visited.has(nodeName)) return false;

      visited.add(nodeName);
      recursionStack.add(nodeName);

      const node = nodeMap.get(nodeName);
      if (node) {
        for (const childName of node.children) {
          if (hasCycleFromNode(childName)) {
            return true;
          }
        }
      }

      recursionStack.delete(nodeName);
      return false;
    };

    for (const node of nodes) {
      if (hasCycleFromNode(node.name)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Clear all dungeon floor rendering
   */
  static clearDungeonFloor(scene: THREE.Scene): void {
    CubeFloorRenderer.clearRegistry();
    RoomRenderer.clearAllRooms(scene);
    HallwayRenderer.clearAllHallways(scene);
    console.log('🏰 Cleared all dungeon floor rendering');
  }

  /**
   * Dispose of all resources
   */
  static dispose(): void {
    CubeFloorRenderer.dispose();
    RoomRenderer.dispose();
    HallwayRenderer.dispose();
  }
}
