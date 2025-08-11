# Server-Based Dungeon System

This update replaces the client-side procedural dungeon generation with a server-based system that fetches floor layouts from the server API.

## Overview

Previously, the game used local generation classes (`FloorGenerator`, `RoomShapeGenerator`, `HallwayGenerator`) to create dungeon layouts on the client. Now, the system fetches pre-generated dungeon data from the server and renders it locally.

## Key Changes

### New Files Added

1. **`dungeonApi.ts`** - API client for dungeon endpoints
2. **`serverFloorGenerator.ts`** - Converts server data to client format
3. **`hallwayGenerator.ts`** - Updated to work with server room data
4. **`serverSceneryGenerator.ts`** - Renders server-based floor layouts
5. **`serverDungeonExample.ts`** - Usage examples and integration guide

### Modified Files

1. **`api.ts`** - Added dungeon API endpoints
2. **`sceneManager.ts`** - Updated to use server-based scenery generation
3. **`index.ts`** - Added exports for new classes

## API Integration

### Authentication
All dungeon endpoints require Firebase authentication with Bearer tokens.

### Endpoints Used
- `GET /api/dungeon/spawn` - Get initial spawn location
- `GET /api/dungeon/floor/:dungeonDagNodeName` - Get floor layout
- `GET /api/dungeon/room-stairs/:floorDagNodeName` - Get stair connections
- `POST /api/dungeon/player-moved-floor` - Notify server of floor changes

## Server Address Configuration

The server address for dungeon API calls is obtained from the game server selection in the dashboard:

1. **Dashboard Selection**: Users select a server from the dashboard (`dashboard.tsx`)
2. **Game Page**: The selected server address is passed as a query parameter to the game page
3. **GameManager**: The server address is used for both WebSocket connections and dungeon API calls
4. **SceneManager**: Receives the server address and uses it for all dungeon-related API requests

Flow:
```
Dashboard → Game Page (with server param) → GameManager.connectToServer() → SceneManager.setServerAddress()
```

This ensures that all API calls (WebSocket and REST) go to the same selected game server.

```
1. Client requests spawn location from server
2. Server returns initial floor name (e.g., "A")
3. Client requests floor layout for that floor
4. Server returns room and hallway data
5. Client converts server data to 3D scene objects
6. Client renders rooms, hallways, and stairs
```

## Server Data Structure

### Floor Layout Response
```json
{
  "success": true,
  "data": {
    "dungeonDagNodeName": "A",
    "nodes": [
      {
        "name": "A_A",
        "dungeonDagNodeName": "A", 
        "children": ["A_AA", "A_AB"],
        "isRoom": true,
        "hasUpwardStair": true,
        "roomWidth": 15,
        "roomHeight": 12,
        "stairLocationX": 7.5,
        "stairLocationY": 6.0
      }
    ]
  }
}
```

## Usage Examples

### Basic Initialization
```typescript
import { ServerSceneryGenerator } from './lib/game';

// Get server address from dashboard selection
const serverAddress = 'https://your-game-server.com';

// Get spawn location and load initial floor
const spawnFloor = await ServerSceneryGenerator.getSpawnLocation(serverAddress);
const floorResult = await ServerSceneryGenerator.generateServerFloor(scene, serverAddress, spawnFloor);
```

### Floor Navigation
```typescript
// Notify server and switch floors
await ServerSceneryGenerator.notifyPlayerMovedFloor(serverAddress, 'AA');
ServerSceneryGenerator.clearScene(scene);
await ServerSceneryGenerator.generateServerFloor(scene, serverAddress, 'AA');
```

### Stair Interaction
```typescript
import { DungeonApi } from './lib/game';

// Get stair information for a room
const stairInfo = await DungeonApi.getRoomStairs(serverAddress, 'A_A');
if (stairInfo.data.downwardStair) {
  const targetFloor = stairInfo.data.downwardStair.dungeonDagNodeName;
  // Navigate to target floor
}
```

## Integration with SceneManager

The `SceneManager` class has been updated to use the server-based system:

```typescript
// Set server address (done automatically by GameManager)
sceneManager.setServerAddress('https://your-game-server.com');

// Old way (local generation)
await sceneManager.loadScenery();

// New way (server-based)
await sceneManager.loadScenery('A'); // Load specific floor
await sceneManager.switchFloor('AA'); // Switch to new floor
```

The `GameManager` automatically sets the server address when connecting to a server:

```typescript
// In GameManager.connectToServer()
this.sceneManager.setServerAddress(serverAddress);
await this.webSocketManager.connect(serverAddress, this.user);
```

## Error Handling

The system includes fallback mechanisms:
- If server is unavailable, falls back to simple test environment
- Authentication errors are handled gracefully
- Network issues trigger appropriate error messages

## Benefits

1. **Consistency** - All players see identical dungeon layouts
2. **Persistence** - Dungeons are saved on the server
3. **Infinite Generation** - Server generates new floors as needed
4. **Multiplayer Support** - Shared dungeon state across players
5. **Performance** - Reduced client-side computation

## Migration Guide

For existing code using the old system:

1. Replace `SceneryGenerator` with `ServerSceneryGenerator`
2. Add authentication to game initialization
3. Handle async floor loading
4. Update floor switching logic to notify server
5. Implement stair interaction with server API

See `serverDungeonExample.ts` for complete usage examples.
