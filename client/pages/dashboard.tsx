import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import { apiEndpoints, logApiConfig } from '../lib/api';
import axios from 'axios';
import JSZip from 'jszip';
import styles from '../styles/Dashboard.module.css';
import PrivacyPolicy from '../components/PrivacyPolicy';

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
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Close account menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isAccountMenuOpen && !target.closest(`.${styles.accountMenuContainer}`)) {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAccountMenuOpen]);

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

  const toggleAccountMenu = () => {
    setIsAccountMenuOpen(!isAccountMenuOpen);
  };

  const handleExportAccountData = async () => {
    if (!user) return;
    
    setIsExporting(true);
    setIsAccountMenuOpen(false);
    
    try {
      const token = await user.getIdToken();
      const zip = new JSZip();
      
      // 1. Get Firebase Auth user data
      console.log('Exporting Firebase Auth data...');
      const firebaseUserData = {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime,
        providerData: user.providerData.map(provider => ({
          providerId: provider.providerId,
          uid: provider.uid,
          email: provider.email,
          displayName: provider.displayName,
          photoURL: provider.photoURL
        }))
      };
      zip.file('firebase_auth_data.json', JSON.stringify(firebaseUserData, null, 2));
      
      // 2. Get user data from landing page MongoDB
      console.log('Exporting landing page data...');
      try {
        const landingDataResponse = await axios.get(apiEndpoints.exportUserData(), {
          headers: {
            Authorization: `Bearer ${token}`
          },
          timeout: 10000
        });
        
        if (landingDataResponse.data.success) {
          zip.file('landing_page_data.json', JSON.stringify(landingDataResponse.data.data, null, 2));
        } else {
          zip.file('landing_page_data.json', JSON.stringify({ error: 'Failed to retrieve data', details: landingDataResponse.data }, null, 2));
        }
      } catch (error) {
        console.warn('Failed to get landing page data:', error);
        zip.file('landing_page_data.json', JSON.stringify({ error: 'Failed to retrieve landing page data', details: error instanceof Error ? error.message : 'Unknown error' }, null, 2));
      }
      
      // 3. Get data from each game server
      console.log('Exporting game server data...');
      const serverDataPromises = servers.map(async (server) => {
        try {
          const formattedUrl = formatServerUrl(server.server_address);
          const response = await axios.get(`${formattedUrl}/api/user/export-data`, {
            headers: {
              Authorization: `Bearer ${token}`
            },
            timeout: 10000
          });
          
          return {
            serverName: server.server_name,
            serverAddress: server.server_address,
            success: true,
            data: response.data
          };
        } catch (error) {
          console.warn(`Failed to get data from server ${server.server_name}:`, error);
          return {
            serverName: server.server_name,
            serverAddress: server.server_address,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });
      
      const serverDataResults = await Promise.all(serverDataPromises);
      
      // Add each server's data to the zip
      serverDataResults.forEach((result, index) => {
        const fileName = `game_server_${index + 1}_${result.serverName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        zip.file(fileName, JSON.stringify(result, null, 2));
      });
      
      // 4. Create a summary file
      const summary = {
        exportDate: new Date().toISOString(),
        userEmail: user.email,
        userUid: user.uid,
        totalGameServers: servers.length,
        successfulServerExports: serverDataResults.filter(r => r.success).length,
        failedServerExports: serverDataResults.filter(r => !r.success).length,
        files: {
          'firebase_auth_data.json': 'Firebase Authentication user data',
          'landing_page_data.json': 'User login history from landing page',
          ...Object.fromEntries(
            serverDataResults.map((result, index) => [
              `game_server_${index + 1}_${result.serverName.replace(/[^a-zA-Z0-9]/g, '_')}.json`,
              `Game data from ${result.serverName} (${result.serverAddress})`
            ])
          )
        }
      };
      zip.file('export_summary.json', JSON.stringify(summary, null, 2));
      
      // 5. Generate and download the zip file
      console.log('Generating zip file...');
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Create download link
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `account_data_export_${user.email}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('Account data export completed successfully');
      
    } catch (error) {
      console.error('Error during account data export:', error);
      alert('Failed to export account data. Please try again later.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    // Confirm deletion with user
    const userConfirmation = window.confirm(
      "⚠️ WARNING: This action is IRREVERSIBLE!\n\n" +
      "This will permanently delete:\n" +
      "• All your game data from all listed servers\n" +
      "• Your login history\n" +
      "• Your account from Firebase\n\n" +
      "Are you absolutely sure you want to delete your account?"
    );
    
    if (!userConfirmation) return;
    
    // Second confirmation
    const finalConfirmation = window.confirm(
      "This is your final warning!\n\n" +
      "Once deleted, your account and all associated data cannot be recovered.\n\n" +
      "Type your email address in the next prompt to confirm deletion."
    );
    
    if (!finalConfirmation) return;
    
    // Email confirmation
    const emailConfirmation = window.prompt(
      `Please type your email address (${user.email}) to confirm account deletion:`
    );
    
    if (emailConfirmation !== user.email) {
      alert("Email confirmation did not match. Account deletion cancelled.");
      return;
    }
    
    setIsDeleting(true);
    setIsAccountMenuOpen(false);
    
    try {
      const token = await user.getIdToken();
      const deleteResults = {
        gameServers: [] as any[],
        landingPage: null as any,
        firebase: null as any
      };
      
      console.log('Starting account deletion process...');
      
      // 1. Delete data from all game servers
      console.log('Deleting data from game servers...');
      const serverDeletePromises = servers.map(async (server) => {
        try {
          const formattedUrl = formatServerUrl(server.server_address);
          const response = await axios.delete(`${formattedUrl}/api/user/delete-data`, {
            headers: {
              Authorization: `Bearer ${token}`
            },
            timeout: 15000 // 15 second timeout for deletion
          });
          
          return {
            serverName: server.server_name,
            serverAddress: server.server_address,
            success: true,
            data: response.data
          };
        } catch (error) {
          console.warn(`Failed to delete data from server ${server.server_name}:`, error);
          return {
            serverName: server.server_name,
            serverAddress: server.server_address,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });
      
      deleteResults.gameServers = await Promise.all(serverDeletePromises);
      
      // 2. Delete data from landing page
      console.log('Deleting data from landing page...');
      try {
        const landingDeleteResponse = await axios.delete(apiEndpoints.deleteUserData(), {
          headers: {
            Authorization: `Bearer ${token}`
          },
          timeout: 10000
        });
        
        deleteResults.landingPage = {
          success: true,
          data: landingDeleteResponse.data
        };
      } catch (error) {
        console.warn('Failed to delete landing page data:', error);
        deleteResults.landingPage = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
      
      // 3. Delete user from Firebase Authentication
      console.log('Deleting Firebase user account...');
      try {
        await user.delete();
        deleteResults.firebase = {
          success: true,
          message: 'Firebase user account deleted successfully'
        };
      } catch (error) {
        console.error('Failed to delete Firebase user:', error);
        deleteResults.firebase = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        // If Firebase deletion fails, we should still log out the user
        // but inform them about the partial failure
      }
      
      // Log deletion summary
      const successfulServerDeletions = deleteResults.gameServers.filter(r => r.success).length;
      const failedServerDeletions = deleteResults.gameServers.filter(r => !r.success).length;
      
      console.log('Account deletion completed:', {
        gameServers: {
          successful: successfulServerDeletions,
          failed: failedServerDeletions
        },
        landingPage: deleteResults.landingPage?.success ? 'success' : 'failed',
        firebase: deleteResults.firebase?.success ? 'success' : 'failed'
      });
      
      // 4. Logout and redirect
      console.log('Logging out user...');
      await logout();
      
      // Show completion message
      if (deleteResults.firebase?.success) {
        alert(
          `Account deletion completed!\n\n` +
          `Game servers: ${successfulServerDeletions} successful, ${failedServerDeletions} failed\n` +
          `Landing page data: ${deleteResults.landingPage?.success ? 'deleted' : 'failed'}\n` +
          `Firebase account: deleted\n\n` +
          `You will now be redirected to the home page.`
        );
      } else {
        alert(
          `Account deletion partially completed!\n\n` +
          `Game servers: ${successfulServerDeletions} successful, ${failedServerDeletions} failed\n` +
          `Landing page data: ${deleteResults.landingPage?.success ? 'deleted' : 'failed'}\n` +
          `Firebase account: FAILED TO DELETE\n\n` +
          `Please contact support for assistance with Firebase account deletion: https://github.com/organicfreshcoffee/landing/issues\n` +
          `You will now be logged out and redirected.`
        );
      }
      
      router.push('/');
      
    } catch (error) {
      console.error('Error during account deletion:', error);
      alert(
        'An unexpected error occurred during account deletion.\n\n' +
        'Some data may have been deleted, but the process was not completed.\n' +
        'Please contact support for assistance: https://github.com/organicfreshcoffee/landing/issues\n\n' +
        'You will now be logged out for security.'
      );
      
      // Emergency logout
      try {
        await logout();
        router.push('/');
      } catch (logoutError) {
        console.error('Failed to logout after deletion error:', logoutError);
        window.location.href = '/';
      }
    } finally {
      setIsDeleting(false);
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
      {isExporting && (
        <div className={styles.exportOverlay}>
          <div className={styles.exportModal}>
            <div className={styles.exportSpinner}></div>
            <h3>Exporting Account Data</h3>
            <p>Please wait while we gather your data from all sources...</p>
            <p><small>This may take a few moments.</small></p>
          </div>
        </div>
      )}
      
      {isDeleting && (
        <div className={styles.exportOverlay}>
          <div className={styles.exportModal}>
            <div className={styles.deleteSpinner}></div>
            <h3>Deleting Account</h3>
            <p>Please wait while we permanently delete your data...</p>
            <p><small>⚠️ This process cannot be undone</small></p>
            <div className={styles.deletionSteps}>
              <div>🎮 Deleting game server data...</div>
              <div>📝 Deleting login history...</div>
              <div>🔐 Deleting Firebase account...</div>
            </div>
          </div>
        </div>
      )}
      
      <div className={styles.header}>
        <h1 className={styles.title}>Organic Fresh Coffee</h1>
        <div className={styles.userInfo}>
          <span>Welcome, {user.email}</span>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Logout
          </button>
          <div className={styles.accountMenuContainer}>
            <button 
              onClick={toggleAccountMenu} 
              className={styles.hamburgerButton}
              aria-label="Account menu"
            >
              <div className={styles.hamburgerIcon}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </button>
            {isAccountMenuOpen && (
              <div className={styles.accountPopup}>
                <button 
                  onClick={handleExportAccountData}
                  className={styles.accountMenuItem}
                  disabled={isExporting || isDeleting}
                >
                  {isExporting ? (
                    <>
                      <span className={styles.spinner}></span>
                      Exporting...
                    </>
                  ) : (
                    <>📁 Export Account Data</>
                  )}
                </button>
                <button 
                  onClick={handleDeleteAccount}
                  className={`${styles.accountMenuItem} ${styles.dangerButton}`}
                  disabled={isExporting || isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <span className={styles.spinner}></span>
                      Deleting...
                    </>
                  ) : (
                    <>🗑️ Delete Account</>
                  )}
                </button>
              </div>
            )}
          </div>
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
      
      <PrivacyPolicy />
    </div>
  );
}
