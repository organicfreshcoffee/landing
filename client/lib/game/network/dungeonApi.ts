import axios from 'axios';
import { ensureProtocol, isValidUrl } from '../../urlUtils';
import {
  DungeonNode,
  FloorLayoutResponse,
  RoomStairsResponse,
  SpawnLocationResponse,
  PlayerMovedFloorResponse
} from '../types/api';

/**
 * Build dungeon API endpoints for a specific server
 */
const buildDungeonEndpoints = (serverAddress: string) => {
  const baseUrl = ensureProtocol(serverAddress);
  console.log(`🔗 DungeonApi: Building endpoints for server: ${baseUrl}`);
  
  if (!isValidUrl(baseUrl)) {
    throw new Error(`Invalid server address: ${serverAddress} -> ${baseUrl}`);
  }
  
  return {
    playerMovedFloor: () => `${baseUrl}/api/dungeon/player-moved-floor`,
    getFloorLayout: (dungeonDagNodeName: string) => `${baseUrl}/api/dungeon/floor/${dungeonDagNodeName}`,
    getRoomStairs: (floorDagNodeName: string) => `${baseUrl}/api/dungeon/room-stairs/${floorDagNodeName}`,
    getSpawnLocation: () => `${baseUrl}/api/dungeon/spawn`,
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
      
      console.log(`🏰 DungeonApi: Getting floor layout from ${url}`);
      
      const response = await axios.get(url, config);
      
      console.log(`✅ DungeonApi: Floor layout response:`, response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error getting floor layout:', error);
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
      
      console.log(`🎯 DungeonApi: Getting spawn location from ${url}`);
      
      const response = await axios.get(url, config);
      
      console.log(`✅ DungeonApi: Spawn location response:`, response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error getting spawn location:', error);
      throw error;
    }
  }
}
