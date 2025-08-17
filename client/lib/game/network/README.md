# Game Network System

This directory contains the networking components for real-time multiplayer functionality.

## WebSocket Messages

The game uses WebSocket connections for real-time communication between players.

### Message Types

#### Sent by Client

##### `ping`
- **Purpose**: Heartbeat to maintain connection
- **Data**: None
- **Frequency**: Every 30 seconds (visible) / 60 seconds (hidden)

##### `player_move`
- **Purpose**: Update player position, rotation, and movement state
- **Data**:
  ```typescript
  {
    playerId: string,
    position: { x: number, y: number, z: number },
    rotation: { x: number, y: number, z: number },
    isMoving: boolean,
    movementDirection: 'forward' | 'backward' | 'none',
    character: CharacterData
  }
  ```

##### `player_action` *(NEW)*
- **Purpose**: Handle player actions like spells, attacks, interactions
- **Data**:
  ```typescript
  {
    playerId: string,
    action: string, // e.g., 'spell_cast'
    target?: string, // Optional target player ID
    data?: SpellActionData | any // Action-specific data
  }
  ```

##### `player_respawn` *(NEW)*
- **Purpose**: Request character respawn after death
- **Data**:
  ```typescript
  {
    characterData: {
      name: string,
      style: number,
      type: string
    }
  }
  }
  ```

#### Received by Client

##### `pong`
- **Purpose**: Response to ping for connection health
- **Data**: None

##### `player_joined`
- **Purpose**: New player joins the game
- **Data**: Full player data with position and character

##### `player_moved`
- **Purpose**: Player position/state updates
- **Data**: Player update with position, rotation, movement state

##### `player_left`
- **Purpose**: Player disconnects
- **Data**: `{ playerId: string }`

##### `player_left_floor`
- **Purpose**: Player moves to different floor
- **Data**: `{ playerId: string }`

##### `players_list`
- **Purpose**: Initial list of all players on join
- **Data**: `{ players: PlayerUpdate[] }`

##### `player_action` *(NEW)*
- **Purpose**: Player actions from other players
- **Data**: Same as sent format
- **Handling**: Renders visual effects (spells, etc.)

##### `health_update` *(NEW)*
- **Purpose**: Player health and status updates
- **Data**:
  ```typescript
  {
    health: number,
    maxHealth: number,
    damage?: number,
    damageCause?: 'spell' | 'combat' | 'environment',
    casterPlayerId?: string,
    isAlive: boolean
  }
  ```

##### `respawn_success` *(NEW)*
- **Purpose**: Confirmation of successful respawn
- **Data**:
  ```typescript
  {
    player: {
      health: number,
      maxHealth: number,
      isAlive: boolean,
      character: CharacterData,
      // ... other player data
    }
  }
  ```

### Spell System

When a player casts a spell:

1. **Local Effect**: Immediate visual feedback via `ParticleSystem.castSpell()`
2. **Network Message**: `player_action` with `action: 'spell_cast'` sent to server
3. **Other Players**: Receive `player_action` and render via `ParticleSystem.castSpellFromNetwork()`

#### Spell Action Data

```typescript
interface SpellActionData {
  fromPosition: { x: number; y: number; z: number };
  toPosition: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  range: number;
  timestamp: number;
  casterPosition?: { x: number; y: number; z: number };
  spellRadius?: number; // For hit detection
}
```

### Visual Differences

- **Local Player Spells**: Blue/purple particles
- **Other Player Spells**: Orange/red particles

This helps players distinguish their own actions from others' actions in the game world.

### Death and Respawn System

When a player's health reaches 0:

1. **Health Update**: Server sends `health_update` with `isAlive: false`
2. **Client Response**: 
   - Shows death indicator in Health HUD
   - Moves player to floor A at position (0,0,0)
   - Notifies server via `playerMovedFloor` API
   - Shows character selection screen
3. **Respawn**: Player selects character and sends `player_respawn` message
4. **Confirmation**: Server responds with `respawn_success` containing new player data

#### Health HUD Features

- **Visual Health Bar**: Color-coded (green → yellow → red)
- **Death Indicator**: Blinking skull emoji when dead
- **Real-time Updates**: Instant feedback from server health updates

### Connection Features

- **Authentication**: Firebase auth tokens in URL params
- **Auto-reconnection**: Up to 5 attempts with exponential backoff
- **Health Monitoring**: Ping/pong system with connection checks
- **Visibility Optimization**: Reduced ping frequency when tab hidden
- **Message Queuing**: Queues messages during disconnection

## File Structure

- `webSocketManager.ts` - Core WebSocket connection management
- `dungeonApi.ts` - REST API for dungeon/floor data
- `index.ts` - Module exports
