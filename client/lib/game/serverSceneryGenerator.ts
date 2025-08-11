import * as THREE from 'three';
import { ServerFloorGenerator, ServerFloorLayout } from './serverFloorGenerator';
import { ServerHallwayGenerator } from './serverHallwayGenerator';
import { RoomRenderer } from './roomRenderer';
import { HallwayRenderer } from './hallwayRenderer';

export interface ServerSceneryOptions {
  cubeSize?: number;
  roomHeight?: number;
  hallwayHeight?: number;
  wallColor?: number;
  floorColor?: number;
  hallwayWallColor?: number;
  hallwayFloorColor?: number;
}

export class ServerSceneryGenerator {
  /**
   * Generates a complete floor layout using server data
   * @param scene - The Three.js scene to add the floor to
   * @param serverAddress - The game server address to fetch data from
   * @param dungeonDagNodeName - The floor identifier from the server
   * @param options - Configuration options for rendering
   */
  static async generateServerFloor(
    scene: THREE.Scene,
    serverAddress: string,
    dungeonDagNodeName: string,
    options: ServerSceneryOptions = {}
  ): Promise<{
    floorLayout: ServerFloorLayout;
    hallwayNetwork: any;
    roomGroups: THREE.Group[];
    hallwayGroup: THREE.Group;
  }> {
    const {
      cubeSize = 1,
      roomHeight = 5,
      hallwayHeight = 5,
      wallColor = 0xcccccc,
      floorColor = 0x666666,
      hallwayWallColor = 0x888888,
      hallwayFloorColor = 0x444444
    } = options;

    console.log(`Starting server floor generation for: ${dungeonDagNodeName}`);

    console.log(`🏰 ServerSceneryGenerator: Starting floor generation for ${dungeonDagNodeName} from ${serverAddress}`);

    try {
      // Step 1: Get floor layout from server
      console.log(`📡 ServerSceneryGenerator: Fetching floor layout...`);
      const floorLayout = await ServerFloorGenerator.getFloorLayout(serverAddress, dungeonDagNodeName);

      // 2-LEVEL DEEP: Filter to root + children + grandchildren
      const rootNode = floorLayout.nodeMap.get(floorLayout.rootNode);
      const immediateChildren = rootNode ? rootNode.children : [];
      
      // Get grandchildren (children of immediate children)
      const grandchildren: string[] = [];
      immediateChildren.forEach(childId => {
        const childNode = floorLayout.nodeMap.get(childId);
        if (childNode) {
          grandchildren.push(...childNode.children);
        }
      });
      
      // Combine all nodes to render (root + children + grandchildren)
      const nodesToRender = [floorLayout.rootNode, ...immediateChildren, ...grandchildren];
      
      console.log(`🎯 2-Level Deep: Root: ${floorLayout.rootNode}`);
      console.log(`🎯 Children: [${immediateChildren.join(', ')}]`);
      console.log(`🎯 Grandchildren: [${grandchildren.join(', ')}]`);
      console.log(`🎯 Total nodes to render: ${nodesToRender.length}`);
      
      const roomsToRender = floorLayout.rooms.filter(room => 
        nodesToRender.includes(room.id)
      );
      
      const hallwaysToRender = floorLayout.hallways.filter(hallway =>
        nodesToRender.includes(hallway.id)
      );

      console.log(`🎯 Rendering ${roomsToRender.length} rooms and ${hallwaysToRender.length} hallways (2 levels deep)`);

      // Step 2: Generate hallway network based on filtered nodes
      const filteredLayout = {
        ...floorLayout,
        rooms: roomsToRender,
        hallways: hallwaysToRender
      };
      
      console.log(`📊 Layout summary before hallway generation:`);
      filteredLayout.hallways.forEach(h => {
        console.log(`  Hallway ${h.id}: parentDirection=${h.parentDirection}, parentDoorOffset=${h.parentDoorOffset}, length=${h.length}`);
        console.log(`    Start: ${h.startPosition ? `(${h.startPosition.x}, ${h.startPosition.y})` : 'not set'}`);
        console.log(`    End: ${h.endPosition ? `(${h.endPosition.x}, ${h.endPosition.y})` : 'not set'}`);
        console.log(`    Segments: ${h.segments ? h.segments.length : 0}`);
      });
      
      const hallwayNetwork = ServerHallwayGenerator.generateHallwayNetwork(
        filteredLayout,
        3 // hallway width
      );

      // Step 3: Render filtered rooms (2 levels deep)
      const roomGroups: THREE.Group[] = [];
      roomsToRender.forEach((room) => {
        console.log(`🏠 Rendering room: ${room.id} at (${room.position.x}, ${room.position.y})`);
        
        // Convert server room to renderable shape
        const shape = this.convertServerRoomToShape(room, filteredLayout);
        const roomGroup = RoomRenderer.renderRoom(scene, shape, {
          cubeSize,
          roomHeight,
          wallColor,
          floorColor,
          position: new THREE.Vector3(room.position.x, 0, room.position.y)
        });
        
        // Add stairs if present
        if (room.hasUpwardStair && room.stairLocationX !== undefined && room.stairLocationY !== undefined) {
          this.addStaircase(roomGroup, room.stairLocationX, room.stairLocationY, roomHeight, 'up');
        }
        if (room.hasDownwardStair && room.stairLocationX !== undefined && room.stairLocationY !== undefined) {
          this.addStaircase(roomGroup, room.stairLocationX, room.stairLocationY, roomHeight, 'down');
        }
        
        roomGroups.push(roomGroup);
      });

      // Step 4: Render hallway network
      const hallwayGroup = HallwayRenderer.renderHallwayNetwork(scene, hallwayNetwork, {
        cubeSize,
        hallwayHeight,
        wallColor: hallwayWallColor,
        floorColor: hallwayFloorColor
      });

      console.log(`Server floor generation finished for: ${dungeonDagNodeName}`);
      console.log(`2-Level Deep: Generated ${roomsToRender.length} rooms and ${hallwayNetwork.segments.length} hallway segments`);

      return {
        floorLayout: filteredLayout,
        hallwayNetwork,
        roomGroups,
        hallwayGroup
      };
    } catch (error) {
      console.error('Error generating server floor:', error);
      throw error;
    }
  }

  /**
   * Converts a server room to a shape format compatible with RoomRenderer
   */
  private static convertServerRoomToShape(room: any, floorLayout: ServerFloorLayout) {
    const halfWidth = room.width / 2;
    const halfHeight = room.height / 2;

    // Create rectangular vertices (centered at origin)
    const vertices = [
      new THREE.Vector2(-halfWidth, -halfHeight), // Bottom-left
      new THREE.Vector2(halfWidth, -halfHeight),  // Bottom-right
      new THREE.Vector2(halfWidth, halfHeight),   // Top-right
      new THREE.Vector2(-halfWidth, halfHeight)   // Top-left
    ];

    // Create edges
    const edges = [
      { start: vertices[0], end: vertices[1], length: room.width },   // Bottom
      { start: vertices[1], end: vertices[2], length: room.height },  // Right
      { start: vertices[2], end: vertices[3], length: room.width },   // Top
      { start: vertices[3], end: vertices[0], length: room.height }   // Left
    ];

    // Generate doors based on server data and hierarchy
    const doors = [];
    console.log(`🚪 Generating doors for room ${room.id} (${room.width}x${room.height})`);
    console.log(`🚪 Room children: [${room.children.join(', ')}]`);
    console.log(`🚪 Room parentDirection: ${room.parentDirection}, parentDoorOffset: ${room.parentDoorOffset}`);
    console.log(`🚪 Is root room: ${room.id === floorLayout.rootNode}`);
    
    // For each child hallway, create a door
    room.children.forEach((childId: string) => {
      const childHallway = floorLayout.nodeMap.get(childId);
      console.log(`🚪 Processing child ${childId}:`, childHallway ? 'found' : 'NOT FOUND');
      
      if (childHallway && 'length' in childHallway) { // It's a hallway
        console.log(`🚪 Child hallway ${childId}: parentDirection=${childHallway.parentDirection}, parentDoorOffset=${childHallway.parentDoorOffset}`);
        
        const doorInfo = this.calculateDoorPosition(
          room, 
          childHallway.parentDirection || "center", 
          childHallway.parentDoorOffset || room.width / 2,
          room.id === floorLayout.rootNode // Pass isRootRoom flag
        );
        
        doors.push({
          edgeIndex: doorInfo.edgeIndex,
          position: doorInfo.position,
          width: 3, // Increased from 2 to 3 for wider door
          connectionType: 'child',
          connectedTo: childId
        });
        
        console.log(`✅ Added child door: edge ${doorInfo.edgeIndex}, position ${doorInfo.position} for ${childId}`);
      } else if (childHallway) {
        console.log(`🚪 Child ${childId} is a room, not a hallway - skipping door`);
      }
    });
    
    // For non-root rooms, also add a door for the parent connection
    if (room.id !== floorLayout.rootNode && room.parentDirection !== undefined && room.parentDoorOffset !== undefined) {
      console.log(`🚪 Adding parent door: parentDirection=${room.parentDirection}, parentDoorOffset=${room.parentDoorOffset}`);
      
      const parentDoorInfo = this.calculateDoorPosition(
        room, 
        room.parentDirection, 
        room.parentDoorOffset,
        false // Parent doors are never on root room
      );
      
      doors.push({
        edgeIndex: parentDoorInfo.edgeIndex,
        position: parentDoorInfo.position,
        width: 3, // Increased from 2 to 3 for wider door
        connectionType: 'parent',
        connectedTo: 'parent'
      });
      
      console.log(`🚪 Added parent door: edge ${parentDoorInfo.edgeIndex}, position ${parentDoorInfo.position}`);
    }
    
    console.log(`🚪 Total doors for room ${room.id}: ${doors.length}`);

    return {
      vertices,
      edges,
      doors,
      shapeType: 'rectangle' as const,
      width: room.width,
      height: room.height
    };
  }

  /**
   * Calculates door position based on parentDirection and parentDoorOffset
   * For a rectangular room:
   * - parentDirection determines which side of the room the door is on relative to the entry direction
   * - parentDoorOffset is the distance along that side from the start of the edge
   */
  private static calculateDoorPosition(
    room: any, 
    parentDirection: "left" | "right" | "center", 
    parentDoorOffset: number,
    isRootRoom: boolean = false
  ): { edgeIndex: number; position: number } {
    let edgeIndex = 0;
    let position = 0.5;
    
    if (isRootRoom) {
      // For root room, use the original logic - doors are placed where children connect
      switch (parentDirection) {
        case "center":
          // Center means bottom edge for root room
          edgeIndex = 0; // Bottom edge
          position = Math.max(0.1, Math.min(0.9, parentDoorOffset / room.width));
          break;
          
        case "left":
          // Left side - use left edge
          edgeIndex = 3; // Left edge  
          position = Math.max(0.1, Math.min(0.9, parentDoorOffset / room.height));
          break;
          
        case "right":
          // Right side - use right edge
          edgeIndex = 1; // Right edge
          position = Math.max(0.1, Math.min(0.9, parentDoorOffset / room.height));
          break;
      }
    } else {
      // For child rooms, doors face back toward parent
      switch (parentDirection) {
        case "center":
          // Child is below parent (center/down), door faces up toward parent
          edgeIndex = 2; // Top edge
          position = Math.max(0.1, Math.min(0.9, parentDoorOffset / room.width));
          break;
          
        case "left":
          // Child is to the LEFT of parent, door faces RIGHT toward parent
          edgeIndex = 1; // Right edge  
          position = Math.max(0.1, Math.min(0.9, parentDoorOffset / room.height));
          break;
          
        case "right":
          // Child is to the RIGHT of parent, door faces LEFT toward parent
          edgeIndex = 3; // Left edge
          position = Math.max(0.1, Math.min(0.9, parentDoorOffset / room.height));
          break;
      }
    }
    
    console.log(`🚪 Door calc (${isRootRoom ? 'ROOT' : 'CHILD'}): ${parentDirection} -> edge ${edgeIndex}, offset ${parentDoorOffset} -> position ${position}`);
    return { edgeIndex, position };
  }

  /**
   * Adds a staircase to a room
   */
  private static addStaircase(
    roomGroup: THREE.Group,
    x: number,
    y: number,
    roomHeight: number,
    direction: 'up' | 'down'
  ): void {
    // Create a simple staircase representation
    const stairGeometry = new THREE.BoxGeometry(2, roomHeight * 0.8, 2);
    const stairMaterial = new THREE.MeshLambertMaterial({ 
      color: direction === 'up' ? 0x00ff00 : 0xff0000 // Green for up, red for down
    });
    const staircase = new THREE.Mesh(stairGeometry, stairMaterial);
    
    staircase.position.set(x, roomHeight * 0.4, y);
    staircase.castShadow = true;
    staircase.receiveShadow = true;
    
    roomGroup.add(staircase);
    
    // Add a label for debugging
    console.log(`Added ${direction} staircase at (${x}, ${y})`);
  }

  /**
   * Clear all scenery from the scene while preserving important objects
   */
  static clearScene(scene: THREE.Scene): void {
    const objectsToRemove: THREE.Object3D[] = [];
    
    scene.traverse((child) => {
      // Preserve essential objects: scene, cameras, lights, and player models
      if (child !== scene && 
          child.type !== 'Camera' && 
          child.type !== 'Light' &&
          child.type !== 'AmbientLight' &&
          child.type !== 'DirectionalLight' &&
          child.type !== 'PointLight' &&
          child.type !== 'HemisphereLight' &&
          !child.userData.isPlayer) { // Preserve objects marked as players
        objectsToRemove.push(child);
      }
    });
    
    console.log(`🧹 Clearing ${objectsToRemove.length} scenery objects while preserving players and lighting`);
    
    objectsToRemove.forEach((obj) => {
      scene.remove(obj);
      // Dispose of geometries and materials to prevent memory leaks
      if ('geometry' in obj) {
        (obj as any).geometry?.dispose();
      }
      if ('material' in obj) {
        const material = (obj as any).material;
        if (Array.isArray(material)) {
          material.forEach((mat) => mat?.dispose());
        } else {
          material?.dispose();
        }
      }
    });
  }

  /**
   * Get the spawn location for new players
   */
  static async getSpawnLocation(serverAddress: string): Promise<string> {
    console.log(`🎯 ServerSceneryGenerator: Getting spawn location from ${serverAddress}`);
    return await ServerFloorGenerator.getSpawnLocation(serverAddress);
  }

  /**
   * Notify server that player moved to a new floor
   */
  static async notifyPlayerMovedFloor(serverAddress: string, newFloorName: string): Promise<void> {
    return await ServerFloorGenerator.notifyPlayerMovedFloor(serverAddress, newFloorName);
  }
}
