/**
 * Server context for sharing resources between tools
 */
import { WebSocketClient } from '../ws-client.js';
import { AvatarTools } from '../tools/avatarTools.js';
import { InputTools } from '../tools/inputTools.js';

/**
 * Server context for sharing resources between tools
 */
export interface ServerContext {
  /** WebSocket client for communicating with relay server */
  wsClient: WebSocketClient;
  /** Avatar tools for controlling avatar parameters */
  avatarTools: AvatarTools;
  /** Input tools for controlling input */
  inputTools: InputTools;
}