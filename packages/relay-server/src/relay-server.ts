/**
 * Main relay server implementation for VRChat OSC
 */
import {
  Event,
  OscEvent,
  Request,
  Response
} from '@vrchat-mcp-osc/types';
import { Config, createLogger, generateId } from '@vrchat-mcp-osc/utils';
import { WebSocket } from 'ws';
import { VRChatOSCClient } from './osc-client.js';
import {
  RelayAction,
  RelayServerStatus
} from './types/relay.js';
import { RelayWebSocketServer } from './websocket-server.js';

const logger = createLogger('RelayServer');

/**
 * Main relay server implementation
 */
export class OscRelayServer {
  private websocketServer: RelayWebSocketServer;
  private oscClient: VRChatOSCClient;
  private running: boolean = false;

  /**
   * Create a new relay server instance
   * 
   * @param config Configuration manager
   */
  constructor(private config: Config) {
    // Initialize WebSocket server
    this.websocketServer = new RelayWebSocketServer({
      host: this.config.get<string>('websocket.host', 'localhost'),
      port: this.config.get<number>('websocket.port', 8765)
    }, async (websocket: WebSocket, message: any) => {
      await this.handleWebSocketMessage(websocket, message);
    });

    // Initialize OSC client
    this.oscClient = new VRChatOSCClient({
      sendIp: this.config.get<string>('osc.send.ip', '127.0.0.1'),
      sendPort: this.config.get<number>('osc.send.port', 9000),
      receiveIp: this.config.get<string>('osc.receive.ip', '127.0.0.1'),
      receivePort: this.config.get<number>('osc.receive.port', 9001)
    });

    // Set up OSC event handlers
    this.oscClient.on('avatarChanged', this.handleOscEvent.bind(this));
    this.oscClient.on('parameterChanged', this.handleOscEvent.bind(this));
    this.oscClient.on('message', this.handleOscEvent.bind(this));
  }

  /**
   * Start the relay server and its components
   * 
   * @returns Promise resolving to true if started successfully
   */
  public async start(): Promise<boolean> {
    logger.info('Starting VRChat OSC relay server');

    // Start OSC client
    const oscResult = await this.oscClient.start();
    if (!oscResult) {
      logger.error('Failed to start OSC client');
      return false;
    }

    // Start WebSocket server
    const wsResult = await this.websocketServer.start();
    if (!wsResult) {
      logger.error('Failed to start WebSocket server');
      await this.oscClient.stop();
      return false;
    }

    this.running = true;
    logger.info('VRChat OSC relay server started successfully');
    return true;
  }

  /**
   * Stop the relay server and its components
   * 
   * @returns Promise that resolves when the server is stopped
   */
  public async stop(): Promise<void> {
    logger.info('Stopping VRChat OSC relay server');

    // Stop WebSocket server
    await this.websocketServer.stop();

    // Stop OSC client
    await this.oscClient.stop();

    this.running = false;
    logger.info('VRChat OSC relay server stopped');
  }

  /**
   * Handle OSC events from VRChat
   * 
   * @param event OSC event data
   */
  private async handleOscEvent(event: OscEvent): Promise<void> {
    logger.debug(`OSC event: ${event.eventType} ${event.address} ${JSON.stringify(event.args)}`);

    // Create event message for clients
    const eventMessage: Event = {
      type: 'event',
      action: event.eventType,
      data: {
        address: event.address,
        args: event.args
      }
    };

    // Broadcast to all WebSocket clients
    await this.websocketServer.broadcast(eventMessage);
  }

  /**
   * Handle WebSocket messages from clients
   * 
   * @param websocket WebSocket client connection
   * @param message Received message
   */
  private async handleWebSocketMessage(websocket: WebSocket, message: Request | Response): Promise<void> {
    logger.debug(`WebSocket message: ${JSON.stringify(message)}`);

    // messageが適切な形式かチェック
    if (typeof message === 'object' && message !== null && 'type' in message) {
      // Process based on message type
      if (message.type === 'request') {
        await this.handleRequest(websocket, message as Request);
      } else {
        // For unknown message types, send an error response
        await this.websocketServer.sendToClient(websocket, {
          type: 'error',
          data: {
            message: `Unknown message type: ${message.type}`
          }
        });
      }
    } else {
      // オブジェクトでないか、typeプロパティがない場合
      await this.websocketServer.sendToClient(websocket, {
        type: 'error',
        data: {
          message: 'Invalid message format'
        }
      });
    }
  }

  /**
   * Handle a request message from a WebSocket client
   * 
   * @param websocket WebSocket client connection
   * @param request Request message
   */
  private async handleRequest(websocket: WebSocket, request: Request): Promise<void> {
    const requestId = request.id || generateId();
    const action = request.action as RelayAction;
    const data = request.data || {};

    // Prepare response template
    const response: Response = {
      type: 'response',
      id: requestId,
      action,
      data: null,
      error: null
    };

    try {
      // Handle specific actions
      switch (action) {
        case 'test':
          response.data = { status: 'ok', message: 'Relay server is running' };
          break;
        
        case 'getStatus':
          response.data = this.getStatus();
          break;

        case 'sendOsc':
          // Send a raw OSC message
          const oscAddress = data.address as string;
          const oscValue = data.value;

          if (!oscAddress) {
            response.error = { message: 'Missing address parameter' };
          } else {
            const result = this.oscClient.send_message(oscAddress, oscValue);
            response.data = { success: result };
          }
          break;

        case 'avatar/getInfo':
          // Get avatar information
          logger.error('avatar/getInfo is called');
          const avatarInfo = this.oscClient.get_avatar_info();
          response.data = { avatar: avatarInfo || { id: 'unknown', name: 'Unknown' } };
          break;

        case 'avatar/getAvatarlist':
          // Get list of available avatars
          logger.info('Getting avatar list from OSC client');
          try {
            const avatarList = await this.oscClient.getAvatarlist();
            logger.info(`Got avatar list with ${Object.keys(avatarList).length} avatars`);
            logger.debug(`Avatar list: ${JSON.stringify(avatarList)}`);
            response.data = { avatars: avatarList };
          } catch (error) {
            logger.error(`Error getting avatar list: ${error instanceof Error ? error.message : String(error)}`);
            response.error = { message: 'Failed to get avatar list' };
          }
          break;

        case 'avatar/setAvatar':
          // Change avatar
          const avatarId = data.avatarId as string;
          
          if (!avatarId) {
            response.error = { message: 'Missing avatar ID' };
          } else {
            const success = await this.oscClient.setAvatar(avatarId);
            response.data = { success };
          }
          break;

        case 'avatar/getParameters':
          // Get avatar parameters
          const paramInfo = this.oscClient.get_parameter_values();
          
          // パラメータが必要な形式（パラメータ名の配列またはオブジェクト）で返す
          if (paramInfo && paramInfo.parameters) {
            // Mapオブジェクトの場合はパラメータ名の配列に変換
            if (paramInfo.parameters instanceof Map) {
              const paramNames = Array.from(paramInfo.parameters.keys());
              response.data = { parameters: paramNames };
            } 
            // すでにオブジェクトの場合はそのまま返す
            else if (typeof paramInfo.parameters === 'object') {
              response.data = { parameters: paramInfo.parameters };
            }
            // どちらでもない場合は空の配列を返す
            else {
              response.data = { parameters: [] };
            }
          } else {
            // パラメータが存在しない場合は空の配列を返す
            response.data = { parameters: [] };
          }
          
          // logger.debug(`avatar/getParameters returning ${parameterNames.length} parameters`);
          logger.debug('avatar/getParameters response:');
          logger.debug(response.data);
          break;

        case 'avatar/setParameter':
          // Set an avatar parameter
          const paramName = data.name as string;
          const paramValue = data.value as number | boolean;

          if (!paramName) {
            response.error = { message: 'Missing parameter name' };
          } else if (paramValue === undefined) {
            response.error = { message: 'Missing parameter value' };
          } else {
            const result = this.oscClient.set_avatar_parameter(paramName, paramValue);
            response.data = { success: result };
          }
          break;

        case 'input/sendCommand':
          // Send an input command
          const inputName = data.name as string;
          const inputValue = data.value as number;

          if (!inputName) {
            response.error = { message: 'Missing input name' };
          } else if (inputValue === undefined) {
            response.error = { message: 'Missing input value' };
          } else {
            const result = this.oscClient.send_input(inputName, inputValue);
            response.data = { success: result };
          }
          break;

        case 'chatbox/sendMessage':
          // Send a chatbox message
          const message = data.message as string;
          const sendImmediately = data.immediate as boolean ?? true;
          const notification = data.notification as boolean ?? true;

          if (!message) {
            response.error = { message: 'Missing message text' };
          } else {
            const result = this.oscClient.send_chatbox(message, sendImmediately, notification);
            response.data = { success: result };
          }
          break;

        default:
          // Unknown action
          response.error = { message: `Unknown action: ${action}` };
          break;
      }
    } catch (error) {
      logger.error(`Error handling request: ${error instanceof Error ? error.message : String(error)}`);
      response.error = { message: error instanceof Error ? error.message : String(error) };
    }
    logger.debug(`Response:'`);
    logger.debug(`Response: ${JSON.stringify(response)}`);
    // Send response
    await this.websocketServer.sendToClient(websocket, response);
  }

  /**
   * Get the current status of the relay server
   * 
   * @returns Status information object
   */
  private getStatus(): RelayServerStatus {
    return {
      running: this.running,
      websocket: {
        running: this.websocketServer.getStatus().running,
        host: this.websocketServer.getStatus().host,
        port: this.websocketServer.getStatus().port,
        clientCount: this.websocketServer.getStatus().clientCount
      },
      osc: this.oscClient.get_status(),
      avatar: this.oscClient.get_avatar_info(),
      parameters: Object.keys(this.oscClient.get_parameter_values()).length
    };
  }
}