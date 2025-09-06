/**
 * Toast notification system for displaying messages to the user
 */
export class ToastManager {
  private static instance: ToastManager;
  private toastContainer: HTMLDivElement | null = null;
  private toastCounter = 0;

  private constructor() {
    this.createToastContainer();
  }

  static getInstance(): ToastManager {
    if (!this.instance) {
      this.instance = new ToastManager();
    }
    return this.instance;
  }

  /**
   * Create the toast container if it doesn't exist
   */
  private createToastContainer(): void {
    if (typeof document === 'undefined') return;

    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.id = 'toast-container';
      this.toastContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        pointer-events: none;
        font-family: 'Courier New', monospace;
      `;
      document.body.appendChild(this.toastContainer);
    }
  }

  /**
   * Show an error toast
   */
  showError(message: string, duration: number = 5000): void {
    this.showToast(message, 'error', duration);
  }

  /**
   * Show a success toast
   */
  showSuccess(message: string, duration: number = 3000): void {
    this.showToast(message, 'success', duration);
  }

  /**
   * Show an info toast
   */
  showInfo(message: string, duration: number = 3000): void {
    this.showToast(message, 'info', duration);
  }

  /**
   * Show a warning toast
   */
  showWarning(message: string, duration: number = 4000): void {
    this.showToast(message, 'warning', duration);
  }

  /**
   * Show a toast notification
   */
  private showToast(message: string, type: 'error' | 'success' | 'info' | 'warning', duration: number): void {
    if (!this.toastContainer) {
      this.createToastContainer();
    }

    const toastId = `toast-${++this.toastCounter}`;
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.style.cssText = `
      background: ${this.getBackgroundColor(type)};
      border: 2px solid ${this.getBorderColor(type)};
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 10px;
      min-width: 300px;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(10px);
      pointer-events: auto;
      cursor: pointer;
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s ease;
    `;

    // Create icon
    const icon = document.createElement('span');
    icon.style.cssText = `
      display: inline-block;
      margin-right: 8px;
      font-size: 16px;
    `;
    icon.textContent = this.getIcon(type);

    // Create message text
    const messageText = document.createElement('span');
    messageText.style.cssText = `
      color: #ffffff;
      font-size: 14px;
      line-height: 1.4;
      word-wrap: break-word;
    `;
    messageText.textContent = message;

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.style.cssText = `
      float: right;
      background: none;
      border: none;
      color: #ffffff;
      font-size: 16px;
      cursor: pointer;
      padding: 0;
      margin-left: 10px;
      opacity: 0.7;
      transition: opacity 0.2s ease;
    `;
    closeButton.textContent = '×';
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.opacity = '1';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.opacity = '0.7';
    });

    // Assemble toast
    toast.appendChild(closeButton);
    toast.appendChild(icon);
    toast.appendChild(messageText);

    // Add to container
    this.toastContainer!.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    });

    // Auto dismiss
    const dismissToast = () => {
      toast.style.transform = 'translateX(100%)';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    };

    // Click to dismiss
    toast.addEventListener('click', dismissToast);
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissToast();
    });

    // Auto dismiss after duration
    if (duration > 0) {
      setTimeout(dismissToast, duration);
    }
  }

  /**
   * Get background color for toast type
   */
  private getBackgroundColor(type: string): string {
    switch (type) {
      case 'error':
        return 'linear-gradient(135deg, rgba(244, 67, 54, 0.9), rgba(211, 47, 47, 0.9))';
      case 'success':
        return 'linear-gradient(135deg, rgba(76, 175, 80, 0.9), rgba(56, 142, 60, 0.9))';
      case 'warning':
        return 'linear-gradient(135deg, rgba(255, 152, 0, 0.9), rgba(245, 124, 0, 0.9))';
      case 'info':
      default:
        return 'linear-gradient(135deg, rgba(33, 150, 243, 0.9), rgba(25, 118, 210, 0.9))';
    }
  }

  /**
   * Get border color for toast type
   */
  private getBorderColor(type: string): string {
    switch (type) {
      case 'error':
        return '#f44336';
      case 'success':
        return '#4caf50';
      case 'warning':
        return '#ff9800';
      case 'info':
      default:
        return '#2196f3';
    }
  }

  /**
   * Get icon for toast type
   */
  private getIcon(type: string): string {
    switch (type) {
      case 'error':
        return '❌';
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  }

  /**
   * Clear all toasts
   */
  clearAll(): void {
    if (this.toastContainer) {
      this.toastContainer.innerHTML = '';
    }
  }

  /**
   * Dispose of the toast manager
   */
  dispose(): void {
    if (this.toastContainer && this.toastContainer.parentNode) {
      this.toastContainer.parentNode.removeChild(this.toastContainer);
      this.toastContainer = null;
    }
  }
}
