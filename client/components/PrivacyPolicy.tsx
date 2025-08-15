import { useState } from 'react';
import styles from '../styles/PrivacyPolicy.module.css';

export default function PrivacyPolicy() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={styles.privacyContainer}>
      <div className={styles.privacyHeader}>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className={styles.privacyToggle}
        >
          📋 Privacy Policy {isExpanded ? '▲' : '▼'}
        </button>
      </div>
      
      {isExpanded && (
        <div className={styles.privacyContent}>
          <h3>Privacy Policy</h3>
          <p><strong>Last Updated:</strong> 8/15/2025</p>
          
          <h4>1. Information We Collect</h4>
          <p>
            We collect minimal personal information necessary for user authentication and server moderation:
          </p>
          <ul>
            <li><strong>Email Address:</strong> Used for account authentication and server moderation purposes</li>
            <li><strong>Login History:</strong> Timestamps and IP addresses for security and moderation</li>
            <li><strong>Game Data:</strong> In-game progress and activities when you connect to game servers</li>
          </ul>

          <h4>2. How We Use Your Information</h4>
          <p>Your personal information is used exclusively for:</p>
          <ul>
            <li>User authentication and account management</li>
            <li>Server moderation and security</li>
            <li>Providing access to game servers</li>
          </ul>

          <h4>3. Information Sharing</h4>
          <p>
            <strong>Firebase Authentication:</strong> Your email address is shared with Firebase (Google) for authentication services.
          </p>
          <p>
            <strong>Game Servers:</strong> When you connect to game servers, your email address may be shared for moderation purposes. This includes:
          </p>
          <ul>
            <li>Official servers operated by us</li>
            <li>Third-party servers operated by independent parties</li>
          </ul>
          <p>
            <strong>Important:</strong> We cannot guarantee data privacy practices of third-party game servers. 
            Each third-party server may have different privacy policies and data handling practices.
          </p>

          <h4>4. What We Don't Do</h4>
          <ul>
            <li>❌ We do NOT share your email with other players</li>
            <li>❌ We do NOT sell your data to data brokers or advertisers</li>
            <li>❌ We do NOT use your data for marketing purposes</li>
            <li>❌ We do NOT track you across other websites</li>
          </ul>

          <h4>5. Your Rights (GDPR Compliance)</h4>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access:</strong> View all data we have about you</li>
            <li><strong>Export:</strong> Download all your data (available in account menu)</li>
            <li><strong>Rectification:</strong> Correct any inaccurate personal data</li>
            <li><strong>Erasure:</strong> Delete your account and all associated data (available in account menu)</li>
            <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
          </ul>

          <h4>6. Data Security</h4>
          <p>
            We implement appropriate security measures to protect your personal information against 
            unauthorized access, alteration, disclosure, or destruction. However, no internet 
            transmission is 100% secure.
          </p>

          <h4>7. Data Retention</h4>
          <p>
            We retain your personal information only as long as necessary for the purposes outlined 
            in this policy or as required by law. You can delete your account at any time using 
            the account deletion feature.
          </p>

          <h4>8. Third-Party Services</h4>
          <p>
            We use Firebase (Google) for authentication. Please review Google's privacy policy at{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              https://policies.google.com/privacy
            </a>
          </p>

          <h4>9. Children's Privacy</h4>
          <p>
            Our service is not intended for children under 13. We do not knowingly collect 
            personal information from children under 13.
          </p>

          <h4>10. Changes to This Policy</h4>
          <p>
            We may update this privacy policy from time to time. We will notify users of any 
            material changes by updating the "Last Updated" date above.
          </p>

          <h4>11. Contact Us</h4>
          <p>
            If you have questions about this privacy policy or your personal data, please contact us at:{' '}
            <a href="https://github.com/organicfreshcoffee/landing/issues" target="_blank" rel="noopener noreferrer">
              GitHub Issues
            </a>
          </p>

          <div className={styles.disclaimer}>
            <h4>⚠️ Third-Party Server Disclaimer</h4>
            <p>
              <strong>Important Notice:</strong> When connecting to third-party game servers, 
              those servers operate independently with their own privacy policies and data 
              handling practices. We cannot control or guarantee how third-party servers 
              handle your personal information. Please review each third-party server's 
              privacy policy before connecting.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
