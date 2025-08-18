import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import { apiEndpoints, logApiConfig } from '../lib/api';
import axios from 'axios';
import JSZip from 'jszip';
import styles from '../styles/Dashboard.module.css';
import PrivacyPolicy from '../components/PrivacyPolicy';

interface AccountData {
  firebase: any;
  landingPage: any;
  gameServers: Array<{
    serverName: string;
    serverAddress: string;
    success: boolean;
    data?: any;
    error?: string;
  }>;
}

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
  pingTime: number | null; // in milliseconds, null if offline or error
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
  const [isViewingAccountData, setIsViewingAccountData] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [isLoadingAccountData, setIsLoadingAccountData] = useState(false);
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState<'none' | 'initial' | 'final' | 'email' | 'complete' | 'error'>('none');
  const [emailConfirmationInput, setEmailConfirmationInput] = useState('');
  const [deletionResults, setDeletionResults] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user && deleteConfirmationStep !== 'complete' && deleteConfirmationStep !== 'error') {
      router.push('/');
    }
  }, [user, loading, router, deleteConfirmationStep]);

  useEffect(() => {
    if (user) {
      // Log API configuration in development
      logApiConfig();
      fetchServers();
      checkAdminStatus();
      
      // Set up periodic refresh every 5 seconds
      const interval = setInterval(() => {
        if (servers.length > 0) {
          checkAllServerStatuses(servers);
        }
      }, 2500);
      
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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isViewingAccountData) {
          setIsViewingAccountData(false);
        } else if (deleteConfirmationStep !== 'none') {
          handleDeleteConfirmationCancel();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountMenuOpen, isViewingAccountData, deleteConfirmationStep]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const response = await axios.get(apiEndpoints.checkAdmin(), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setIsAdmin(response.data.isAdmin);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

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

  const checkServerHealth = async (serverAddress: string): Promise<{ isOnline: boolean; pingTime: number | null }> => {
    try {
      const formattedUrl = formatServerUrl(serverAddress);
      const startTime = Date.now();
      const response = await axios.get(`${formattedUrl}/health`, {
        timeout: 5000 // 5 second timeout
      });
      const endTime = Date.now();
      const pingTime = endTime - startTime;
      
      return {
        isOnline: response.data.status === 'ok',
        pingTime: response.data.status === 'ok' ? pingTime : null
      };
    } catch (error) {
      console.warn(`Health check failed for ${serverAddress}:`, error);
      return {
        isOnline: false,
        pingTime: null
      };
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
    const healthResult = await checkServerHealth(server.server_address);
    const playerCount = healthResult.isOnline ? await getPlayerCount(server.server_address) : 0;

    return {
      isOnline: healthResult.isOnline,
      playerCount: healthResult.isOnline ? playerCount : 0,
      pingTime: healthResult.pingTime,
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

  const handleViewAccountData = async () => {
    if (!user) return;
    
    setIsLoadingAccountData(true);
    setIsAccountMenuOpen(false);
    
    try {
      const token = await user.getIdToken();
      const allAccountData: AccountData = {
        firebase: {},
        landingPage: {},
        gameServers: []
      };
      
      // 1. Get Firebase Auth user data
      console.log('Loading Firebase Auth data...');
      allAccountData.firebase = {
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
      
      // 2. Get user data from landing page MongoDB
      console.log('Loading landing page data...');
      try {
        const landingDataResponse = await axios.get(apiEndpoints.viewUserData(), {
          headers: {
            Authorization: `Bearer ${token}`
          },
          timeout: 10000
        });
        
        if (landingDataResponse.data.success) {
          allAccountData.landingPage = landingDataResponse.data.data;
        } else {
          allAccountData.landingPage = { error: 'Failed to retrieve data', details: landingDataResponse.data };
        }
      } catch (error) {
        console.warn('Failed to get landing page data:', error);
        allAccountData.landingPage = { error: 'Failed to retrieve landing page data', details: error instanceof Error ? error.message : 'Unknown error' };
      }
      
      // 3. Get data from each game server
      console.log('Loading game server data...');
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
      
      allAccountData.gameServers = await Promise.all(serverDataPromises);
      
      setAccountData(allAccountData);
      setIsViewingAccountData(true);
      
      console.log('Account data loaded successfully');
      
    } catch (error) {
      console.error('Error loading account data:', error);
      alert('Failed to load account data. Please try again later.');
    } finally {
      setIsLoadingAccountData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    // Start the confirmation flow
    setDeleteConfirmationStep('initial');
  };

  const handleDeleteConfirmationCancel = () => {
    setDeleteConfirmationStep('none');
    setEmailConfirmationInput('');
    setDeletionResults(null);
  };

  const handleDeleteConfirmationNext = () => {
    if (deleteConfirmationStep === 'initial') {
      setDeleteConfirmationStep('final');
    } else if (deleteConfirmationStep === 'final') {
      setDeleteConfirmationStep('email');
    }
  };

  const handleDeleteConfirmationBack = () => {
    if (deleteConfirmationStep === 'final') {
      setDeleteConfirmationStep('initial');
    } else if (deleteConfirmationStep === 'email') {
      setDeleteConfirmationStep('final');
    }
  };

  const executeAccountDeletion = async () => {
    if (!user || emailConfirmationInput !== user.email) {
      return;
    }
    
    setIsDeleting(true);
    setDeleteConfirmationStep('none');
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
      
      // Store results for display BEFORE logout
      setDeletionResults(deleteResults);
      
      // Show completion message BEFORE logout
      setDeleteConfirmationStep('complete');
      
      // Note: Logout will be handled by the "Go to Home Page" button in the completion modal
      
    } catch (error) {
      console.error('Error during account deletion:', error);
      setDeletionResults({
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      setDeleteConfirmationStep('error');
    } finally {
      setIsDeleting(false);
    }
  };

  const getServerStatus = (serverId: string) => {
    return serverStatuses[serverId] || { isOnline: false, playerCount: 0, pingTime: null, lastChecked: '' };
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

  const renderPingTime = (serverId: string) => {
    const status = getServerStatus(serverId);
    if (!status.lastChecked) {
      return <span className={styles.pingTimeLoading}>-</span>;
    }
    
    if (!status.isOnline || status.pingTime === null) {
      return <span className={styles.pingTimeOffline}>-</span>;
    }
    
    const pingTime = status.pingTime;
    let pingClass = styles.pingTimeGood;
    
    if (pingTime > 200) {
      pingClass = styles.pingTimeHigh;
    } else if (pingTime > 100) {
      pingClass = styles.pingTimeMedium;
    }
    
    return (
      <span className={pingClass}>
        {pingTime}ms
      </span>
    );
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!user && deleteConfirmationStep !== 'complete' && deleteConfirmationStep !== 'error') {
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
      
      {deleteConfirmationStep !== 'none' && (
        <div className={styles.exportOverlay}>
          <div className={styles.deleteConfirmationModal}>
            {deleteConfirmationStep === 'initial' && (
              <>
                <div className={styles.deleteModalHeader}>
                  <div className={styles.warningIcon}>⚠️</div>
                  <h3>Delete Account</h3>
                  <button 
                    onClick={handleDeleteConfirmationCancel}
                    className={styles.closeButton}
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.deleteModalContent}>
                  <div className={styles.warningMessage}>
                    <strong>WARNING: This action is IRREVERSIBLE!</strong>
                  </div>
                  <div className={styles.deletionList}>
                    <p>This will permanently delete:</p>
                    <ul>
                      <li>All your game data from all listed servers</li>
                      <li>Your login history</li>
                      <li>Your account from Firebase</li>
                    </ul>
                  </div>
                  <p>Are you absolutely sure you want to delete your account?</p>
                </div>
                <div className={styles.deleteModalActions}>
                  <button 
                    onClick={handleDeleteConfirmationCancel}
                    className={styles.cancelButton}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteConfirmationNext}
                    className={styles.continueButton}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {deleteConfirmationStep === 'final' && (
              <>
                <div className={styles.deleteModalHeader}>
                  <div className={styles.warningIcon}>⚠️</div>
                  <h3>Final Warning</h3>
                  <button 
                    onClick={handleDeleteConfirmationCancel}
                    className={styles.closeButton}
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.deleteModalContent}>
                  <div className={styles.finalWarning}>
                    <p><strong>This is your final warning!</strong></p>
                    <p>Once deleted, your account and all associated data cannot be recovered.</p>
                    <p>In the next step, you will need to type your email address to confirm deletion.</p>
                  </div>
                </div>
                <div className={styles.deleteModalActions}>
                  <button 
                    onClick={handleDeleteConfirmationBack}
                    className={styles.backButton}
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleDeleteConfirmationNext}
                    className={styles.continueButton}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {deleteConfirmationStep === 'email' && (
              <>
                <div className={styles.deleteModalHeader}>
                  <div className={styles.warningIcon}>✉️</div>
                  <h3>Confirm Email</h3>
                  <button 
                    onClick={handleDeleteConfirmationCancel}
                    className={styles.closeButton}
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.deleteModalContent}>
                  <div className={styles.emailConfirmation}>
                    <p>Please type your email address to confirm account deletion:</p>
                    <div className={styles.emailDisplay}>
                      Expected: <strong>{user?.email}</strong>
                    </div>
                    <input
                      type="email"
                      placeholder="Enter your email address"
                      value={emailConfirmationInput}
                      onChange={(e) => setEmailConfirmationInput(e.target.value)}
                      className={styles.emailInput}
                      autoFocus
                    />
                    {emailConfirmationInput && emailConfirmationInput !== user?.email && (
                      <div className={styles.emailMismatch}>
                        Email does not match. Please try again.
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.deleteModalActions}>
                  <button 
                    onClick={handleDeleteConfirmationBack}
                    className={styles.backButton}
                  >
                    Back
                  </button>
                  <button 
                    onClick={executeAccountDeletion}
                    disabled={emailConfirmationInput !== user?.email}
                    className={styles.deleteButton}
                  >
                    Delete Account
                  </button>
                </div>
              </>
            )}

            {deleteConfirmationStep === 'complete' && deletionResults && (
              <>
                <div className={styles.deleteModalHeader}>
                  <div className={styles.successIcon}>✅</div>
                  <h3>Account Deletion Complete</h3>
                </div>
                <div className={styles.deleteModalContent}>
                  <div className={styles.completionMessage}>
                    <p><strong>Account deletion process completed!</strong></p>
                    
                    <div className={styles.deletionResultsContainer}>
                      {/* Game Servers Results */}
                      <div className={styles.deletionResultSection}>
                        <h4>🎮 Game Servers</h4>
                        {deletionResults.gameServers && deletionResults.gameServers.length > 0 ? (
                          <div className={styles.serverResults}>
                            {deletionResults.gameServers.map((server: any, index: number) => (
                              <div key={index} className={`${styles.serverResult} ${server.success ? styles.success : styles.failure}`}>
                                <div className={styles.serverResultHeader}>
                                  <span className={styles.serverResultIcon}>
                                    {server.success ? '✅' : '❌'}
                                  </span>
                                  <span className={styles.serverResultName}>
                                    {server.serverName}
                                  </span>
                                  <span className={styles.serverResultStatus}>
                                    {server.success ? 'Success' : 'Failed'}
                                  </span>
                                </div>
                                <div className={styles.serverResultDetails}>
                                  <small>{server.serverAddress}</small>
                                  {!server.success && server.error && (
                                    <div className={styles.errorDetails}>
                                      Error: {server.error}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={styles.noServers}>No game servers were processed.</div>
                        )}
                      </div>

                      {/* Landing Page Results */}
                      <div className={styles.deletionResultSection}>
                        <h4>📝 Landing Page Data</h4>
                        <div className={`${styles.landingResult} ${deletionResults.landingPage?.success ? styles.success : styles.failure}`}>
                          <span className={styles.resultIcon}>
                            {deletionResults.landingPage?.success ? '✅' : '❌'}
                          </span>
                          <span className={styles.resultText}>
                            {deletionResults.landingPage?.success ? 'Successfully deleted' : 'Failed to delete'}
                          </span>
                          {!deletionResults.landingPage?.success && deletionResults.landingPage?.error && (
                            <div className={styles.errorDetails}>
                              Error: {deletionResults.landingPage.error}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Firebase Results */}
                      <div className={styles.deletionResultSection}>
                        <h4>🔐 Firebase Account</h4>
                        <div className={`${styles.firebaseResult} ${deletionResults.firebase?.success ? styles.success : styles.failure}`}>
                          <span className={styles.resultIcon}>
                            {deletionResults.firebase?.success ? '✅' : '❌'}
                          </span>
                          <span className={styles.resultText}>
                            {deletionResults.firebase?.success ? 'Successfully deleted' : 'Failed to delete'}
                          </span>
                          {!deletionResults.firebase?.success && deletionResults.firebase?.error && (
                            <div className={styles.errorDetails}>
                              Error: {deletionResults.firebase.error}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Summary */}
                      <div className={styles.deletionSummarySection}>
                        <h4>📊 Summary</h4>
                        <div className={styles.summaryStats}>
                          {deletionResults.gameServers && (
                            <div className={styles.summaryItem}>
                              <span>Game Servers:</span>
                              <span>
                                {deletionResults.gameServers.filter((s: any) => s.success).length} successful, {' '}
                                {deletionResults.gameServers.filter((s: any) => !s.success).length} failed
                              </span>
                            </div>
                          )}
                          <div className={styles.summaryItem}>
                            <span>Landing Page:</span>
                            <span>{deletionResults.landingPage?.success ? 'Deleted' : 'Failed'}</span>
                          </div>
                          <div className={styles.summaryItem}>
                            <span>Firebase Account:</span>
                            <span>{deletionResults.firebase?.success ? 'Deleted' : 'Failed'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {!deletionResults.firebase?.success && (
                      <div className={styles.supportMessage}>
                        <p><strong>⚠️ Important:</strong> Since Firebase account deletion failed, please contact support for manual account removal:</p>
                        <p>
                          <a href="https://github.com/organicfreshcoffee/landing/issues" target="_blank" rel="noopener noreferrer">
                            GitHub Issues
                          </a>
                        </p>
                      </div>
                    )}

                    <p>You will now be redirected to the home page.</p>
                  </div>
                </div>
                <div className={styles.deleteModalActions}>
                  <button 
                    onClick={async () => {
                      try {
                        console.log('Logging out user...');
                        await logout();
                        router.push('/');
                      } catch (logoutError) {
                        console.error('Failed to logout after account deletion:', logoutError);
                        window.location.href = '/';
                      }
                    }}
                    className={styles.primaryButton}
                  >
                    Go to Home Page
                  </button>
                </div>
              </>
            )}

            {deleteConfirmationStep === 'error' && (
              <>
                <div className={styles.deleteModalHeader}>
                  <div className={styles.errorIcon}>❌</div>
                  <h3>Deletion Error</h3>
                </div>
                <div className={styles.deleteModalContent}>
                  <div className={styles.errorMessage}>
                    <p><strong>An unexpected error occurred during account deletion.</strong></p>
                    
                    {deletionResults?.error && (
                      <div className={styles.errorDetailsBox}>
                        <h4>Error Details:</h4>
                        <p>{deletionResults.message}</p>
                      </div>
                    )}
                    
                    <p>Some data may have been deleted, but the process was not completed.</p>
                    <p>Please contact support for assistance: 
                      <a href="https://github.com/organicfreshcoffee/landing/issues" target="_blank" rel="noopener noreferrer">
                        GitHub Issues
                      </a>
                    </p>
                    <p>You will now be logged out for security.</p>
                  </div>
                </div>
                <div className={styles.deleteModalActions}>
                  <button 
                    onClick={async () => {
                      try {
                        await logout();
                        router.push('/');
                      } catch (logoutError) {
                        console.error('Failed to logout after deletion error:', logoutError);
                        window.location.href = '/';
                      }
                    }}
                    className={styles.primaryButton}
                  >
                    Logout and Go Home
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isViewingAccountData && accountData && (
        <div className={styles.exportOverlay}>
          <div className={styles.accountDataModal}>
            <div className={styles.accountDataHeader}>
              <h3>Account Data</h3>
              <button 
                onClick={() => setIsViewingAccountData(false)}
                className={styles.closeButton}
              >
                ✕
              </button>
            </div>
            <div className={styles.accountDataContent}>
              
              {/* Firebase Data Section */}
              <div className={styles.dataSection}>
                <h4>🔐 Firebase Authentication Data</h4>
                <div className={styles.dataGrid}>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>User ID:</span>
                    <span className={styles.dataValue}>{accountData.firebase.uid}</span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>Email:</span>
                    <span className={styles.dataValue}>{accountData.firebase.email}</span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>Email Verified:</span>
                    <span className={styles.dataValue}>{accountData.firebase.emailVerified ? 'Yes' : 'No'}</span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>Display Name:</span>
                    <span className={styles.dataValue}>{accountData.firebase.displayName || 'Not set'}</span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>Account Created:</span>
                    <span className={styles.dataValue}>{accountData.firebase.creationTime}</span>
                  </div>
                  <div className={styles.dataItem}>
                    <span className={styles.dataLabel}>Last Sign In:</span>
                    <span className={styles.dataValue}>{accountData.firebase.lastSignInTime}</span>
                  </div>
                </div>
              </div>

              {/* Landing Page Data Section */}
              <div className={styles.dataSection}>
                <h4>📝 Landing Page Data</h4>
                {accountData.landingPage.error ? (
                  <div className={styles.errorBox}>
                    <strong>Error:</strong> {accountData.landingPage.error}
                    {accountData.landingPage.details && (
                      <div><strong>Details:</strong> {JSON.stringify(accountData.landingPage.details)}</div>
                    )}
                  </div>
                ) : (
                  <div>
                    {/* Admin Data */}
                    {accountData.landingPage.adminData && (
                      <div className={styles.subDataSection}>
                        <h5>🔧 Admin Privileges</h5>
                        <div className={styles.adminBadge}>
                          <p><strong>Admin Status:</strong> ✅ Active</p>
                          <pre className={styles.jsonData}>{JSON.stringify(accountData.landingPage.adminData, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                    
                    {/* Login History */}
                    <div className={styles.subDataSection}>
                      <h5>🔐 Login History</h5>
                      {accountData.landingPage.loginHistory && accountData.landingPage.loginHistory.length > 0 ? (
                        <pre className={styles.jsonData}>{JSON.stringify(accountData.landingPage.loginHistory, null, 2)}</pre>
                      ) : (
                        <p>No login history available.</p>
                      )}
                    </div>
                    
                    {/* Audit Logs */}
                    <div className={styles.subDataSection}>
                      <h5>📋 Audit Logs (Data Access History)</h5>
                      {accountData.landingPage.auditLogs && accountData.landingPage.auditLogs.length > 0 ? (
                        <div>
                          <p className={styles.auditNote}>
                            ℹ️ These logs track when you access, view, export, or delete your data for compliance purposes.
                          </p>
                          <pre className={styles.jsonData}>{JSON.stringify(accountData.landingPage.auditLogs, null, 2)}</pre>
                        </div>
                      ) : (
                        <p>No audit logs available yet. Audit logs are created when you view, export, or delete your data.</p>
                      )}
                    </div>
                    
                    {/* Metadata */}
                    {accountData.landingPage.viewMetadata && (
                      <div className={styles.subDataSection}>
                        <h5>📊 View Metadata</h5>
                        <pre className={styles.jsonData}>{JSON.stringify(accountData.landingPage.viewMetadata, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Game Servers Data Section */}
              <div className={styles.dataSection}>
                <h4>🎮 Game Server Data</h4>
                {accountData.gameServers.length === 0 ? (
                  <p>No game servers available.</p>
                ) : (
                  accountData.gameServers.map((server, index) => (
                    <div key={index} className={styles.serverDataSection}>
                      <h5>{server.serverName} ({server.serverAddress})</h5>
                      {server.success ? (
                        <pre className={styles.jsonData}>{JSON.stringify(server.data, null, 2)}</pre>
                      ) : (
                        <div className={styles.errorBox}>
                          <strong>Failed to retrieve data:</strong> {server.error}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className={styles.header}>
        <h1 className={styles.title}>Organic Fresh Coffee</h1>
        {user && (
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
                  {isAdmin && (
                    <button 
                      onClick={() => router.push('/admin')}
                      className={styles.accountMenuItem}
                    >
                      🔧 Admin Panel
                    </button>
                  )}
                  <button 
                    onClick={handleViewAccountData}
                    className={styles.accountMenuItem}
                    disabled={isExporting || isDeleting || isLoadingAccountData}
                  >
                    {isLoadingAccountData ? (
                      <>
                        <span className={styles.spinner}></span>
                        Loading...
                      </>
                    ) : (
                      <>👁️ View Account Data</>
                    )}
                  </button>
                  <button 
                    onClick={handleExportAccountData}
                    className={styles.accountMenuItem}
                    disabled={isExporting || isDeleting || isLoadingAccountData}
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
                    disabled={isExporting || isDeleting || isLoadingAccountData}
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
        )}
      </div>

      {user && (
        <div className={styles.content}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Game Servers</h2>
          </div>
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
              {loadingServers ? (
                <div className={styles.loading}>Loading servers...</div>
              ) : (
                <div className={styles.table}>
                  <div className={styles.tableHeader}>
                    <div className={styles.tableCell}>Server Name</div>
                    <div className={styles.tableCell}>Server Address</div>
                    <div className={styles.tableCell}>Status</div>
                    <div className={styles.tableCell}>Players</div>
                    <div className={styles.tableCell}>Ping</div>
                    <div className={styles.tableCell}>Action</div>
                  </div>
                  {servers.filter(server => server.is_official).map((server) => (
                    <div key={server._id} className={styles.tableRow}>
                      <div className={styles.tableCell}>{server.server_name}</div>
                      <div className={styles.tableCell}>{server.server_address}</div>
                      <div className={styles.tableCell}>{renderServerStatus(server._id)}</div>
                      <div className={styles.tableCell}>{renderPlayerCount(server._id)}</div>
                      <div className={styles.tableCell}>{renderPingTime(server._id)}</div>
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
              )}
            </div>

            {/* Third Party Servers Section */}
            <div className={styles.serverSection}>
              <h3 className={styles.subsectionTitle}>Third Party Servers</h3>
              {loadingServers ? (
                <div className={styles.loading}>Loading servers...</div>
              ) : (
                <div className={styles.table}>
                  <div className={styles.tableHeader}>
                    <div className={styles.tableCell}>Server Name</div>
                    <div className={styles.tableCell}>Server Address</div>
                    <div className={styles.tableCell}>Status</div>
                    <div className={styles.tableCell}>Players</div>
                    <div className={styles.tableCell}>Ping</div>
                    <div className={styles.tableCell}>Action</div>
                  </div>
                  {servers.filter(server => server.is_third_party).map((server) => (
                    <div key={server._id} className={styles.tableRow}>
                      <div className={styles.tableCell}>{server.server_name}</div>
                      <div className={styles.tableCell}>{server.server_address}</div>
                      <div className={styles.tableCell}>{renderServerStatus(server._id)}</div>
                      <div className={styles.tableCell}>{renderPlayerCount(server._id)}</div>
                      <div className={styles.tableCell}>{renderPingTime(server._id)}</div>
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
              )}
            </div>
          </div>
        </div>
      )}
      
      <PrivacyPolicy />
    </div>
  );
}
