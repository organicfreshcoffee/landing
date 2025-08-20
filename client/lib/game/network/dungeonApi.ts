import axios from 'axios';
import { ensureProtocol, isValidUrl } from '../../urlUtils';
import {
  DungeonNode,
  FloorLayoutResponse,
  GeneratedFloorTilesResponse,
  RoomStairsResponse,
  SpawnLocationResponse,
  PlayerMovedFloorResponse,
  CurrentFloorResponse,
  CurrentStatusResponse
} from '../types/api';

/**
 * Build dungeon API endpoints for a specific server
 */
const buildDungeonEndpoints = (serverAddress: string) => {
  const baseUrl = ensureProtocol(serverAddress);
    
  if (!isValidUrl(baseUrl)) {
    throw new Error(`Invalid server address: ${serverAddress} -> ${baseUrl}`);
  }
  
  return {
    playerMovedFloor: () => `${baseUrl}/api/dungeon/player-moved-floor`,
    getFloorLayout: (dungeonDagNodeName: string) => `${baseUrl}/api/dungeon/floor/${dungeonDagNodeName}`,
    getGeneratedFloorTiles: (floorName: string) => `${baseUrl}/api/dungeon/generated-floor-tiles/${floorName}`,
    getRoomStairs: (floorDagNodeName: string) => `${baseUrl}/api/dungeon/room-stairs/${floorDagNodeName}`,
    getSpawnLocation: () => `${baseUrl}/api/dungeon/spawn`,
    getCurrentStatus: () => `${baseUrl}/api/dungeon/current-status`,
  };
};

/**
 * Gets the user's Firebase auth token for API requests
 */
async function getAuthToken(): Promise<string> {
  // Import firebase auth dynamically to avoid SSR issues
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  return await user.getIdToken();
}

/**
 * Creates axios config with authentication headers
 */
async function getAuthConfig() {
  const token = await getAuthToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
}

export class DungeonApi {
  /**
   * Notify server that player moved to a new floor
   */
  static async notifyPlayerMovedFloor(serverAddress: string, newFloorName: string): Promise<PlayerMovedFloorResponse> {
    try {
      const config = await getAuthConfig();
      const endpoints = buildDungeonEndpoints(serverAddress);
      const response = await axios.post(
        endpoints.playerMovedFloor(),
        { newFloorName },
        config
      );
      return response.data;
    } catch (error) {
      console.error('Error notifying player moved floor:', error);
      throw error;
    }
  }

  /**
   * Get floor layout from server
   */
  static async getFloorLayout(serverAddress: string, dungeonDagNodeName: string): Promise<FloorLayoutResponse> {
    try {
      const config = await getAuthConfig();
      const endpoints = buildDungeonEndpoints(serverAddress);
      const url = endpoints.getFloorLayout(dungeonDagNodeName);
      
            
      const response = await axios.get(url, config);
      
            return response.data;
    } catch (error) {
      console.error('❌ Error getting floor layout:', error);
      throw error;
    }
  }

  /**
   * Get pre-calculated floor tiles from server (newest server-side tile generation)
   */
  static async getGeneratedFloorTiles(serverAddress: string, floorName: string): Promise<GeneratedFloorTilesResponse> {
    try {
      const config = await getAuthConfig();
      const endpoints = buildDungeonEndpoints(serverAddress);
      const url = endpoints.getGeneratedFloorTiles(floorName);
      
                        
      const response = await axios.get(url, config);
      
            return response.data;
    } catch (error) {
      console.error('❌ Error getting generated floor tiles:', error);
      if (axios.isAxiosError(error)) {
        console.error('❌ Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url
        });
      }
      throw error;
    }
  }

  /**
   * Get room stairs information
   */
  static async getRoomStairs(serverAddress: string, floorDagNodeName: string): Promise<RoomStairsResponse> {
    try {
      const config = await getAuthConfig();
      const endpoints = buildDungeonEndpoints(serverAddress);
      const response = await axios.get(
        endpoints.getRoomStairs(floorDagNodeName),
        config
      );
      return response.data;
    } catch (error) {
      console.error('Error getting room stairs:', error);
      throw error;
    }
  }

  /**
   * Get spawn location for new players
   */
  static async getSpawnLocation(serverAddress: string): Promise<SpawnLocationResponse> {
    try {
      const config = await getAuthConfig();
      const endpoints = buildDungeonEndpoints(serverAddress);
      const url = endpoints.getSpawnLocation();
      
            
      const response = await axios.get(url, config);
      
            return response.data;
    } catch (error) {
      console.error('❌ Error getting spawn location:', error);
      throw error;
    }
  }

  /**
   * Get current status for the player (includes position, rotation, character, etc.)
   */
  static async getCurrentStatus(serverAddress: string): Promise<CurrentStatusResponse> {
    try {
      const config = await getAuthConfig();
      const endpoints = buildDungeonEndpoints(serverAddress);
      const url = endpoints.getCurrentStatus();
      
            
      const response = await axios.get(url, config);
      
            return response.data;
    } catch (error) {
      // If 404, player is not alive - this is expected behavior
      if (axios.isAxiosError(error) && error.response?.status === 404) {
                throw new Error('PLAYER_NOT_ALIVE');
      }
      console.error('❌ Error getting current status:', error);
      throw error;
    }
  }

  /**
   * Get current floor for the player (legacy method - use getCurrentStatus instead)
   * @deprecated Use getCurrentStatus instead
   */
  static async getCurrentFloor(serverAddress: string): Promise<CurrentFloorResponse> {
    try {
      const statusResponse = await this.getCurrentStatus(serverAddress);
      // Convert CurrentStatusResponse to CurrentFloorResponse for backward compatibility
      return {
        success: statusResponse.success,
        data: {
          currentFloor: statusResponse.data.currentFloor,
          playerId: statusResponse.data.playerId,
          playerName: statusResponse.data.playerName,
        }
      };
    } catch (error) {
      console.error('❌ Error getting current floor:', error);
      throw error;
    }
  }
}
