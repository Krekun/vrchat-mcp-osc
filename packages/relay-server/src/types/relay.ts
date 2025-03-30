/**
 * Relay server specific types
 */
import { AvatarInfo, OscClientStatus } from '@vrchat-mcp-osc/types';

/**
 * Relay server actions
 */
export type RelayAction = 
  | 'test'
  | 'getStatus'
  | 'sendOsc'
  | 'avatar/getInfo'
  | 'avatar/getParameters'
  | 'avatar/setParameter'
  | 'input/sendCommand'
  | 'avatar/getAvatarlist'
  | 'avatar/setAvatar'
  | 'chatbox/sendMessage';

/**
 * WebSocket server status
 */
export interface WebSocketStatus {
  /** Whether the server is running */
  running: boolean;
  /** Server host */
  host: string;
  /** Server port */
  port: number;
  /** Number of connected clients */
  clientCount: number;
}

/**
 * Relay server status
 */
export interface RelayServerStatus {
  /** Whether the server is running */
  running: boolean;
  /** WebSocket server status */
  websocket: WebSocketStatus;
  /** OSC client status */
  osc: OscClientStatus;
  /** Avatar info */
  avatar: AvatarInfo | null;
  /** Number of known parameters */
  parameters: number;
}