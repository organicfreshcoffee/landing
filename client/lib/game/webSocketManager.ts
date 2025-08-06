import { GameMessage, GameState } from './types';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private messageQueue: string[] = [];
  private maxQueueSize = 50;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPongTime = Date.now();
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private isReconnecting = false;

  constructor(
    private onStateChange: (state: GameState) => void,
    private onMessage: (message: GameMessage) => void
  ) {}

  async connect(serverAddress: string, user: any): Promise<void> {
    try {
      // Get the Firebase auth token
      let authToken = null;
      if (user) {
        try {
          authToken = await user.getIdToken();
        } catch (error) {
          console.error('Error getting auth token:', error);
          this.onStateChange({
            connected: false,
            error: 'Failed to get authentication token',
            loading: false
          });
          return;
        }
      }

      // Convert to WebSocket URL with appropriate protocol
      let wsUrl = serverAddress
        .replace(/^https?:\/\//, '') // Remove http/https prefix if present
        .replace(/^wss?:\/\//, '');   // Remove ws/wss prefix if present
      
      // Use secure WebSocket if page is served over HTTPS
      const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
      wsUrl = `${protocol}${wsUrl}`;

      // Add game endpoint if not present
      if (!wsUrl.includes('/game')) {
        wsUrl = `${wsUrl}/game`;
      }

      console.log('Attempting to connect to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.log('Connection timeout, closing WebSocket...');
          ws.close();
        }
      }, 10000);

      ws.onopen = () => {
        console.log('Connected to game server');
        clearTimeout(connectionTimeout);
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.lastPongTime = Date.now();
        
        this.onStateChange({
          connected: true,
          error: null,
          loading: false
        });

        // Send initial connection message
        this.sendConnectionMessage(user, authToken);
        this.startHeartbeat();
        this.startConnectionHealthCheck();
        
        // Send any queued messages
        setTimeout(() => this.sendQueuedMessages(), 100);
      };

      ws.onmessage = (event) => {
        try {
          const message: GameMessage = JSON.parse(event.data);
          
          // Handle pong messages for heartbeat
          if (message.type === 'pong') {
            this.lastPongTime = Date.now();
            return;
          }
          
          this.onMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(connectionTimeout);
        
        if (!this.isReconnecting) {
          this.onStateChange({
            connected: false,
            error: 'Connection error occurred',
            loading: false
          });
        }
      };

      ws.onclose = (event) => {
        console.log('Disconnected from game server. Code:', event.code, 'Reason:', event.reason);
        clearTimeout(connectionTimeout);
        this.stopHeartbeat();
        this.stopConnectionHealthCheck();
        
        this.onStateChange({
          connected: false,
          error: null,
          loading: false
        });

        // Attempt reconnection unless it was a manual close or auth failure
        if (event.code !== 1000 && event.code !== 1008 && !this.isReconnecting) {
          this.attemptReconnection(serverAddress, user);
        }
      };

    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      this.onStateChange({
        connected: false,
        error: 'Invalid server address or authentication failed',
        loading: false
      });
    }
  }

  private sendConnectionMessage(user: any, authToken: string | null): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      this.ws.send(JSON.stringify({
        type: 'connect',
        data: {
          playerId: user?.uid,
          userEmail: user?.email,
          authToken: authToken,
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          isMoving: false,
          movementDirection: 'none'
        }
      }));
    } catch (error) {
      console.error('Error sending initial connection message:', error);
    }
  }

  send(message: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queueMessage(message);
      return false;
    }

    try {
      this.ws.send(message);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      this.queueMessage(message);
      return false;
    }
  }

  private queueMessage(message: string): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift();
    }
    this.messageQueue.push(message);
  }

  private sendQueuedMessages(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          this.ws.send(message);
        } catch (error) {
          console.error('Error sending queued message:', error);
          this.messageQueue.unshift(message);
          break;
        }
      }
    }
  }

  private attemptReconnection(serverAddress: string, user: any): void {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log('Max reconnection attempts reached');
        this.onStateChange({
          connected: false,
          error: 'Connection lost. Please refresh to reconnect.',
          loading: false
        });
      }
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
    
    this.onStateChange({
      connected: false,
      error: `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      loading: true
    });

    this.reconnectTimeout = setTimeout(() => {
      this.connect(serverAddress, user);
    }, delay);
  }

  manualReconnect(serverAddress: string, user: any): void {
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.onStateChange({
      connected: false,
      error: null,
      loading: true
    });
    
    this.connect(serverAddress, user);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('Error sending ping:', error);
        }
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private startConnectionHealthCheck(): void {
    this.stopConnectionHealthCheck();
    
    this.connectionCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastPong = now - this.lastPongTime;
      
      if (timeSinceLastPong > 60000) {
        console.log('Connection appears to be dead (no pong received), closing...');
        if (this.ws) {
          this.ws.close();
        }
      }
    }, 5000);
  }

  private stopConnectionHealthCheck(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  adjustHeartbeatForVisibility(isVisible: boolean): void {
    if (!isVisible) {
      // Page is hidden - reduce ping frequency
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send(JSON.stringify({ type: 'ping' }));
            } catch (error) {
              console.error('Error sending ping:', error);
            }
          }
        }, 60000);
      }
    } else {
      // Page is visible - restore normal ping frequency
      this.startHeartbeat();
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close(1000, 'Component unmounting');
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.stopHeartbeat();
    this.stopConnectionHealthCheck();
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get reconnectAttemptsCount(): number {
    return this.reconnectAttempts;
  }

  get maxReconnectAttemptsCount(): number {
    return this.maxReconnectAttempts;
  }
}
