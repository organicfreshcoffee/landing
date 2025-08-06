import * as THREE from 'three';

export interface Room {
  id: string;
  position: THREE.Vector2;
  size: { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number };
  doorRange: { min: number; max: number };
}

export interface FloorLayout {
  rooms: Room[];
  bounds: { width: number; height: number };
  gridSize: number;
}

export class FloorGenerator {
  /**
   * Generates a random floor layout with multiple rooms
   * @param minRooms - Minimum number of rooms (default: 3)
   * @param maxRooms - Maximum number of rooms (default: 8)
   * @param floorWidth - Width of the floor area (default: 100)
   * @param floorHeight - Height of the floor area (default: 100)
   * @param minRoomRadius - Minimum room radius (default: 8)
   * @param maxRoomRadius - Maximum room radius (default: 15)
   * @param minSeparation - Minimum separation between room centers (default: 25)
   */
  static generateFloorLayout(
    minRooms: number = 3,
    maxRooms: number = 8,
    floorWidth: number = 100,
    floorHeight: number = 100,
    minRoomRadius: number = 8,
    maxRoomRadius: number = 15,
    minSeparation: number = 25
  ): FloorLayout {
    const numRooms = Math.floor(Math.random() * (maxRooms - minRooms + 1)) + minRooms;
    const rooms: Room[] = [];
    
    // Grid-based placement to ensure reasonable distribution
    const gridSize = Math.ceil(Math.sqrt(numRooms));
    const cellWidth = floorWidth / gridSize;
    const cellHeight = floorHeight / gridSize;
    
    // Generate room positions using poisson disk sampling approach
    const attempts = 0;
    const maxAttempts = numRooms * 10;
    
    for (let i = 0; i < numRooms && attempts < maxAttempts; i++) {
      let position: THREE.Vector2;
      let validPosition = false;
      let localAttempts = 0;
      
      do {
        // Try random position within bounds
        position = new THREE.Vector2(
          (Math.random() - 0.5) * floorWidth * 0.8, // Keep rooms away from edges
          (Math.random() - 0.5) * floorHeight * 0.8
        );
        
        // Check if position is far enough from existing rooms
        validPosition = rooms.every(existingRoom => {
          const distance = position.distanceTo(existingRoom.position);
          return distance >= minSeparation;
        });
        
        localAttempts++;
      } while (!validPosition && localAttempts < 50);
      
      if (validPosition) {
        // Generate room parameters with some variety
        const sizeVariation = Math.random() * 0.5 + 0.75; // 0.75 to 1.25 multiplier
        const roomMinWidth = minRoomRadius * sizeVariation;
        const roomMaxWidth = maxRoomRadius * sizeVariation;
        const roomMinHeight = minRoomRadius * sizeVariation;
        const roomMaxHeight = maxRoomRadius * sizeVariation;
        
        // Vary the number of doors per room
        const doorVariation = Math.random();
        let minDoors, maxDoors;
        if (doorVariation < 0.4) {
          minDoors = 1; maxDoors = 2; // Fewer doors
        } else if (doorVariation < 0.8) {
          minDoors = 2; maxDoors = 3; // Standard
        } else {
          minDoors = 3; maxDoors = 4; // Many doors
        }
        
        rooms.push({
          id: `room_${i}`,
          position,
          size: { minWidth: roomMinWidth, maxWidth: roomMaxWidth, minHeight: roomMinHeight, maxHeight: roomMaxHeight },
          doorRange: { min: minDoors, max: maxDoors }
        });
      }
    }
    
    console.log(`Generated floor layout with ${rooms.length} rooms`);
    
    return {
      rooms,
      bounds: { width: floorWidth, height: floorHeight },
      gridSize
    };
  }
  
  /**
   * Gets the nearest rooms to a given room (for hallway generation)
   */
  static getNearestRooms(layout: FloorLayout, roomId: string, maxDistance: number = 50): Room[] {
    const targetRoom = layout.rooms.find(r => r.id === roomId);
    if (!targetRoom) return [];
    
    return layout.rooms
      .filter(room => room.id !== roomId)
      .map(room => ({
        room,
        distance: targetRoom.position.distanceTo(room.position)
      }))
      .filter(({ distance }) => distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .map(({ room }) => room);
  }
  
  /**
   * Validates that a floor layout has reasonable room distribution
   */
  static validateLayout(layout: FloorLayout): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check minimum number of rooms
    if (layout.rooms.length < 2) {
      issues.push('Floor needs at least 2 rooms');
    }
    
    // Check for overlapping rooms
    for (let i = 0; i < layout.rooms.length; i++) {
      for (let j = i + 1; j < layout.rooms.length; j++) {
        const room1 = layout.rooms[i];
        const room2 = layout.rooms[j];
        const distance = room1.position.distanceTo(room2.position);
        // Use diagonal of rectangle as effective radius for collision detection
        const room1Radius = Math.sqrt(room1.size.maxWidth * room1.size.maxWidth + room1.size.maxHeight * room1.size.maxHeight) / 2;
        const room2Radius = Math.sqrt(room2.size.maxWidth * room2.size.maxWidth + room2.size.maxHeight * room2.size.maxHeight) / 2;
        const minDistance = (room1Radius + room2Radius) * 1.2;
        
        if (distance < minDistance) {
          issues.push(`Rooms ${room1.id} and ${room2.id} are too close`);
        }
      }
    }
    
    // Check that rooms are within bounds
    layout.rooms.forEach(room => {
      const roomRadius = Math.sqrt(room.size.maxWidth * room.size.maxWidth + room.size.maxHeight * room.size.maxHeight) / 2;
      const margin = roomRadius + 5;
      if (Math.abs(room.position.x) > layout.bounds.width / 2 - margin ||
          Math.abs(room.position.y) > layout.bounds.height / 2 - margin) {
        issues.push(`Room ${room.id} is too close to floor boundary`);
      }
    });
    
    return { valid: issues.length === 0, issues };
  }
  
  /**
   * Generates a layout ensuring all rooms can be connected
   */
  static generateConnectedLayout(
    minRooms: number = 3,
    maxRooms: number = 8,
    floorWidth: number = 100,
    floorHeight: number = 100,
    minRoomRadius: number = 8,
    maxRoomRadius: number = 15
  ): FloorLayout {
    let attempts = 0;
    let layout: FloorLayout;
    
    do {
      layout = this.generateFloorLayout(
        minRooms, maxRooms, floorWidth, floorHeight, 
        minRoomRadius, maxRoomRadius
      );
      attempts++;
    } while (!this.validateLayout(layout).valid && attempts < 10);
    
    if (attempts >= 10) {
      console.warn('Could not generate valid layout after 10 attempts, using last attempt');
    }
    
    return layout;
  }
}
