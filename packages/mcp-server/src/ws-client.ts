/**
 * WebSocket client for communicating with the VRChat OSC relay server.
 */

import { createLogger } from '@vrchat-mcp-osc/utils';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import {
  ParameterValue,
  WebSocketClientParams,
  WebSocketRequest
} from './types/index.js';

/**
 * Client for communicating with the VRChat OSC relay server via WebSockets.
 */
export class WebSocketClient {
  private host: string;
  private port: number;
  private wsUrl: string;
  private reconnectAttempts: number;
  private reconnectDelay: number;
  
  private websocket: WebSocket | null = null;
  private connected = false;
  private connectionPromise: Promise<boolean> | null = null;
  private eventHandlers: Map<string, Array<(data: any) => Promise<void>>> = new Map();
  private pendingRequests: Map<string, { 
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timer: NodeJS.Timeout;
  }> = new Map();
  
  private logger = createLogger('WebSocketClient');
  
  /**
   * Initialize the WebSocket client.
   * 
   * @param params - Client configuration parameters
   */
  constructor(params: WebSocketClientParams) {
    this.host = params.host || 'localhost';
    this.port = params.port || 8765;
    this.wsUrl = `ws://${this.host}:${this.port}`;
    this.reconnectAttempts = params.reconnectAttempts || 5;
    this.reconnectDelay = params.reconnectDelay || 2000;
  }
  
  /**
   * Connect to the WebSocket server.
   * 
   * @returns Promise resolving to true if connection was successful, false otherwise
   */
  public async connect(): Promise<boolean> {
    if (this.connectionPromise) {
      this.logger.info('Connection already in progress, returning existing promise');
      return this.connectionPromise;
    }
    
    if (this.connected && this.websocket) {
      this.logger.info('Already connected to WebSocket server');
      return true;
    }
    
    this.logger.info(`Connecting to WebSocket server at ${this.wsUrl}`);
    
    this.connectionPromise = new Promise<boolean>(async (resolve) => {
      for (let attempt = 0; attempt < this.reconnectAttempts; attempt++) {
        this.logger.info(`Connection attempt ${attempt + 1} of ${this.reconnectAttempts}`);
        
        try {
          // Create new WebSocket connection with timeout
          const connectionTimeout = setTimeout(() => {
            if (this.websocket && this.websocket.readyState !== WebSocket.OPEN) {
              this.logger.error('WebSocket connection timed out');
              this.websocket.terminate();
            }
          }, 10000); // 10 second connection timeout
          
          this.websocket = new WebSocket(this.wsUrl);
          
          // Set up event handlers
          const connectedPromise = new Promise<boolean>((resolveConn, rejectConn) => {
            if (!this.websocket) {
              clearTimeout(connectionTimeout);
              rejectConn(new Error('WebSocket is null'));
              return;
            }
            
            this.websocket.on('open', () => {
              clearTimeout(connectionTimeout);
              this.logger.info('Connected to WebSocket server');
              this.connected = true;
              
              // Start message handler
              this.setupMessageHandler();
              
              // Test connection with multiple retries for stability
              let testAttempts = 0;
              const maxTestAttempts = 3;
              const testConnection = async (): Promise<boolean> => {
                try {
                  testAttempts++;
                  this.logger.info(`Testing connection (attempt ${testAttempts} of ${maxTestAttempts})`);
                  const success = await this.testConnection();
                  
                  if (success) {
                    this.logger.info('Connection test successful');
                    return true;
                  } else if (testAttempts < maxTestAttempts) {
                    this.logger.warn(`Connection test failed, retrying (${testAttempts}/${maxTestAttempts})`);
                    await new Promise(r => setTimeout(r, 500)); // Short delay before retry
                    return testConnection();
                  } else {
                    this.logger.warn('All connection tests failed');
                    return false;
                  }
                } catch (error) {
                  if (testAttempts < maxTestAttempts) {
                    this.logger.warn(`Connection test error: ${error instanceof Error ? error.message : String(error)}, retrying`);
                    await new Promise(r => setTimeout(r, 500));
                    return testConnection();
                  } else {
                    this.logger.error(`Connection test failed after ${maxTestAttempts} attempts`);
                    throw error;
                  }
                }
              };
              
              testConnection()
                .then(success => {
                  if (success) {
                    resolveConn(true);
                  } else {
                    this.logger.warn('Connection test failed');
                    this.disconnect();
                    rejectConn(new Error('Connection test failed'));
                  }
                })
                .catch(error => {
                  this.logger.error(`Connection test error: ${error instanceof Error ? error.message : String(error)}`);
                  rejectConn(error);
                });
            });
            
            this.websocket.on('error', (error) => {
              this.logger.error(`WebSocket error: ${error.message}`);
              rejectConn(error);
            });
            
            this.websocket.on('close', () => {
              this.logger.info('WebSocket connection closed');
              this.connected = false;
              this.websocket = null;
              
              // Reject any pending requests
              this.pendingRequests.forEach((request, id) => {
                clearTimeout(request.timer);
                request.reject(new Error('WebSocket connection closed'));
                this.pendingRequests.delete(id);
              });
            });
          });
          
          try {
            const success = await connectedPromise;
            resolve(success);
            this.connectionPromise = null;
            return success;
          } catch (error) {
            this.logger.warn(`Connection attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
            
            if (attempt < this.reconnectAttempts - 1) {
              this.logger.info(`Retrying in ${this.reconnectDelay / 1000} seconds...`);
              await new Promise(r => setTimeout(r, this.reconnectDelay));
            }
          }
        } catch (error) {
          this.logger.error(`Error creating WebSocket: ${error instanceof Error ? error.message : String(error)}`);
          
          if (attempt < this.reconnectAttempts - 1) {
            this.logger.info(`Retrying in ${this.reconnectDelay / 1000} seconds...`);
            await new Promise(r => setTimeout(r, this.reconnectDelay));
          }
        }
      }
      
      this.logger.error(`Failed to connect after ${this.reconnectAttempts} attempts`);
      this.connected = false;
      this.connectionPromise = null;
      resolve(false);
      return false;
    });
    
    return this.connectionPromise;
  }
  
  /**
   * Disconnect from the WebSocket server.
   */
  public async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from WebSocket server');
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.connected = false;
    this.logger.info('Disconnected from WebSocket server');
  }
  
  /**
   * Set up handler for incoming WebSocket messages.
   */
  private setupMessageHandler(): void {
    if (!this.websocket) {
      this.logger.error('Cannot handle messages: No WebSocket connection');
      return;
    }
    
    this.websocket.on('message', (data: WebSocket.Data) => {
      try {
        // Get raw data as string
        const rawData = data.toString();
        this.logger.debug(`Received WebSocket message: ${rawData.substring(0, 200)}${rawData.length > 200 ? '...' : ''}`);
        
        // Enhanced BOM handling
        let messageText = rawData;
        if (rawData.length > 0 && rawData.charCodeAt(0) === 0xFEFF) {
          messageText = rawData.substring(1);
          this.logger.debug('Removed BOM marker from message');
        }
        
        // Ensure the text is properly trimmed
        messageText = messageText.trim();
        if (messageText.length === 0) {
          this.logger.warn('Received empty message, ignoring');
          return;
        }
        
        // Enhanced JSON parsing with additional error handling
        let message;
        try {
          message = JSON.parse(messageText);
        } catch (jsonError) {
          // Try to fix common JSON issues and retry
          this.logger.warn(`JSON parse error: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
          this.logger.debug(`Attempting to sanitize and retry parsing...`);
          
          // Handle potential invalid JSON by ensuring it starts and ends correctly
          const sanitized = messageText.replace(/\n/g, ' ').replace(/\t/g, ' ');
          try {
            message = JSON.parse(sanitized);
            this.logger.info('Successfully parsed JSON after sanitization');
          } catch (retryError) {
            throw new Error(`Failed to parse JSON after sanitization: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
          }
        }
        
        // Verify message has required properties before processing
        if (!message || typeof message !== 'object') {
          throw new Error('Message is not a valid object');
        }
        
        this.processMessage(message);
      } catch (error) {
        this.logger.error(`Failed to parse message: ${error instanceof Error ? error.message : String(error)}`);
        this.logger.debug(`Raw message content (full): ${data.toString().replace(/[\r\n]/g, ' ')}`);
        
        // Add more diagnostic information
        if (data instanceof Buffer) {
          this.logger.debug(`Message as hex: ${data.toString('hex').substring(0, 100)}...`);
        }
      }
    });
  }
  
  /**
   * Process an incoming WebSocket message.
   * 
   * @param data - The parsed message data
   */
  private processMessage(data: any): void {
    // Validate message structure
    if (!data || typeof data !== 'object') {
      this.logger.error('Invalid message format: not an object');
      return;
    }
    
    const messageType = data.type;
    if (!messageType) {
      this.logger.error('Invalid message format: missing type field');
      this.logger.debug(`Message content: ${JSON.stringify(data).substring(0, 200)}`);
      return;
    }
    
    this.logger.debug(`Processing message of type: ${messageType}`);
    
    if (messageType === 'response') {
      // Handle response to a request
      const requestId = data.id;
      if (!requestId) {
        this.logger.error('Invalid response: missing ID field');
        return;
      }
      
      if (this.pendingRequests.has(requestId)) {
        const request = this.pendingRequests.get(requestId)!;
        clearTimeout(request.timer);
        
        if (data.error) {
          const errorMsg = data.error.message || 'Unknown error';
          this.logger.warn(`Request error: ${errorMsg}`);
          request.reject(new Error(`Request error: ${errorMsg}`));
        } else {
          this.logger.debug(`Request ${requestId} succeeded`);
          request.resolve(data.data || {});
        }
        
        this.pendingRequests.delete(requestId);
      } else {
        this.logger.warn(`Received response for unknown request ID: ${requestId}`);
      }
    } else if (messageType === 'event') {
      // Handle event notification
      const action = data.action || 'unknown';
      
      this.logger.debug(`Received event: ${action}`);
      
      // Trigger specific event handlers
      if (this.eventHandlers.has(action)) {
        const handlers = this.eventHandlers.get(action)!;
        handlers.forEach(async (handler) => {
          try {
            await handler(data.data || {});
          } catch (error) {
            this.logger.error(`Error in event handler for ${action}: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      } else {
        this.logger.debug(`No handlers registered for event: ${action}`);
      }
      
      // Trigger 'all' event handlers
      if (this.eventHandlers.has('all')) {
        const handlers = this.eventHandlers.get('all')!;
        handlers.forEach(async (handler) => {
          try {
            await handler(data);
          } catch (error) {
            this.logger.error(`Error in 'all' event handler: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      }
    } else {
      this.logger.warn(`Unknown message type: ${messageType}`);
    }
  }
  
  /**
   * Send a request to the WebSocket server and wait for a response.
   * 
   * @param action - The action to perform
   * @param data - Request data
   * @param timeout - Timeout in milliseconds
   * @returns Promise resolving to the response data
   * @throws Error if not connected, if the request times out, or if the response contains an error
   */
  public async sendRequest<T>(
    action: string,
    data: Record<string, any> = {},
    timeout: number = 5000
  ): Promise<T> {
    if (!this.connected || !this.websocket) {
      throw new Error('Not connected to WebSocket server');
    }
    
    const requestId = uuidv4();
    const request: WebSocketRequest = {
      type: 'request',
      id: requestId,
      action,
      data
    };
    
    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request timed out: ${action}`));
        }
      }, timeout);
      
      // Store the pending request
      this.pendingRequests.set(requestId, { resolve, reject, timer });
      
      // Send the request
      this.websocket!.send(JSON.stringify(request), (error) => {
        if (error) {
          clearTimeout(timer);
          this.pendingRequests.delete(requestId);
          reject(new Error(`Failed to send request: ${error.message}`));
        }
      });
    });
  }
  
  /**
   * Register a handler for a specific event type.
   * 
   * @param eventType - Event type to handle
   * @param handler - Async function taking event data as argument
   */
  public registerEventHandler(eventType: string, handler: (data: any) => Promise<void>): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    
    this.eventHandlers.get(eventType)!.push(handler);
  }
  
  /**
   * Test the connection to the WebSocket server.
   * 
   * @returns Promise resolving to true if the test was successful, false otherwise
   */
  public async testConnection(): Promise<boolean> {
    try {
      if (!this.connected || !this.websocket) {
        this.logger.error('Cannot test connection: Not connected to WebSocket server');
        return false;
      }
      
      if (this.websocket.readyState !== WebSocket.OPEN) {
        this.logger.error(`Cannot test connection: WebSocket is in state ${this.websocket.readyState} (not OPEN)`);
        return false;
      }
      
      this.logger.debug('Sending test request to WebSocket server');
      const response = await this.sendRequest<{ status: string }>('test', {}, 3000); // Increased timeout for reliability
      
      // Enhanced validation of response
      if (!response) {
        this.logger.error('Connection test failed: Empty response');
        return false;
      }
      
      const isValid = response.status === 'ok';
      if (isValid) {
        this.logger.debug('Connection test succeeded');
      } else {
        this.logger.error(`Connection test failed: Unexpected status: ${response.status}`);
      }
      
      return isValid;
    } catch (error) {
      this.logger.error(`Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  /**
   * Get information about the current avatar.
   * 
   * @returns Promise resolving to avatar information (id, name)
   */
  public async getAvatarInfo(): Promise<{ id: string; name: string }> {
    try {
      // Enhanced debug logging
      this.logger.debug('Requesting avatar info');
      
      // Use increased timeout for avatar information
      const response = await this.sendRequest<{ avatar: { id: string; name: string } }>('avatar/getInfo', {}, 8000);
      
      // Validate response structure
      if (!response || !response.avatar) {
        throw new Error('Invalid response format: missing avatar data');
      }
      
      this.logger.info(`Avatar info received: ${JSON.stringify(response.avatar)}`);
      return response.avatar;
    } catch (error) {
      this.logger.error(`Error getting avatar info: ${error instanceof Error ? error.message : String(error)}`);
      // Return default value rather than throwing
      return { id: 'unknown', name: 'Unknown Avatar' };
    }
  }
  
  /**
   * Get a list of parameters for the current avatar.
   * 
   * @returns Promise resolving to a list of parameter names
   */
  public async getAvatarParameters(): Promise<string[]> {
    try {
      // デバッグ用にリクエスト送信をログ
      this.logger.debug(`Requesting avatar parameters...`);
      
      const response = await this.sendRequest<{ parameters: string[] | Record<string, unknown> }>('avatar/getParameters');
      this.logger.debug(`Avatar parameters response: ${JSON.stringify(response)}`);
      
      // パラメータが配列の場合はそのまま返す
      if (Array.isArray(response?.parameters)) {
        this.logger.debug(`Avatar parameters: ${JSON.stringify(response.parameters)}`);
        return response.parameters;
      }
      
      // パラメータがオブジェクトの場合はキーの配列に変換
      if (response?.parameters && typeof response.parameters === 'object') {
        const parameterNames = Object.keys(response.parameters);
        this.logger.debug(`Avatar parameters (converted from object): ${JSON.stringify(parameterNames)}`);
        return parameterNames;
      }
      
      // パラメータが存在しないか無効な場合
      this.logger.warn('Invalid or missing parameters in response');
      return [];
    } catch (error) {
      this.logger.error(`Error getting avatar parameters: ${error instanceof Error ? error.message : String(error)}`);
      // Return empty array rather than throwing
      return [];
    }
  }
  
  /**
   * Set an avatar parameter.
   * 
   * @param name - Parameter name
   * @param value - Parameter value
   * @returns Promise resolving to true if successful, false otherwise
   */
  public async setAvatarParameter(name: string, value: ParameterValue): Promise<boolean> {
    try {
      if (!name) {
        throw new Error('Parameter name is required');
      }
      
      // Enhanced debug logging
      this.logger.debug(`Setting avatar parameter: ${name} = ${value}`);
      
      // // Validate parameter value type
      // if (typeof value !== 'number' && typeof value !== 'boolean') {
      //   throw new Error(`Invalid parameter value type: ${typeof value}. Must be number or boolean.`);
      // }
      
      const response = await this.sendRequest<{ success: boolean }>('avatar/setParameter', {
        name,
        value
      }, 5000);
      
      if (response && response.success) {
        this.logger.debug(`Successfully set avatar parameter: ${name} = ${value}`);
        return true;
      } else {
        this.logger.warn(`Failed to set avatar parameter: ${name} = ${value}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error setting avatar parameter ${name}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  /**
   * Send an input command to VRChat.
   * 
   * @param inputName - Input name (e.g., "Jump", "Vertical")
   * @param value - Input value
   * @returns Promise resolving to true if successful, false otherwise
   */
  public async sendInput(inputName: string, value: number): Promise<boolean> {
    const response = await this.sendRequest<{ success: boolean }>('input/sendCommand', {
      name: inputName,
      value
    });
    this.logger.info(`Input response: ${JSON.stringify(response)}`);
    return response.success;
  }
  
  /**
   * Send a message to the VRChat chatbox.
   * 
   * @param message - Message to send
   * @param sendImmediately - Whether to send immediately
   * @param notification - Whether to play a notification sound
   * @returns Promise resolving to true if successful, false otherwise
   */
  public async sendChatboxMessage(
    message: string,
    sendImmediately: boolean = true,
    notification: boolean = true
  ): Promise<boolean> {
    const response = await this.sendRequest<{ success: boolean }>('chatbox/sendMessage', {
      message,
      immediate: sendImmediately,
      notification
    });
    this.logger.info(`Chatbox message response: ${JSON.stringify(response)}`);
    return response.success;
  }

  /**
   * Get a list of all available avatars.
   *
   * @returns Promise resolving to an object with avatar IDs as keys and names as values
   */
  public async getAvatarlist(): Promise<{ [avatarId: string]: string }> {
    try {
      const response = await this.sendRequest<{ avatars: { [avatarId: string]: string } }>('avatar/getAvatarlist');
      return response.avatars || {};
    } catch (error) {
      this.logger.error(`Error getting avatar list: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  }

  /**
   * Send a raw OSC message.
   *
   * @param address - OSC address to send to
   * @param value - Value to send
   * @returns Promise resolving to true if successful, false otherwise
   */
  /**
   * Change to a different avatar.
   *
   * @param avatarId - ID of the avatar to change to
   * @returns Promise resolving to true if successful, false otherwise
   */
  public async setAvatar(avatarId: string): Promise<boolean> {
    try {
      const response = await this.sendRequest<{ success: boolean }>('avatar/setAvatar', {
        avatarId
      });
      return response.success || false;
    } catch (error) {
      this.logger.error(`Error changing avatar: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  public async send_message(address: string, value: any): Promise<boolean> {
    try {
      const response = await this.sendRequest<{ success: boolean }>('sendOsc', {
        address,
        value
      });
      return response.success || false;
    } catch (error) {
      this.logger.error(`Error sending OSC message: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}