import styles from '../styles/ServerConnectionError.module.css';

interface ServerConnectionErrorProps {
  serverAddress: string;
  error: string;
  onRetry: () => void;
  onBack: () => void;
}

export default function ServerConnectionError({ 
  serverAddress, 
  error, 
  onRetry, 
  onBack 
}: ServerConnectionErrorProps) {
  return (
    <div className={styles.connectionError}>
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <h1>Unable to Connect to Server</h1>
        <div className={styles.serverInfo}>
          <strong>Server:</strong> {serverAddress}
        </div>
        <div className={styles.errorMessage}>
          <p>We couldn't establish a connection to the game server.</p>
          <details className={styles.errorDetails}>
            <summary>Error Details</summary>
            <code>{error}</code>
          </details>
        </div>
        <div className={styles.suggestions}>
          <h3>Possible solutions:</h3>
          <ul>
            <li>Check if the server is online and running</li>
            <li>Verify the server address is correct</li>
            <li>Check your internet connection</li>
            <li>The server might be temporarily unavailable</li>
          </ul>
        </div>
        <div className={styles.actions}>
          <button onClick={onRetry} className={styles.retryButton}>
            Try Again
          </button>
          <button onClick={onBack} className={styles.backButton}>
            Back to Server List
          </button>
        </div>
      </div>
    </div>
  );
}
