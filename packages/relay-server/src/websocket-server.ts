/**
 * WebSocket server implementation for VRChat OSC relay
 */
import { createLogger } from '@vrchat-mcp-osc/utils';
import { WebSocket, WebSocketServer } from 'ws';

// Setup logger
const logger = createLogger('WebSocketServer');

/**
 * WebSocket server configuration
 */
export interface WebSocketServerConfig {
  /** Host to bind to */
  host: string;
  /** Port to listen on */
  port: number;
}

/**
 * WebSocket server status
 */
export interface WebSocketServerStatus {
  /** Whether the server is running */
  running: boolean;
  /** Host the server is bound to */
  host: string;
  /** Port the server is listening on */
  port: number;
  /** Number of connected clients */
  clientCount: number;
}

/**
 * WebSocket server for VRChat OSC relay
 */
export class RelayWebSocketServer {
  private server: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private config: WebSocketServerConfig;
  private messageHandler: (websocket: WebSocket, message: any) => Promise<void>;
  private running: boolean = false;

  /**
   * Create a new WebSocket server
   * 
   * @param config Server configuration
   * @param messageHandler Handler for incoming messages
   */
  constructor(
    config: WebSocketServerConfig,
    messageHandler: (websocket: WebSocket, message: any) => Promise<void>
  ) {
    this.config = config;
    this.messageHandler = messageHandler;
  }

  /**
   * Start the WebSocket server
   * 
   * @returns Promise resolving to true if started successfully
   */
  public async start(): Promise<boolean> {
    if (this.running) {
      logger.info('WebSocket server is already running');
      return true;
    }

    try {
      // Create server
      this.server = new WebSocketServer({
        host: this.config.host,
        port: this.config.port
      });

      // Set up event handlers
      this.server.on('connection', this.handleConnection.bind(this));
      this.server.on('error', this.handleError.bind(this));

      this.running = true;
      //logger.info(`WebSocket server listening on ${this.config.host}:${this.config.port}`);
      return true;
    } catch (error) {
      logger.error(`Error starting WebSocket server: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Stop the WebSocket server
   * 
   * @returns Promise resolving when server is stopped
   */
  public async stop(): Promise<void> {
    if (!this.running || !this.server) {
      logger.info('WebSocket server is not running');
      return;
    }

    try {
      // Close all client connections
      for (const client of this.clients) {
        client.close();
      }
      this.clients.clear();

      // Close server
      await new Promise<void>((resolve, reject) => {
        if (!this.server) {
          resolve();
          return;
        }

        this.server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.server = null;
      this.running = false;
      logger.info('WebSocket server stopped');
    } catch (error) {
      logger.error(`Error stopping WebSocket server: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Handle a new WebSocket connection
   * 
   * @param websocket WebSocket connection
   */
  private handleConnection(websocket: WebSocket): void {
    logger.info('New WebSocket connection');
    
    // Add client to set
    this.clients.add(websocket);
    
    // Set up client event handlers
    websocket.on('message', (data) => this.handleMessage(websocket, data));
    
    websocket.on('close', () => {
      logger.info('WebSocket connection closed');
      this.clients.delete(websocket);
    });
    
    websocket.on('error', (error) => {
      logger.error(`WebSocket error: ${error.message}`);
      this.clients.delete(websocket);
    });
    
    // Send welcome message
    this.sendToClient(websocket, {
      type: 'event',
      action: 'connected',
      data: {
        message: 'Connected to VRChat OSC relay server'
      }
    });
  }

  /**
   * Handle an incoming WebSocket message
   * 
   * @param websocket WebSocket connection
   * @param data Message data
   */
  private handleMessage(websocket: WebSocket, data: WebSocket.Data): void {
    try {
      const messageText = data.toString();
      const message = JSON.parse(messageText);
      
      // Pass to message handler
      this.messageHandler(websocket, message).catch((error) => {
        logger.error(`Error handling message: ${error.message}`);
      });
    } catch (error) {
      logger.error(`Error parsing WebSocket message: ${error instanceof Error ? error.message : String(error)}`);
      
      // Send error response
      this.sendToClient(websocket, {
        type: 'error',
        data: {
          message: 'Invalid JSON message'
        }
      });
    }
  }

  /**
   * Handle WebSocket server errors
   * 
   * @param error Error object
   */
  private handleError(error: Error): void {
    //logger.error(`WebSocket server error: ${error.message}`);
    
    // Attempt to restart server if it crashed
    if (this.running) {
      this.running = false;
      this.server = null;
      
      //logger.info('Attempting to restart WebSocket server');
      this.start().catch((error) => {
        logger.error(`Failed to restart WebSocket server: ${error.message}`);
      });
    }
  }

  /**
   * Send a message to a specific client
   * 
   * @param websocket WebSocket client
   * @param message Message to send
   * @returns Promise resolving when message is sent
   */
  public async sendToClient(websocket: WebSocket, message: any): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (websocket.readyState !== WebSocket.OPEN) {
        resolve(); // Client is not connected, silently ignore
        return;
      }
      
      const messageJson = JSON.stringify(message);
      
      websocket.send(messageJson, (error) => {
        if (error) {
          logger.error(`Error sending message to client: ${error.message}`);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Broadcast a message to all connected clients
   * 
   * @param message Message to broadcast
   * @returns Promise resolving when message is sent to all clients
   */
  public async broadcast(message: any): Promise<void> {
    const promises = Array.from(this.clients).map((client) => this.sendToClient(client, message));
    await Promise.all(promises);
  }

  /**
   * Get the status of the WebSocket server
   * 
   * @returns Status object
   */
  public getStatus(): WebSocketServerStatus {
    return {
      running: this.running,
      host: this.config.host,
      port: this.config.port,
      clientCount: this.clients.size
    };
  }
}