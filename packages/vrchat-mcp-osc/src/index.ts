/**
 * VR Butler main entry point
 */

import { Config, createLogger } from '@vrchat-mcp-osc/utils';
import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const logger = createLogger('Butler');

/**
 * VR Butler options
 */
export interface ButlerOptions {
  /** Path to configuration file */
  configPath?: string;
  /** WebSocket port */
  wsPort?: number;
  /** OSC send port */
  oscSendPort?: number;
  /** OSC receive port */
  oscReceivePort?: number;
  /** Path to MCP server executable */
  mcpServerPath?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Force Claude compatibility mode */
  claudeMode?: boolean;
}

/**
 * Main VR Butler class
 */
export class Butler {
  private config: Config;
  private options: ButlerOptions;
  private mcpProcess: ChildProcess | null = null;
  private running: boolean = false;
  
  /**
   * Create a new Butler instance
   * 
   * @param options Options
   */
  constructor(options: ButlerOptions = {}) {
    // Store options for later use
    this.options = options;
    
    // Initialize configuration
    this.config = new Config({
      envPrefix: 'VR_BUTLER_',
      defaults: {
        websocket: {
          port: 8765
        },
        osc: {
          send: {
            port: 9000
          },
          receive: {
            port: 9001
          }
        }
      }
    });
    
    // Override with provided options
    if (options.wsPort) {
      this.config.set('websocket.port', options.wsPort);
    }
    
    if (options.oscSendPort) {
      this.config.set('osc.send.port', options.oscSendPort);
    }
    
    if (options.oscReceivePort) {
      this.config.set('osc.receive.port', options.oscReceivePort);
    }
    
    // Check for Claude mode option
    if (options.claudeMode) {
      process.env.RUNNING_FROM_CLAUDE = 'true';
      process.env.LOG_TO_FILE = 'true';
      logger.info('Butler initialized in Claude compatibility mode');
    }
    
    logger.info('Butler initialized');
  }
  
  /**
   * Start VR Butler
   * 
   * @returns Promise resolving when butler is started
   */
  public async start(): Promise<void> {
    if (this.running) {
      logger.info('Butler is already running');
      return;
    }
    
    logger.info('Starting VR Butler');
    
    try {
      // Start MCP server
      await this.startMcpServer();
      
      this.running = true;
      logger.info('VR Butler started successfully');
    } catch (error) {
      logger.error(`Error starting Butler: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Stop VR Butler
   * 
   * @returns Promise resolving when butler is stopped
   */
  public async stop(): Promise<void> {
    if (!this.running) {
      logger.info('Butler is not running');
      return;
    }
    
    logger.info('Stopping VR Butler');
    
    // Stop MCP server
    await this.stopMcpServer();
    
    this.running = false;
    logger.info('VR Butler stopped');
  }
  
  /**
   * Start MCP server
   * 
   * @returns Promise resolving when server is started
   */
  private async startMcpServer(): Promise<void> {
    logger.info('Starting MCP server');
    
    // 実行環境の検出 (Claude経由で実行されているかどうか)
    const isRunningFromClaude = !!process.env.ANTHROPIC_APP || 
                               process.title.includes('Claude') ||
                               process.env.RUNNING_FROM_CLAUDE === 'true';
    
    if (isRunningFromClaude) {
      logger.info('Detected execution from Claude application - using special mode');
    }
    
    // Prepare environment variables
    const env = {
      ...process.env,
      VR_BUTLER_WEBSOCKET_PORT: String(this.config.get('websocket.port')),
      VR_BUTLER_OSC_SEND_PORT: String(this.config.get('osc.send.port')),
      VR_BUTLER_OSC_RECEIVE_PORT: String(this.config.get('osc.receive.port')),
      LOG_TO_FILE: isRunningFromClaude ? 'true' : process.env.LOG_TO_FILE || 'false',
      ...this.config.get('env', {})
    };
    
    // Get path to MCP server executable
    logger.info('Resolving MCP server module path...');
    const mcpServerModule = await this.resolveModulePath('@vrchat-mcp-osc/mcp-server');
    logger.info(`MCP server module resolved to: ${mcpServerModule}`);
    
    const mcpServerBin = path.join(mcpServerModule, 'dist', 'server.js');
    logger.info(`MCP server executable path: ${mcpServerBin}`);
    
    // Verify the executable exists
    if (!fs.existsSync(mcpServerBin)) {
      logger.error(`MCP server executable not found at: ${mcpServerBin}`);
      logger.info('Searching for server.js in possible locations...');
      
      // Try to find the file in nearby locations
      const distDir = path.join(mcpServerModule, 'dist');
      if (fs.existsSync(distDir)) {
        logger.info(`Dist directory exists: ${distDir}`);
        const files = fs.readdirSync(distDir);
        logger.info(`Files in dist directory: ${files.join(', ')}`);
      } else {
        logger.error(`Dist directory does not exist: ${distDir}`);
      }
      
      throw new Error(`MCP server executable not found at: ${mcpServerBin}`);
    }
    
    // ログファイルパスを設定（Claude環境では常にファイルに出力）
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, 'vrchat-mcp-osc-mcp.log');
    logger.info(`Log file path: ${logFile}`);
    
    // Start MCP server process with appropriate options
    const spawnOptions:any = {
      env,
      detached: isRunningFromClaude, // Claude環境ではデタッチモードで実行
      stdio: isRunningFromClaude 
        ? ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')] // stdoutとstderrをファイルにリダイレクト
        : 'pipe' // 通常の環境ではパイプで接続
    };
    
    logger.info(`Starting MCP server with options: ${JSON.stringify(spawnOptions, null, 2)}`);
    this.mcpProcess = spawn('node', [mcpServerBin], spawnOptions);
    
    // Handle process events
    this.mcpProcess.on('error', (error) => {
      logger.error(`MCP server process error: ${error.message}`);
    });
    
    if (isRunningFromClaude && this.mcpProcess) {
      logger.info('Detaching process from parent in Claude environment');
      this.mcpProcess.unref(); // 親プロセスから完全に切り離す
    }
    
    this.mcpProcess.on('exit', (code, signal) => {
      logger.info(`MCP server process exited with code ${code} and signal ${signal}`);
      this.mcpProcess = null;
      this.running = false;
    });
    
    // Handle standard output and error (only for non-Claude environments)
    if (!isRunningFromClaude) {
      if (this.mcpProcess.stdout) {
        this.mcpProcess.stdout.on('data', (data) => {
          const lines = data.toString().split('\n').filter(Boolean);
          lines.forEach((line:string) => logger.info(`[MCP] ${line}`));
        });
      }
      
      if (this.mcpProcess.stderr) {
        this.mcpProcess.stderr.on('data', (data) => {
          const lines = data.toString().split('\n').filter(Boolean);
          lines.forEach((line:string) => logger.error(`[MCP] ${line}`));
        });
      }
    }
    
    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      // Claudeモードでは少し長めのタイムアウトを設定
      const timeoutDuration = isRunningFromClaude ? 3000 : 1000;
      
      // Simple timeout for now - could be more sophisticated
      const timeout = setTimeout(() => {
        if (this.mcpProcess && this.mcpProcess.exitCode === null) {
          logger.info('MCP server started');
          
          if (isRunningFromClaude) {
            logger.info(`MCP server started in Claude mode, logging to: ${logFile}`);
          }
          
          resolve();
        } else {
          reject(new Error('Failed to start MCP server'));
        }
      }, timeoutDuration);
      
      // Handle early exit
      if (this.mcpProcess) {
        this.mcpProcess.once('exit', (code) => {
          clearTimeout(timeout);
          reject(new Error(`MCP server exited with code ${code}`));
        });
      }
    });
  }
  
  /**
   * Stop MCP server
   * 
   * @returns Promise resolving when server is stopped
   */
  private async stopMcpServer(): Promise<void> {
    if (!this.mcpProcess) {
      logger.info('MCP server is not running');
      return;
    }
    
    logger.info('Stopping MCP server');
    
    return new Promise<void>((resolve) => {
      // Set up exit handler
      const exitHandler = () => {
        this.mcpProcess = null;
        resolve();
      };
      
      if (this.mcpProcess) {
        this.mcpProcess.once('exit', exitHandler);
        
        // Send SIGTERM signal
        this.mcpProcess.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (this.mcpProcess) {
            logger.warn('Force killing MCP server process');
            this.mcpProcess.kill('SIGKILL');
          }
        }, 5000);
      } else {
        resolve();
      }
    });
  }
  
  /**
   * Resolve the path to a module
   * 
   * @param moduleName Module name
   * @returns Promise resolving to the module path
   */
  private async resolveModulePath(moduleName: string): Promise<string> {
    // Special case for vr_butler vs vrchat-mcp-osc path issue
    const normalizedModuleName = moduleName.replace('vr_butler', 'vrchat-mcp-osc');
    if (normalizedModuleName !== moduleName) {
      logger.debug(`Normalized module name from ${moduleName} to ${normalizedModuleName}`);
    }
    
    // If direct path was provided in options, use it
    if (this.options?.mcpServerPath) {
      logger.debug(`Using explicitly provided MCP server path: ${this.options.mcpServerPath}`);
      return this.options.mcpServerPath;
    }
    try {
      // Get the directory of the current script
      // Handle different contexts (ESM in browser, ESM in Node, or CJS in Node)
      let currentDir;
      try {
        // ESM context
        if (typeof import.meta.url !== 'undefined') {
          const currentFilePath = fileURLToPath(import.meta.url);
          currentDir = dirname(currentFilePath);
          logger.debug(`Using ESM path resolution: ${currentDir}`);
        } else {
          // Fallback for CommonJS
          currentDir = __dirname;
          logger.debug(`Using CommonJS path resolution: ${currentDir}`);
        }
      } catch (error) {
        // Ultimate fallback - use CWD
        currentDir = process.cwd();
        logger.warn(`Failed to determine script directory, using CWD: ${currentDir}`);
      }
      
      // Resolve to project root (assuming standard structure)
      // From /dist/index.js to project root is ../../..
      const projectRoot = path.resolve(currentDir, '..', '..', '..');
      logger.debug(`Project root resolved to: ${projectRoot}`);
      
      // Try different potential locations
      const possiblePaths = [
        // Try in packages directory (monorepo structure)
        path.join(projectRoot, 'packages', moduleName.replace('@vrchat-mcp-osc/', '')),
        // Try in node_modules at project root
        path.join(projectRoot, 'node_modules', moduleName),
        // Try in parent node_modules (workspace setup)
        path.join(projectRoot, '..', 'node_modules', moduleName)
      ];
      
      // Log all paths being checked for debugging
      logger.debug(`Searching for module ${moduleName} in paths:`);
      possiblePaths.forEach(p => logger.debug(` - ${p}`));
      
      // Check each path
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          logger.debug(`Found module ${moduleName} at ${p}`);
          return p;
        }
      }
      
      // In ESM context, we can't use require.resolve
      // Instead, try to check for common installed module locations
      const nodeModulesPaths = [
        // Global node_modules
        path.join(process.cwd(), 'node_modules', moduleName),
        // User's node_modules
        path.join(process.env.HOME || process.env.USERPROFILE || '', 'node_modules', moduleName),
        // Check parent directories
        path.join(process.cwd(), '..', 'node_modules', moduleName),
        path.join(process.cwd(), '..', '..', 'node_modules', moduleName),
      ];
      
      for (const p of nodeModulesPaths) {
        if (fs.existsSync(p)) {
          logger.debug(`Found module ${moduleName} in node_modules at ${p}`);
          return p;
        }
      }
      
      // Collect all the paths we tried for better error reporting
      const triedPaths = [
        ...possiblePaths,
        ...nodeModulesPaths
      ];
      
      throw new Error(
        `Module ${moduleName} not found in any searched location.\n` +
        `Searched in:\n${triedPaths.map(p => ` - ${p}`).join('\n')}\n` +
        `Current working directory: ${process.cwd()}\n` +
        `Script directory: ${currentDir}`
      );
    } catch (error) {
      logger.error(`Error resolving module path: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}