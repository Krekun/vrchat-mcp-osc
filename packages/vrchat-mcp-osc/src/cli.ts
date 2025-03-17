#!/usr/bin/env node
/**
 * vrchat-mcp-osc command-line interface
 */

import { createLogger } from '@vrchat-mcp-osc/utils';
import { Command } from 'commander';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { Mcp } from './index.js';

const logger = createLogger('CLI');

// ESM用のファイルパス解決
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Create CLI program
const program = new Command();

// Set up CLI
program
  .name('vrchat-mcp-osc')
  .description('vrchat-mcp-osc - VRChat AI Assistant Integration')
  .version(packageJson.version);

// Start command
program
  .command('start')
  .description('Start vrchat-mcp-osc')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-p, --ws-port <port>', 'WebSocket port for relay server', '8765')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--claude-mode', 'Force Claude compatibility mode')
  .action(async (options) => {
    // MCP実行モードを設定 - ロガーがstdoutではなくstderrに出力するようになる
    process.env.MCP_MODE = 'true';
    // Set log level based on verbose flag
    if (options.verbose) {
      process.env.LOG_LEVEL = 'debug';
    }
    
    
    logger.info('Starting vrchat-mcp-osc');
    
    try {
      // Load configuration if specified
      const config = options.config ? loadConfig(options.config) : {};
      
      // Set environment variables
      if (options.wsPort) {
        process.env.VRCHAT_MCP_OSC_WEBSOCKET_PORT = options.wsPort;
      }
      
      // Create and start Mcp
      const vrchat_mcp_oscf = new Mcp(config);
      await vrchat_mcp_oscf.start();
      
      // Handle process signals
      process.on('SIGINT', async () => {
        logger.info('Received SIGINT signal');
        await vrchat_mcp_oscf.stop();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM signal');
        await vrchat_mcp_oscf.stop();
        process.exit(0);
      });
      
      logger.info('vrchat-mcp-osc is running. Press Ctrl+C to stop.');
    } catch (error) {
      logger.error(`Error starting vrchat-mcp-osc: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Load configuration file
function loadConfig(configPath: string): Record<string, any> {
  try {
    // Resolve path
    const resolvedPath = path.resolve(configPath);
    logger.info(`Loading configuration from ${resolvedPath}`);
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      logger.error(`Configuration file not found: ${resolvedPath}`);
      return {};
    }
    
    // Read and parse file
    const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    logger.error(`Error loading configuration: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

// Parse arguments
program.parse();