/**
 * Centralized cube size configuration for the entire game.
 * All cube sizes, wall heights, and related dimensions are calculated from this base value.
 */
export class CubeConfig {
  /**
   * Base cube size - this is the single source of truth for all cube dimensions
   */
  public static readonly CUBE_SIZE = 5;

  /**
   * Wall height in cubes (how many cubes tall walls should be)
   */
  public static readonly WALL_HEIGHT_IN_CUBES = 5;

  /**
   * Calculated wall height in world units
   */
  public static readonly WALL_HEIGHT = CubeConfig.WALL_HEIGHT_IN_CUBES * CubeConfig.CUBE_SIZE;

  /**
   * Room height in cubes (same as wall height for consistency)
   */
  public static readonly ROOM_HEIGHT_IN_CUBES = CubeConfig.WALL_HEIGHT_IN_CUBES;

  /**
   * Calculated room height in world units
   */
  public static readonly ROOM_HEIGHT = CubeConfig.ROOM_HEIGHT_IN_CUBES * CubeConfig.CUBE_SIZE;

  /**
   * Hallway height in cubes (same as room height for consistency)
   */
  public static readonly HALLWAY_HEIGHT_IN_CUBES = CubeConfig.WALL_HEIGHT_IN_CUBES;

  /**
   * Calculated hallway height in world units
   */
  public static readonly HALLWAY_HEIGHT = CubeConfig.HALLWAY_HEIGHT_IN_CUBES * CubeConfig.CUBE_SIZE;

  /**
   * Default hallway width in cubes
   */
  public static readonly DEFAULT_HALLWAY_WIDTH = 1;

  /**
   * Player eye level height (for camera positioning)
   */
  public static readonly PLAYER_EYE_LEVEL = CubeConfig.CUBE_SIZE * 1; // 1 cube high

  /**
   * Get cube size for use in rendering options
   */
  public static getCubeSize(): number {
    return CubeConfig.CUBE_SIZE;
  }

  /**
   * Get wall height for use in rendering options
   */
  public static getWallHeight(): number {
    return CubeConfig.WALL_HEIGHT;
  }

  /**
   * Get room height for use in rendering options
   */
  public static getRoomHeight(): number {
    return CubeConfig.ROOM_HEIGHT;
  }

  /**
   * Get hallway height for use in rendering options
   */
  public static getHallwayHeight(): number {
    return CubeConfig.HALLWAY_HEIGHT;
  }

  /**
   * Get player eye level for camera positioning
   */
  public static getPlayerEyeLevel(): number {
    return CubeConfig.PLAYER_EYE_LEVEL;
  }

  /**
   * Update the base cube size (and automatically recalculate all dependent values)
   * This is the only method that should be used to change cube dimensions
   */
  public static updateCubeSize(newSize: number): void {
    // Note: Since we're using readonly static properties, this would require
    // a different approach in TypeScript. For now, this serves as documentation
    // that this is where you would change the cube size.
    console.warn('To change cube size, update CubeConfig.CUBE_SIZE and restart the application');
  }
}
