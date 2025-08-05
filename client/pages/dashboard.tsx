import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import axios from 'axios';
import styles from '../styles/Dashboard.module.css';

interface UserLogin {
  _id: string;
  userId: string;
  email: string;
  loginTime: string;
}

export default function Dashboard() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [userLogins, setUserLogins] = useState<UserLogin[]>([]);
  const [loadingLogins, setLoadingLogins] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchUserLogins();
    }
  }, [user]);

  const fetchUserLogins = async () => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user-logins`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setUserLogins(response.data);
    } catch (error) {
      console.error('Error fetching user logins:', error);
    } finally {
      setLoadingLogins(false);
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

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.userInfo}>
          <span>Welcome, {user.email}</span>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <h2 className={styles.sectionTitle}>Your Login History</h2>
        
        {loadingLogins ? (
          <div className={styles.loading}>Loading login history...</div>
        ) : (
          <div className={styles.loginList}>
            {userLogins.length === 0 ? (
              <p className={styles.emptyState}>No login history found.</p>
            ) : (
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>Email</div>
                  <div className={styles.tableCell}>Login Time</div>
                </div>
                {userLogins.map((login) => (
                  <div key={login._id} className={styles.tableRow}>
                    <div className={styles.tableCell}>{login.email}</div>
                    <div className={styles.tableCell}>
                      {new Date(login.loginTime).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
