# Cube Configuration System

This directory contains the centralized configuration for all cube-based rendering in the game.

## CubeConfig

The `CubeConfig` class is the single source of truth for all cube dimensions in the game. All cube sizes, wall heights, and related measurements are calculated from the base cube size.

### Key Properties

- `CUBE_SIZE`: The base size for all cubes (currently 2.5 units)
- `WALL_HEIGHT_IN_CUBES`: How many cubes tall walls should be (5 cubes)
- `WALL_HEIGHT`: Calculated wall height in world units (12.5 units)
- `PLAYER_EYE_LEVEL`: Height for camera positioning (2.5 units)

### Usage

```typescript
import { CubeConfig } from './config/cubeConfig';

// Get the current cube size
const cubeSize = CubeConfig.getCubeSize(); // 2.5

// Get wall height for rendering
const wallHeight = CubeConfig.getWallHeight(); // 12.5

// Get player eye level for camera
const eyeLevel = CubeConfig.getPlayerEyeLevel(); // 2.5
```

### Changing Cube Size

To change the cube size for the entire game:

1. Update `CubeConfig.CUBE_SIZE` in `cubeConfig.ts`
2. Restart the application
3. All components will automatically use the new size

The system automatically calculates:
- Wall heights (5 cubes tall)
- Room heights (same as walls)
- Hallway heights (same as walls)
- Player positioning
- All cube-based measurements

### Components Using CubeConfig

- `CubeFloorRenderer` - Floor cube rendering
- `SceneManager` - Camera positioning and fallback scenery
- `DungeonFloorRenderer` - Complete floor rendering
- `RoomRenderer` - Room floor rendering
- `HallwayRenderer` - Hallway rendering
- `WallGenerator` - Wall and ceiling generation
- `ServerSceneryGenerator` - Server-based floor generation

All of these components now use the centralized configuration automatically.
