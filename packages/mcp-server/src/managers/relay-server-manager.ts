/**
 * RelayServerManager handles starting and managing the relay server process
 */
import { RelayServerProcessConfig } from '@vrchat-mcp-osc/types';
import { createLogger, delay, withTimeout } from '@vrchat-mcp-osc/utils';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';

// Default configuration
const DEFAULT_CONFIG: RelayServerProcessConfig = {
  execPath: 'node',
  args: ['dist/index.js'],
  autoRestart: true,
  maxRestarts: 3,
  restartDelay: 2000,
  startupTimeout: 5000
};

// Manager events
export enum RelayServerManagerEvent {
  STARTED = 'started',
  STOPPED = 'stopped',
  ERROR = 'error',
  RESTARTING = 'restarting'
}

/**
 * RelayServerManager handles starting and managing the relay server process
 */
export class RelayServerManager {
  private config: RelayServerProcessConfig;
  private process: ChildProcess | null = null;
  private isRunning: boolean = false;
  private restartCount: number = 0;
  private logger = createLogger('RelayServerManager');
  private eventHandlers: Map<RelayServerManagerEvent, Array<(...args: any[]) => void>> = new Map();
  private startPromise: Promise<boolean> | null = null;
  
  /**
   * Create a new relay server manager
   * 
   * @param config Configuration options
   */
  constructor(config: Partial<RelayServerProcessConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger.info('RelayServerManager initialized');
  }
  
  /**
   * Start the relay server process
   * 
   * @returns Promise that resolves to true if started successfully
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) {
      this.logger.info('Relay server is already running');
      return true;
    }
    
    if (this.startPromise) {
      this.logger.info('Relay server is already starting');
      return this.startPromise;
    }
    
    this.startPromise = this._startProcess();
    const result = await this.startPromise;
    this.startPromise = null;
    return result;
  }
  
  /**
   * Internal method to start the relay server process
   * 
   * @returns Promise that resolves to true if started successfully
   */
  private async _startProcess(): Promise<boolean> {
    this.logger.info('Starting relay server process');
    
    // Verify if the configured executable exists
    if (!this.config.execPath) {
      this.logger.error('No executable path specified');
      this.emitEvent(RelayServerManagerEvent.ERROR, new Error('No executable path specified'));
      return false;
    }
    
    try {
      // Get working directory
      const workingDir = path.dirname(this.resolveExecPath());
      
      // Prepare environment variables
      const env = {
        ...process.env,
        ...this.config.env
      };
      
      // Start the process
      this.process = spawn(
        this.config.execPath,
        this.config.args || [],
        {
          cwd: workingDir,
          env,
          stdio: ['ignore', 'pipe', 'pipe']
        }
      );
      
      // Set up listeners
      this.setupProcessListeners();
      
      // Wait for startup
      try {
        const success = await withTimeout(
          this.waitForStartup(),
          this.config.startupTimeout || 5000,
          'Relay server startup timed out'
        );
        
        if (success) {
          this.isRunning = true;
          this.restartCount = 0;
          this.logger.info('Relay server started successfully');
          this.emitEvent(RelayServerManagerEvent.STARTED);
          return true;
        } else {
          this.logger.error('Failed to start relay server');
          this.killProcess();
          this.emitEvent(RelayServerManagerEvent.ERROR, new Error('Failed to start relay server'));
          return false;
        }
      } catch (error) {
        this.logger.error(`Relay server startup error: ${error instanceof Error ? error.message : String(error)}`);
        this.killProcess();
        this.emitEvent(RelayServerManagerEvent.ERROR, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(`Error starting relay server: ${error instanceof Error ? error.message : String(error)}`);
      this.emitEvent(RelayServerManagerEvent.ERROR, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
  
  /**
   * Setup listeners for the child process
   */
  private setupProcessListeners(): void {
    if (!this.process) return;
    
    // Handle process output
    if (this.process.stdout) {
      this.process.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        lines.forEach((line: any) => this.logger.info(`[RelayServer] ${line}`));
      });
    }
    
    if (this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        lines.forEach((line: any) => this.logger.error(`[RelayServer] ${line}`));
      });
    }
    
    // Handle process exit
    this.process.on('exit', (code, signal) => {
      this.logger.info(`Relay server process exited with code ${code} and signal ${signal}`);
      this.isRunning = false;
      this.process = null;
      
    //   // Handle automatic restart
    //   //
    //   if (this.config.autoRestart && this.restartCount < (this.config.maxRestarts || 3)) {
    //     this.handleAutoRestart();
    //   } else {
    //     this.emitEvent(RelayServerManagerEvent.STOPPED, { code, signal });
    //   }
    }
  );
    
    // Handle process errors
    this.process.on('error', (error) => {
      this.logger.error(`Relay server process error: ${error.message}`);
      this.emitEvent(RelayServerManagerEvent.ERROR, error);
    });
  }
  
  /**
   * Handle automatic restart of the relay server
   */
  private async handleAutoRestart(): Promise<void> {
    this.restartCount++;
    this.logger.info(`Restarting relay server (attempt ${this.restartCount})`);
    this.emitEvent(RelayServerManagerEvent.RESTARTING, { attempt: this.restartCount });
    
    // Wait before restart
    await delay(this.config.restartDelay || 2000);
    
    // Try to start again
    this._startProcess().catch(error => {
      this.logger.error(`Failed to restart relay server: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  
  /**
   * Wait for the relay server to start up
   * 
   * @returns Promise that resolves to true when server is ready
   */
  private async waitForStartup(): Promise<boolean> {
    // TODO: Implement a real health check here, e.g., connect to the WebSocket server
    // For now, just wait a bit and assume it's running if the process is still alive
    await delay(1000);
    return this.process !== null && this.process.exitCode === null;
  }
  
  /**
   * Stop the relay server process
   * 
   * @returns Promise that resolves when the server is stopped
   */
  public async stop(): Promise<void> {
    if (!this.isRunning || !this.process) {
      this.logger.info('Relay server is not running');
      return;
    }
    
    this.logger.info('Stopping relay server process');
    
    this.killProcess();
    
    // Wait for the process to exit
    await new Promise<void>((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }
      
      this.process.once('exit', () => {
        resolve();
      });
      
      // Force kill after timeout
      setTimeout(() => {
        this.killProcess(true);
        resolve();
      }, 5000);
    });
    
    this.isRunning = false;
    this.process = null;
    this.logger.info('Relay server stopped');
    this.emitEvent(RelayServerManagerEvent.STOPPED);
  }
  
  /**
   * Kill the relay server process
   * 
   * @param force Whether to force kill the process
   */
  private killProcess(force: boolean = false): void {
    if (!this.process) return;
    
    try {
      if (force) {
        this.process.kill('SIGKILL');
      } else {
        this.process.kill('SIGTERM');
      }
    } catch (error) {
      this.logger.error(`Error killing relay server process: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Resolve the executable path
   * 
   * @returns Resolved executable path
   */
  private resolveExecPath(): string {
    // Check if it's a relative path
    if (this.config.execPath && !path.isAbsolute(this.config.execPath)) {
      return path.resolve(process.cwd(), this.config.execPath);
    }
    
    return this.config.execPath || '';
  }
  
  /**
   * Register an event handler
   * 
   * @param event Event to handle
   * @param handler Handler function
   */
  public on(event: RelayServerManagerEvent, handler: (...args: any[]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    
    this.eventHandlers.get(event)!.push(handler);
  }
  
  /**
   * Emit an event to registered handlers
   * 
   * @param event Event to emit
   * @param args Arguments to pass to handlers
   */
  private emitEvent(event: RelayServerManagerEvent, ...args: any[]): void {
    if (this.eventHandlers.has(event)) {
      for (const handler of this.eventHandlers.get(event)!) {
        try {
          handler(...args);
        } catch (error) {
          this.logger.error(`Error in event handler: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }
  
  /**
   * Check if the relay server is running
   * 
   * @returns True if running, false otherwise
   */
  public isServerRunning(): boolean {
    return this.isRunning;
  }
}