/**
 * Message types for WebSocket communication
 */

/**
 * Base message structure
 */
export interface BaseMessage {
  /** Message type */
  type: string;
}

/**
 * Request message
 */
export interface Request extends BaseMessage {
  /** Message type */
  type: 'request';
  /** Request ID */
  id: string;
  /** Action to perform */
  action: string;
  /** Request data */
  data?: Record<string, any>;
}

/**
 * Response message
 */
export interface Response extends BaseMessage {
  /** Message type */
  type: 'response';
  /** Request ID */
  id: string;
  /** Action performed */
  action: string;
  /** Response data */
  data: Record<string, any> | null;
  /** Error information if any */
  error: {
    /** Error message */
    message: string;
    /** Error code */
    code?: number;
  } | null;
}

/**
 * Event notification message
 */
export interface Event extends BaseMessage {
  /** Message type */
  type: 'event';
  /** Event type/action */
  action: string;
  /** Event data */
  data: Record<string, any>;
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
  /** Message type */
  type: 'error';
  /** Error data */
  data: {
    /** Error message */
    message: string;
    /** Error code */
    code?: number;
  };
}