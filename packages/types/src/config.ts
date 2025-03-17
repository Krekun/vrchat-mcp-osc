/**
 * Configuration related types
 */

/**
 * Configuration interface for all components
 */
export interface ConfigOptions {
  /** Path to configuration file */
  configPath?: string;
  /** Environment variables prefix */
  envPrefix?: string;
  /** Default values */
  defaults?: Record<string, any>;
}

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
 * Relay server configuration
 */
export interface RelayServerConfig {
  /** WebSocket server configuration */
  websocket: WebSocketServerConfig;
  /** OSC configuration */
  osc: {
    /** OSC send configuration */
    send: {
      /** IP to send to */
      ip: string;
      /** Port to send to */
      port: number;
    };
    /** OSC receive configuration */
    receive: {
      /** IP to listen on */
      ip: string;
      /** Port to listen on */
      port: number;
    };
  };
}

/**
 * Relay server process configuration
 */
export interface RelayServerProcessConfig {
  /** Path to relay server executable */
  execPath: string;
  /** Arguments to pass to the relay server */
  args?: string[];
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Auto restart on crash */
  autoRestart?: boolean;
  /** Maximum number of restart attempts */
  maxRestarts?: number;
  /** Delay between restart attempts in ms */
  restartDelay?: number;
  /** Timeout for server startup in ms */
  startupTimeout?: number;
}