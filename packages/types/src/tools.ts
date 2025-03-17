/**
 * Types for MCP tools
 */

/**
 * Possible avatar parameter values
 */
export type ParameterValue = number | boolean;

/**
 * Available movement directions
 */
export type MovementDirection = 'forward' | 'backward' | 'left' | 'right';

/**
 * Available look directions
 */
export type LookDirection = 'left' | 'right';

/**
 * Tool context for logging and access to services
 */
export interface ToolContext {
  /** Log an info message */
  info(message: string): Promise<void>;
  /** Log a warning message */
  warning(message: string): Promise<void>;
  /** Log an error message */
  error(message: string): Promise<void>;
  /** Log a debug message */
  debug(message: string): Promise<void>;
  /** Request context */
  request_context: {
    /** Lifespan context */
    lifespan_context: any;
  };
}

/**
 * Avatar configuration from VRChat
 */
export interface AvatarConfig {
  /** Avatar ID */
  id: string;
  /** Avatar name */
  name: string;
  /** Avatar parameters */
  parameters?: {
    /** Parameter name */
    [name: string]: {
      /** Parameter address */
      address: string;
      /** Parameter type */
      type?: string;
      /** Parameter default value */
      defaultValue?: any;
      /** Parameter present value */
      presenttValue?: any;
    };
  };
}