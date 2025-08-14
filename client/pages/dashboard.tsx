import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import { apiEndpoints, logApiConfig } from '../lib/api';
import axios from 'axios';
import styles from '../styles/Dashboard.module.css';

interface Server {
  _id: string;
  server_name: string;
  server_address: string;
  is_official: boolean;
  is_third_party: boolean;
}

interface HealthResponse {
  status: string;
  timestamp: string;
}

interface PlayerCountResponse {
  success: boolean;
  data: {
    totalPlayers: number;
    playersByFloor: Record<string, number>;
  };
}

interface ServerStatus {
  isOnline: boolean;
  playerCount: number;
  lastChecked: string;
}

export default function Dashboard() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({});
  const [loadingServers, setLoadingServers] = useState(true);
  const [customServerAddress, setCustomServerAddress] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      // Log API configuration in development
      logApiConfig();
      fetchServers();
      
      // Set up periodic refresh every 30 seconds
      const interval = setInterval(() => {
        if (servers.length > 0) {
          checkAllServerStatuses(servers);
        }
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user, servers.length]);

  const fetchServers = async () => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const response = await axios.get(apiEndpoints.servers(), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setServers(response.data);
      
      // After fetching servers, check their status
      await checkAllServerStatuses(response.data);
    } catch (error) {
      console.error('Error fetching servers:', error);
    } finally {
      setLoadingServers(false);
    }
  };

  const formatServerUrl = (serverAddress: string): string => {
    // If the address already has a protocol, return as-is
    if (serverAddress.startsWith('http://') || serverAddress.startsWith('https://')) {
      return serverAddress;
    }
    
    // Use http for localhost, https for everything else
    const protocol = serverAddress.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${serverAddress}`;
  };

  const checkServerHealth = async (serverAddress: string): Promise<boolean> => {
    try {
      const formattedUrl = formatServerUrl(serverAddress);
      const response = await axios.get(`${formattedUrl}/health`, {
        timeout: 5000 // 5 second timeout
      });
      return response.data.status === 'ok';
    } catch (error) {
      console.warn(`Health check failed for ${serverAddress}:`, error);
      return false;
    }
  };

  const getPlayerCount = async (serverAddress: string): Promise<number> => {
    try {
      if (!user) return 0;
      
      const token = await user.getIdToken();
      const formattedUrl = formatServerUrl(serverAddress);
      const response = await axios.get(`${formattedUrl}/api/dungeon/player-count`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        timeout: 5000 // 5 second timeout
      });
      return response.data.success ? response.data.data.totalPlayers : 0;
    } catch (error) {
      console.warn(`Player count fetch failed for ${serverAddress}:`, error);
      return 0;
    }
  };

  const checkServerStatus = async (server: Server): Promise<ServerStatus> => {
    const [isOnline, playerCount] = await Promise.all([
      checkServerHealth(server.server_address),
      getPlayerCount(server.server_address)
    ]);

    return {
      isOnline,
      playerCount: isOnline ? playerCount : 0,
      lastChecked: new Date().toISOString()
    };
  };

  const checkAllServerStatuses = async (serverList: Server[]) => {
    const statusPromises = serverList.map(async (server) => {
      const status = await checkServerStatus(server);
      return { serverId: server._id, status };
    });

    const results = await Promise.all(statusPromises);
    const newStatuses: Record<string, ServerStatus> = {};
    
    results.forEach(({ serverId, status }) => {
      newStatuses[serverId] = status;
    });

    setServerStatuses(newStatuses);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleConnect = (serverAddress: string) => {
    // Navigate to the game page with the server address as a query parameter
    router.push(`/game?server=${encodeURIComponent(serverAddress)}`);
  };

  const handleCustomConnect = () => {
    if (customServerAddress.trim()) {
      handleConnect(customServerAddress.trim());
    }
  };

  const getServerStatus = (serverId: string) => {
    return serverStatuses[serverId] || { isOnline: false, playerCount: 0, lastChecked: '' };
  };

  const renderServerStatus = (serverId: string) => {
    const status = getServerStatus(serverId);
    if (!status.lastChecked) {
      return <span className={styles.statusChecking}>Checking...</span>;
    }
    
    return (
      <span className={status.isOnline ? styles.statusOnline : styles.statusOffline}>
        {status.isOnline ? 'Online' : 'Offline'}
      </span>
    );
  };

  const handleRefreshStatuses = async () => {
    await checkAllServerStatuses(servers);
  };

  const renderPlayerCount = (serverId: string) => {
    const status = getServerStatus(serverId);
    if (!status.lastChecked) {
      return <span className={styles.playerCountLoading}>-</span>;
    }
    
    return (
      <span className={styles.playerCount}>
        {status.isOnline ? status.playerCount : '-'}
      </span>
    );
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Organic Fresh Coffee</h1>
        <div className={styles.userInfo}>
          <span>Welcome, {user.email}</span>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Game Servers</h2>
          <button 
            onClick={handleRefreshStatuses} 
            className={styles.refreshButton}
            disabled={loadingServers || servers.length === 0}
          >
            🔄 Refresh Status
          </button>
        </div>
        {loadingServers ? (
          <div className={styles.loading}>Loading servers...</div>
        ) : (
          <div className={styles.serversList}>
            {/* Custom Server Section */}
            <div className={styles.serverSection}>
                <h3 className={styles.subsectionTitle}>Custom Server</h3>
                <div className={styles.customServerInput}>
                <input
                    type="text"
                    placeholder="Enter custom server address"
                    value={customServerAddress}
                    onChange={(e) => setCustomServerAddress(e.target.value)}
                    className={styles.serverInput}
                />
                <button 
                    className={styles.connectButton}
                    disabled={!customServerAddress.trim()}
                    onClick={handleCustomConnect}
                >
                    Connect
                </button>
                </div>
            </div>

            {/* Official Servers Section */}
            <div className={styles.serverSection}>
              <h3 className={styles.subsectionTitle}>Official Servers</h3>
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>Server Name</div>
                  <div className={styles.tableCell}>Server Address</div>
                  <div className={styles.tableCell}>Status</div>
                  <div className={styles.tableCell}>Players</div>
                  <div className={styles.tableCell}>Action</div>
                </div>
                {servers.filter(server => server.is_official).map((server) => (
                  <div key={server._id} className={styles.tableRow}>
                    <div className={styles.tableCell}>{server.server_name}</div>
                    <div className={styles.tableCell}>{server.server_address}</div>
                    <div className={styles.tableCell}>{renderServerStatus(server._id)}</div>
                    <div className={styles.tableCell}>{renderPlayerCount(server._id)}</div>
                    <div className={styles.tableCell}>
                      <button 
                        className={styles.tableConnectButton}
                        onClick={() => handleConnect(server.server_address)}
                        disabled={!getServerStatus(server._id).isOnline}
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                ))}
                {servers.filter(server => server.is_official).length === 0 && (
                  <p className={styles.emptyState}>No official servers available.</p>
                )}
              </div>
            </div>

            {/* Third Party Servers Section */}
            <div className={styles.serverSection}>
              <h3 className={styles.subsectionTitle}>Third Party Servers</h3>
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>Server Name</div>
                  <div className={styles.tableCell}>Server Address</div>
                  <div className={styles.tableCell}>Status</div>
                  <div className={styles.tableCell}>Players</div>
                  <div className={styles.tableCell}>Action</div>
                </div>
                {servers.filter(server => server.is_third_party).map((server) => (
                  <div key={server._id} className={styles.tableRow}>
                    <div className={styles.tableCell}>{server.server_name}</div>
                    <div className={styles.tableCell}>{server.server_address}</div>
                    <div className={styles.tableCell}>{renderServerStatus(server._id)}</div>
                    <div className={styles.tableCell}>{renderPlayerCount(server._id)}</div>
                    <div className={styles.tableCell}>
                      <button 
                        className={styles.tableConnectButton}
                        onClick={() => handleConnect(server.server_address)}
                        disabled={!getServerStatus(server._id).isOnline}
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                ))}
                {servers.filter(server => server.is_third_party).length === 0 && (
                  <p className={styles.emptyState}>No third party servers available.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
