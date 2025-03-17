/**
 * OSC related types
 */

/**
 * OSC client configuration options
 */
export interface OscOptions {
  /** IP to send OSC messages to */
  sendIp: string;
  /** Port to send OSC messages to */
  sendPort: number;
  /** IP to listen for OSC messages on */
  receiveIp: string;
  /** Port to listen for OSC messages on */
  receivePort: number;
}

/**
 * Represents the status of an OSC client
 */
export interface OscClientStatus {
  /** Whether the client is connected */
  connected: boolean;
  /** IP to send OSC messages to */
  sendIp: string;
  /** Port to send OSC messages to */
  sendPort: number;
  /** IP to listen for OSC messages on */
  receiveIp: string;
  /** Port to listen for OSC messages on */
  receivePort: number;
}

/**
 * Represents values that can be sent via OSC
 */
export type OscValue = number | string | boolean | (number | string | boolean)[];

/**
 * Avatar information
 */
export interface AvatarInfo {
  /** Avatar ID */
  id: string;
  /** Avatar name */
  name: string;
  /** Avatar name */
  parameters: Map<string, OscValue>;
}

/**
 * OSC event from VRChat
 */
export interface OscEvent {
  /** Type of event */
  eventType: string;
  /** OSC address */
  address: string;
  /** OSC arguments */
  args: any[];
}