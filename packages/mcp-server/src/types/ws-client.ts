/**
 * WebSocket client type definitions
 */

/**
 * WebSocket client configuration
 */
export interface WebSocketClientParams {
  /** Host to connect to */
  host?: string;
  /** Port to connect to */
  port?: number;
  /** Number of reconnection attempts */
  reconnectAttempts?: number;
  /** Delay between reconnection attempts in ms */
  reconnectDelay?: number;
}

/**
 * WebSocket request message
 */
export interface WebSocketRequest {
  /** Message type */
  type: 'request';
  /** Request ID */
  id: string;
  /** Action to perform */
  action: string;
  /** Request data */
  data?: Record<string, any>;
}