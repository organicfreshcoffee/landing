import { useState } from 'react';
import styles from '../styles/ConsentBanner.module.css';

interface ConsentBannerProps {
  onConsentChange: (hasConsented: boolean) => void;
  hasConsented: boolean;
}

export default function ConsentBanner({ onConsentChange, hasConsented }: ConsentBannerProps) {
  const [isPrivacyPolicyExpanded, setIsPrivacyPolicyExpanded] = useState(false);

  return (
    <div className={styles.consentContainer}>
      <div className={styles.consentContent}>
        <div className={styles.consentHeader}>
          <h3>Privacy & Data Consent</h3>
        </div>
        
        <div className={styles.consentText}>
          <p>
            By creating an account, you consent to our processing of your email address, 
            login history, and game data as described in our Privacy Policy.
          </p>

          <div className={styles.privacyPolicySection}>
            <button 
              type="button"
              onClick={() => setIsPrivacyPolicyExpanded(!isPrivacyPolicyExpanded)}
              className={styles.privacyPolicyToggle}
            >
              📋 View Full Privacy Policy {isPrivacyPolicyExpanded ? '▲' : '▼'}
            </button>
            
            {isPrivacyPolicyExpanded && (
              <div className={styles.privacyPolicyPreview}>
                <p><strong>Summary:</strong> We collect minimal data for authentication and game services. 
                We don't sell your data, share it with other players, or use it for marketing. 
                Your data may be processed on US servers. You have full control over your data 
                with rights to view, export, correct, or delete it at any time.</p>
                
                <p>
                  <a 
                    href="https://github.com/organicfreshcoffee/landing/blob/main/PRIVACY.md" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.privacyPolicyLink}
                  >
                    📖 Read complete Privacy Policy on GitHub
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className={styles.consentCheckbox}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={hasConsented}
              onChange={(e) => onConsentChange(e.target.checked)}
              className={styles.checkbox}
            />
            <span className={styles.checkboxText}>
              I have read and agree to the Privacy Policy and consent to the processing 
              of my personal data as described above
            </span>
          </label>
        </div>
        
        <div className={styles.consentNote}>
          <p className={styles.noteText}>
            ℹ️ You must provide consent to create an account. You can withdraw consent 
            at any time by deleting your account from the account menu.
          </p>
        </div>
      </div>
    </div>
  );
}
