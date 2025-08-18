import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import { apiEndpoints } from '../lib/api';
import axios from 'axios';
import styles from '../styles/Admin.module.css';

interface Server {
  _id: string;
  server_name: string;
  server_address: string;
  is_official: boolean;
  is_third_party: boolean;
  created_at?: string;
  updated_at?: string;
}

interface NewServer {
  server_name: string;
  server_address: string;
  is_official: boolean;
  is_third_party: boolean;
}

export default function Admin() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [newServer, setNewServer] = useState<NewServer>({
    server_name: '',
    server_address: '',
    is_official: false,
    is_third_party: false
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
      fetchServers();
    }
  }, [user]);

  const checkAdminStatus = async () => {
    try {
      if (!user) return;
      const token = await user.getIdToken();
      const response = await axios.get(`${apiEndpoints.checkAdmin()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsAdmin(response.data.isAdmin);
      
      if (!response.data.isAdmin) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
      router.push('/dashboard');
    }
  };

  const fetchServers = async () => {
    try {
      if (!user) return;
      const token = await user.getIdToken();
      const response = await axios.get(`${apiEndpoints.adminServers()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServers(response.data);
    } catch (error) {
      console.error('Error fetching servers:', error);
    } finally {
      setLoadingServers(false);
    }
  };

  const handleAddServer = async () => {
    if (!newServer.server_name.trim() || !newServer.server_address.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    if (!user) return;
    setActionLoading('add');
    try {
      const token = await user.getIdToken();
      await axios.post(`${apiEndpoints.adminServers()}`, newServer, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNewServer({
        server_name: '',
        server_address: '',
        is_official: false,
        is_third_party: false
      });
      setShowAddForm(false);
      await fetchServers();
    } catch (error) {
      console.error('Error adding server:', error);
      alert('Failed to add server');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateServer = async () => {
    if (!editingServer || !user) return;

    setActionLoading(`update-${editingServer._id}`);
    try {
      const token = await user.getIdToken();
      await axios.put(`${apiEndpoints.adminServers()}/${editingServer._id}`, editingServer, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setEditingServer(null);
      await fetchServers();
    } catch (error) {
      console.error('Error updating server:', error);
      alert('Failed to update server');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteServer = async (serverId: string, serverName: string) => {
    if (!confirm(`Are you sure you want to delete server "${serverName}"?`) || !user) {
      return;
    }

    setActionLoading(`delete-${serverId}`);
    try {
      const token = await user.getIdToken();
      await axios.delete(`${apiEndpoints.adminServers()}/${serverId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      await fetchServers();
    } catch (error) {
      console.error('Error deleting server:', error);
      alert('Failed to delete server');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || isAdmin === null) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!isAdmin) {
    return <div className={styles.error}>Access denied. Admin privileges required.</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Admin Panel</h1>
        <button onClick={() => router.push('/dashboard')} className={styles.backButton}>
          ← Back to Dashboard
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Server Management</h2>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className={styles.primaryButton}
          >
            {showAddForm ? 'Cancel' : '+ Add Server'}
          </button>
        </div>

        {showAddForm && (
          <div className={styles.formSection}>
            <h3>Add New Server</h3>
            <div className={styles.form}>
              <input
                type="text"
                placeholder="Server Name"
                value={newServer.server_name}
                onChange={(e) => setNewServer({ ...newServer, server_name: e.target.value })}
                className={styles.input}
              />
              <input
                type="text"
                placeholder="Server Address"
                value={newServer.server_address}
                onChange={(e) => setNewServer({ ...newServer, server_address: e.target.value })}
                className={styles.input}
              />
              <div className={styles.checkboxGroup}>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={newServer.is_official}
                    onChange={(e) => setNewServer({ ...newServer, is_official: e.target.checked })}
                  />
                  Official Server
                </label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={newServer.is_third_party}
                    onChange={(e) => setNewServer({ ...newServer, is_third_party: e.target.checked })}
                  />
                  Third Party Server
                </label>
              </div>
              <button 
                onClick={handleAddServer}
                disabled={actionLoading === 'add'}
                className={styles.primaryButton}
              >
                {actionLoading === 'add' ? 'Adding...' : 'Add Server'}
              </button>
            </div>
          </div>
        )}

        <div className={styles.serversList}>
          {loadingServers ? (
            <div className={styles.loading}>Loading servers...</div>
          ) : (
            <>
              <h3>Official Servers</h3>
              {servers.filter(s => s.is_official).map((server) => (
                <div key={server._id} className={styles.serverItem}>
                  {editingServer?._id === server._id ? (
                    <div className={styles.editForm}>
                      <input
                        type="text"
                        value={editingServer.server_name}
                        onChange={(e) => setEditingServer({ ...editingServer, server_name: e.target.value })}
                        className={styles.input}
                      />
                      <input
                        type="text"
                        value={editingServer.server_address}
                        onChange={(e) => setEditingServer({ ...editingServer, server_address: e.target.value })}
                        className={styles.input}
                      />
                      <div className={styles.buttonGroup}>
                        <button 
                          onClick={handleUpdateServer}
                          disabled={actionLoading === `update-${server._id}`}
                          className={styles.primaryButton}
                        >
                          {actionLoading === `update-${server._id}` ? 'Saving...' : 'Save'}
                        </button>
                        <button 
                          onClick={() => setEditingServer(null)}
                          className={styles.secondaryButton}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.serverInfo}>
                      <div>
                        <strong>
                          {server.server_name}
                          <span className={`${styles.serverBadge} ${styles.officialBadge}`}>
                            Official
                          </span>
                        </strong>
                        <div className={styles.serverAddress}>{server.server_address}</div>
                      </div>
                      <div className={styles.buttonGroup}>
                        <button 
                          onClick={() => setEditingServer(server)}
                          className={styles.secondaryButton}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteServer(server._id, server.server_name)}
                          disabled={actionLoading === `delete-${server._id}`}
                          className={styles.dangerButton}
                        >
                          {actionLoading === `delete-${server._id}` ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <h3>Third Party Servers</h3>
              {servers.filter(s => s.is_third_party).map((server) => (
                <div key={server._id} className={styles.serverItem}>
                  {editingServer?._id === server._id ? (
                    <div className={styles.editForm}>
                      <input
                        type="text"
                        value={editingServer.server_name}
                        onChange={(e) => setEditingServer({ ...editingServer, server_name: e.target.value })}
                        className={styles.input}
                      />
                      <input
                        type="text"
                        value={editingServer.server_address}
                        onChange={(e) => setEditingServer({ ...editingServer, server_address: e.target.value })}
                        className={styles.input}
                      />
                      <div className={styles.buttonGroup}>
                        <button 
                          onClick={handleUpdateServer}
                          disabled={actionLoading === `update-${server._id}`}
                          className={styles.primaryButton}
                        >
                          {actionLoading === `update-${server._id}` ? 'Saving...' : 'Save'}
                        </button>
                        <button 
                          onClick={() => setEditingServer(null)}
                          className={styles.secondaryButton}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.serverInfo}>
                      <div>
                        <strong>
                          {server.server_name}
                          <span className={`${styles.serverBadge} ${styles.thirdPartyBadge}`}>
                            Third Party
                          </span>
                        </strong>
                        <div className={styles.serverAddress}>{server.server_address}</div>
                      </div>
                      <div className={styles.buttonGroup}>
                        <button 
                          onClick={() => setEditingServer(server)}
                          className={styles.secondaryButton}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteServer(server._id, server.server_name)}
                          disabled={actionLoading === `delete-${server._id}`}
                          className={styles.dangerButton}
                        >
                          {actionLoading === `delete-${server._id}` ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
