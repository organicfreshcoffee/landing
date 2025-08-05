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

export default function Dashboard() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
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
    }
  }, [user]);

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
    } catch (error) {
      console.error('Error fetching servers:', error);
    } finally {
      setLoadingServers(false);
    }
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
        <h2 className={styles.sectionTitle}>Game Servers</h2>
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
                  <div className={styles.tableCell}>Action</div>
                </div>
                {servers.filter(server => server.is_official).map((server) => (
                  <div key={server._id} className={styles.tableRow}>
                    <div className={styles.tableCell}>{server.server_name}</div>
                    <div className={styles.tableCell}>{server.server_address}</div>
                    <div className={styles.tableCell}>
                      <button 
                        className={styles.tableConnectButton}
                        onClick={() => handleConnect(server.server_address)}
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
                  <div className={styles.tableCell}>Action</div>
                </div>
                {servers.filter(server => server.is_third_party).map((server) => (
                  <div key={server._id} className={styles.tableRow}>
                    <div className={styles.tableCell}>{server.server_name}</div>
                    <div className={styles.tableCell}>{server.server_address}</div>
                    <div className={styles.tableCell}>
                      <button 
                        className={styles.tableConnectButton}
                        onClick={() => handleConnect(server.server_address)}
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
