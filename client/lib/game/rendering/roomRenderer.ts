import * as THREE from 'three';
import { ServerRoom } from '../types/generator';
import { CubeFloorRenderer } from './cubeFloorRenderer';

/**
 * Room Renderer - renders room floors using cube-based tiles with overlap detection
 */
export class RoomRenderer {
  private scene: THREE.Scene;
  private roomGroups: Map<string, THREE.Group> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Register room cubes for rendering (doesn't immediately render)
   */
  public registerRoom(room: ServerRoom): void {
    const { x, y } = room.position;
    const { width, height } = room;
    
    // Get all coordinates for this room
    const coordinates = CubeFloorRenderer.getAreaCoordinates(
      Math.round(x),
      Math.round(y),
      Math.round(x + width - 1),
      Math.round(y + height - 1)
    );
    
    // Register with blue color
    CubeFloorRenderer.registerCubes(coordinates, 0x0066ff, 'room');
    
    console.log(`🟦 Registered room ${room.id} at (${x}, ${y}) with ${coordinates.length} cubes`);
  }

  /**
   * Render room floor tiles at the room's defined position (legacy method)
   */
  public renderRoom(room: ServerRoom, color: number = 0x0066ff): THREE.Group {
    const group = new THREE.Group();
    group.name = `Room_${room.id}`;

    // Use the room's defined position for rendering
    const { x, y } = room.position;
    const { width, height } = room;
    
    // Get all coordinates for this room
    const coordinates = CubeFloorRenderer.getAreaCoordinates(
      Math.round(x),
      Math.round(y),
      Math.round(x + width - 1),
      Math.round(y + height - 1)
    );
    
    // Register and render immediately
    CubeFloorRenderer.registerCubes(coordinates, color, 'room');
    const floorGroup = CubeFloorRenderer.renderAllCubes(this.scene);
    
    group.add(floorGroup);
    
    // Store for cleanup
    this.roomGroups.set(room.id, group);
    this.scene.add(group);
    
    console.log(`🟦 Rendered room ${room.id} at (${x}, ${y}) with dimensions ${width}x${height}`);
    
    return group;
  }

  /**
   * Render room at specific world coordinates (for testing/debugging)
   */
  public renderRoomAtWorldPosition(
    x: number,
    y: number, 
    width: number = 3,
    height: number = 3,
    color: number = 0x0066ff
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `Room_at_${x}_${y}`;

    const coordinates = CubeFloorRenderer.getAreaCoordinates(
      x,
      y,
      x + width - 1,
      y + height - 1
    );
    
    CubeFloorRenderer.registerCubes(coordinates, color, 'room');
    const floorGroup = CubeFloorRenderer.renderAllCubes(this.scene);
    
    group.add(floorGroup);
    this.scene.add(group);
    
    return group;
  }

  /**
   * Remove a specific room
   */
  public removeRoom(roomId: string): void {
    const group = this.roomGroups.get(roomId);
    if (group) {
      this.scene.remove(group);
      this.roomGroups.delete(roomId);
    }
  }

  /**
   * Clear all rendered rooms
   */
  public clearAllRooms(): void {
    this.roomGroups.forEach(group => this.scene.remove(group));
    this.roomGroups.clear();
    CubeFloorRenderer.clearRegistry();
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.clearAllRooms();
    CubeFloorRenderer.dispose();
  }
}
