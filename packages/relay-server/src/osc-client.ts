/**
 * OSC client for communicating with VRChat
 */
import {
  AvatarConfig,
  AvatarInfo,
  OscClientStatus,
  OscEvent,
  OscOptions,
  OscValue
} from '@vrchat-mcp-osc/types';
import { createLogger } from '@vrchat-mcp-osc/utils';
import { EventEmitter } from 'events';
import fs from 'fs';
import { Client, Message, Server } from 'node-osc';
import os from 'os';
import path from 'path';
const logger = createLogger('OscClient');
/**
 * Client for communicating with VRChat via OSC
 */
export class VRChatOSCClient extends EventEmitter {
  private client: Client;
  private server: Server | null = null;
  private isConnected: boolean = false;
  private avatarInfo: AvatarInfo | null = null;
  private parameterValues: Map<string, OscValue> = new Map(); // 変更：Record から Map に
  private avatarConfigs: Map<string, AvatarConfig> = new Map();
  private readonly sendIp: string;
  private readonly sendPort: number;
  private readonly receiveIp: string;
  private readonly receivePort: number;

  /**
   * Create a new VRChat OSC client
   * 
   * @param options Configuration options
   */
  constructor(options: OscOptions) {
    super();
    
    this.sendIp = options.sendIp;
    this.sendPort = options.sendPort;
    this.receiveIp = options.receiveIp;
    this.receivePort = options.receivePort;

    // Create UDP client for sending messages
    this.client = new Client(this.sendIp, this.sendPort);

      /**
     * Load all avatar configurations from VRChat OSC config files.
     */
    // Load all avatar configs
    this.loadAllAvatarConfigs();
  
    logger.info(`OSC client created (send: ${this.sendIp}:${this.sendPort}, receive: ${this.receiveIp}:${this.receivePort})`);
  }

  /**
   * Start the OSC server to receive messages from VRChat
   * 
   * @returns Promise resolving to true if started successfully, false otherwise
   */
  public async start(): Promise<boolean> {
    try {
      // Send initial connection message
      this.send_chatbox('OSC client connected');

      // Create OSC server to receive messages
      this.server = new Server(this.receivePort, this.receiveIp);

      // Set up message handlers
      this.server.on('message', this.handleMessage.bind(this));

      // Mark as connected
      this.isConnected = true;
      logger.info(`OSC server listening on ${this.receiveIp}:${this.receivePort}`);
      
      return true;
    } catch (error) {
      logger.error(`Error starting OSC server: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Stop the OSC server
   * 
   * @returns Promise that resolves when the server is stopped
   */
  public async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.isConnected = false;
      logger.info('OSC server stopped');
    }

    // Also close the client
    this.client.close();
  }

  private loadAllAvatarConfigs(): void {
    // Find VRChat OSC config directory
    let oscPath: string | null = null;
    
    // Windows path
    const localLow = path.join(os.homedir(), 'AppData', 'LocalLow');
    oscPath = path.join(localLow, 'VRChat', 'VRChat', 'OSC');
    
    
    if (!oscPath || !fs.existsSync(oscPath)) {
      logger.warn(`VRChat OSC directory not found: ${oscPath}`);
      return;
    }
    
    logger.info(`Looking for avatar configs in ${oscPath}`);
    
    try {
      // Find user directories (starts with usr_)
      const userDirs = fs.readdirSync(oscPath)
        .filter(dir => dir.startsWith('usr_'))
        .map(dir => path.join(oscPath!, dir));
      
      if (userDirs.length === 0) {
        logger.warn('No user directories found for avatar configs');
        return;
      }
      
      // Load all avatar configs from each user directory
      for (const userDir of userDirs) {
        logger.info(`Checking ${userDir}`);
        const avatarDir = path.join(userDir, 'Avatars');
        
        if (!fs.existsSync(avatarDir)) {
          logger.warn(`No Avatars directory in ${userDir}`);
          continue;
        }
        
        // Process all JSON files in the Avatars directory
        const avatarFiles = fs.readdirSync(avatarDir)
          .filter(file => file.endsWith('.json'));
        
        for (const avatarFile of avatarFiles) {
          const avatarId = path.basename(avatarFile, '.json');
          const avatarPath = path.join(avatarDir, avatarFile);
          
          try {
            // Read with BOM handling
            const fileContent = fs.readFileSync(avatarPath, { encoding: 'utf-8' });
            const content = fileContent.charCodeAt(0) === 0xFEFF
              ? fileContent.substring(1) // Remove BOM
              : fileContent;
            
            const configData = JSON.parse(content);
            const config = configData as AvatarConfig;
            
            this.avatarConfigs.set(avatarId, config);
            //logger.info(`Loaded avatar config for ${config.name} (${avatarId})`);
          } catch (error) {
            logger.error(`Error loading avatar config ${avatarPath}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      
      logger.info(`Loaded ${this.avatarConfigs.size} avatar configurations`);
    } catch (error) {
      logger.error(`Error loading avatar configs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }


  /**
   * Send an OSC message to VRChat
   * 
   * @param address OSC address to send to
   * @param value Value to send
   * @returns True if message was sent successfully, false otherwise
   */
  public send_message(address: string, value: OscValue): boolean {
    const valueStr = Array.isArray(value) 
      ? `[${value.map(v => JSON.stringify(v)).join(', ')}]` 
      : JSON.stringify(value);
    
    logger.info(`SENDING OSC: ${address} ${valueStr}`);
    
    try {
      const message = new Message(address);
      if (Array.isArray(value)) {
        value.forEach(v => message.append(v));
      } else {
        message.append(value);
      }
      
      // セッションIDを追加してメッセージとタイムスタンプを紐付け
      const msgId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
      logger.info(`OSC-MSG-${msgId}: Sending message to ${address} with value ${valueStr}`);
      
      this.client.send(message, (err) => {
        if (err) {
          logger.error(`OSC-MSG-${msgId}: Send error: ${err.message}`);
        } else {
          logger.info(`OSC-MSG-${msgId}: Successfully sent`);
        }
      });
      
      return true;
    } catch (error) {
      logger.error(`Error sending OSC message: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Set an avatar parameter in VRChat
   * 
   * @param parameterName Name of the parameter to set
   * @param value Value to set (number or boolean)
   * @returns True if parameter was set successfully, false otherwise
   */
  public set_avatar_parameter(parameterName: string, value: number | boolean): boolean {
    const address = `/avatar/parameters/${parameterName}`;
    return this.send_message(address, value);
  }

  /**
   * Send an input command to VRChat
   * 
   * @param inputName Name of the input to send
   * @param value Value to send (usually a number)
   * @returns True if command was sent successfully, false otherwise
   */
  public send_input(inputName: string, value: number): boolean {
    const address = `/input/${inputName}`;
    return this.send_message(address, value);
  }

  /**
   * Send a message to the VRChat chatbox
   * 
   * @param message Text to send
   * @param sendImmediately Whether to send immediately (true) or just populate the chatbox (false)
   * @param notification Whether to play notification sound
   * @returns True if message was sent successfully, false otherwise
   */
  public send_chatbox(message: string, sendImmediately: boolean = true, notification: boolean = true): boolean {
    return this.send_message('/chatbox/input', [message, sendImmediately, notification]);
  }

  /**
   * Set the typing indicator on or off
   * 
   * @param isTyping Whether to show the typing indicator
   * @returns True if command was sent successfully, false otherwise
   */
  public set_typing_indicator(isTyping: boolean): boolean {
    return this.send_message('/chatbox/typing', isTyping);
  }

  /**
   * Get the status of the OSC client
   * 
   * @returns Object with status information
   */
  public get_status(): OscClientStatus {
    return {
      connected: this.isConnected,
      sendIp: this.sendIp,
      sendPort: this.sendPort,
      receiveIp: this.receiveIp,
      receivePort: this.receivePort
    };
  }

  /**
   * Get the current avatar information
   * 
   * @returns Avatar information or null if not available
   */
  public get_avatar_info(): AvatarInfo | null {
    return this.avatarInfo;
  }

  /**
   * パラメータ名の配列を取得する
   * 
   * @returns アバターパラメータ名の配列
   */
  public get_parameter_names(): string[] {
    if (this.avatarInfo?.parameters instanceof Map) {
      return Array.from(this.avatarInfo.parameters.keys());
    } else if (this.avatarInfo?.parameters && typeof this.avatarInfo.parameters === 'object') {
      return Object.keys(this.avatarInfo.parameters);
    }
    return [];
  }

  /**
   * 現在保存されているすべてのパラメータ値を取得
   * 
   * @returns パラメータ名と値のマップ
   */
  public get_parameter_values(): any {
    // logger.debug(`Returning ${this.parameterValues.size} parameter values`);
    // return new Map(this.avatarInfo?.parameters); // 新しい Map のインスタンスを作成して返す
    return this.avatarInfo;
  }

  /**
   * Handle incoming OSC messages
   * 
   * @param message OSC message address
   * @param args Message arguments
   */
  private handleMessage(message: [string, ...any[]]): void {
    const [address, ...args] = message;
    
    // 詳細なログ出力（すべてのメッセージ）
    const argsStr = args.map(arg => JSON.stringify(arg)).join(', ');
    // logger.info(`RECEIVED OSC: ${address} [${argsStr}]`);

    // Handle different message types
    if (address === '/avatar/change' && args.length > 0) {
      this.handleAvatarChange(address, args);
    } else if (typeof address === 'string' && address.startsWith('/avatar/parameters/')) {
      this.handleParameterChange(address, args);
    } else {
      // Generic message handling
      this.emit('message', {
        eventType: 'message',
        address: String(address),
        args
      } as OscEvent);
    }
  }

  /**
   * Handle avatar change events
   * 
   * @param address OSC address
   * @param args OSC arguments
   */
  private handleAvatarChange(address: string, args: any[]): void {
    const avatarId = args[0];
    logger.info(`Avatar changed: ${avatarId}`);
    this.loadAllAvatarConfigs();

    // Update stored avatar info
    let avatarName = 'Unknown';
    let initialParameters: Map<string, OscValue> = new Map();

    // Try to get name and parameters from avatar configs
    if (this.avatarConfigs.has(avatarId)) {
        const config = this.avatarConfigs.get(avatarId);
        if (config) {
            // 名前の設定
            if (config.name) {
                avatarName = config.name;
                logger.info(`Found avatar name in configs: ${avatarName}`);
            } else {
                logger.warn(`Avatar config found for ${avatarId} but no name available`);
            }

            // パラメータの初期化
            if (config.parameters && Array.isArray(config.parameters)) {
                config.parameters.forEach(param => {
                    if (param.name) {
                        // デフォルト値があればそれを使用、なければ型に応じた初期値を設定
                        let defaultValue: OscValue = 0;
                        if (param.defaultValue !== undefined) {
                            defaultValue = param.defaultValue;
                        } else if (param.output?.type === 'Bool') {
                            defaultValue = false;
                        }
                        initialParameters.set(param.name, defaultValue);
                    }
                });
                logger.info(`Initialized ${initialParameters.size} parameters from config`);
            }
        }
    } else {
        logger.warn(`No config found for avatar ${avatarId}`);
    }

    // パラメータ値を初期化
    this.parameterValues = initialParameters;
    logger.info(`Initialized parameter values for new avatar with ${this.parameterValues.size} parameters`);

    this.avatarInfo = {
        id: avatarId,
        name: avatarName,
        parameters: this.parameterValues
    };

    logger.error(this.avatarInfo);
    logger.error(this.avatarInfo.parameters);
    // Emit avatar changed event
    this.emit('avatarChanged', {
        eventType: 'avatar/changed',
        address,
        args,
        avatarName,
        parameterCount: this.parameterValues.size
    } as OscEvent);
  }

  /**
   * Handle parameter update from VRChat
   * 
   * @param address OSC address
   * @param args OSC arguments
   */
  private handleParameterChange(address: string, args: any[]): void {
    const paramName = address.split('/').pop() || '';
    const paramValue = args[0];
    
    // パラメータ値を Map に保存
    this.parameterValues.set(paramName, paramValue);
    
    logger.debug(`Parameter changed: ${paramName} = ${paramValue}`);

    // イベント発火
    this.emit('parameterChanged', {
      eventType: 'parameter/changed',
      address: paramName,
      args,
      value: paramValue // 明示的に値も含める
    } as OscEvent);
  }
    /**
   * Get a list of all available avatars.
   *
   * @returns Object with avatar IDs as keys and avatar names as values
   */
  /**
   * Change to a different avatar.
   *
   * @param avatarId - ID of the avatar to change to
   * @returns Promise resolving to true if successful, false otherwise
   */
  public async setAvatar(avatarId: string): Promise<boolean> {
    try {
      // アバターIDの検証
      if (!this.avatarConfigs.has(avatarId)) {
        logger.error(`Avatar ${avatarId} not found in available avatars`);
        return false;
      }

      logger.info(`Changing to avatar: ${avatarId} (${this.avatarConfigs.get(avatarId)?.name})`);

      // アバター変更メッセージを送信
      const success = this.send_message('/avatar/change', avatarId);
      if (!success) {
        throw new Error('Failed to send avatar change message');
      }

      // 変更完了まで待機
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.removeListener('avatarChanged', handler);
          reject(new Error('Avatar change timeout'));
        }, 10000); // 10秒タイムアウト

        const handler = (event: OscEvent) => {
          if (event.eventType === 'avatar/changed' && event.args[0] === avatarId) {
            clearTimeout(timeout);
            this.removeListener('avatarChanged', handler);
            resolve();
          }
        };

        this.on('avatarChanged', handler);
      });

      logger.info(`Successfully changed to avatar: ${avatarId}`);
      return true;
    } catch (error) {
      logger.error(`Error changing avatar: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  public async getAvatarlist(): Promise<{ [avatarId: string]: string }> {
    try {
      logger.info('Loading avatar configurations...');
      
      // 設定を再読み込み
      await this.loadAllAvatarConfigs();
      
      logger.info(`Current avatar configs count: ${this.avatarConfigs.size}`);
      
      const avatarList: { [avatarId: string]: string } = {};
      this.avatarConfigs.forEach((config, avatarId) => {
        logger.debug(`Processing avatar: ${avatarId}`);
        if (config.name) {
          logger.debug(`Adding avatar: ${avatarId} (${config.name})`);
          avatarList[avatarId] = config.name;
        } else {
          logger.warn(`Avatar ${avatarId} has no name in config`);
        }
      });
      
      logger.info(`Found ${Object.keys(avatarList).length} avatars with names`);
      logger.debug(`Complete avatar list: ${JSON.stringify(avatarList)}`);
      return avatarList;
    } catch (error) {
      logger.error(`Error getting avatar list: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  }
}