# Game Utilities

This directory contains the refactored game logic that was previously contained in a single large `game.tsx` file. The code is now organized into logical modules for better maintainability and reusability.

## File Structure

### Core Types
- **`types.ts`** - TypeScript interfaces and type definitions used throughout the game

### Core Modules
- **`gameManager.ts`** - Main orchestrator that coordinates all game systems
- **`sceneManager.ts`** - Three.js scene, camera, renderer, and lighting management  
- **`modelLoader.ts`** - 3D model loading utilities (player models and assets)
- **`playerManager.ts`** - Player creation, positioning, animation, and cleanup
- **`sceneryGenerator.ts`** - Procedural building generation and scenery placement
- **`webSocketManager.ts`** - WebSocket connection, reconnection, and message handling
- **`movementController.ts`** - Keyboard/mouse input handling and movement logic

### Entry Points
- **`index.ts`** - Exports all utilities for easy importing
- **`/pages/game.tsx`** - Simplified Next.js page component that uses GameManager

## Usage

The main game page now only needs to:

```tsx
import { GameManager, GameState } from '../lib/game';

const gameManager = new GameManager(canvas, onStateChange, user);
await gameManager.connectToServer(serverAddress);
```

## Key Benefits

1. **Separation of Concerns** - Each utility handles a specific aspect of the game
2. **Reusability** - Components can be reused or tested independently  
3. **Maintainability** - Much easier to debug and modify specific functionality
4. **Type Safety** - Centralized type definitions prevent inconsistencies
5. **Cleaner API** - The main game component is now much simpler

## Architecture

The `GameManager` acts as the main coordinator:
- Initializes `SceneManager` for 3D rendering
- Sets up `WebSocketManager` for server communication
- Creates `MovementController` for player input
- Uses `PlayerManager` for player lifecycle management
- Loads scenery via `SceneryGenerator`

All the complex game logic is now properly encapsulated while maintaining the same `/game` endpoint functionality for Next.js.

## Migration

The original `game.tsx` has been backed up as `game_original.tsx`. The new version provides identical functionality but with much cleaner, more maintainable code organization.
