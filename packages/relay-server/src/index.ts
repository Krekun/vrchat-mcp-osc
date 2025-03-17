#!/usr/bin/env node
/**
 * VRChat OSC Relay Server entry point
 */

import { Config, createLogger } from '@vrchat-mcp-osc/utils';
import { OscRelayServer } from './relay-server.js';

// Setup logger
const logger = createLogger('RelayServer');

// Parse command line arguments
const config = new Config({
  envPrefix: 'VRCHAT_MCP_OSC_',
  defaults: {
    websocket: {
      host: 'localhost',
      port: 8765
    },
    osc: {
      send: {
        ip: '127.0.0.1',
        port: 9000
      },
      receive: {
        ip: '127.0.0.1',
        port: 9001
      }
    }
  }
});

// Create relay server
const relayServer = new OscRelayServer(config);

// Handle process signals
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await relayServer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await relayServer.stop();
  process.exit(0);
});

// Start the server
(async () => {
  try {
    logger.info('Starting VRChat OSC relay server');
    const success = await relayServer.start();
    
    if (success) {
      logger.info('VRChat OSC relay server started successfully');
    } else {
      logger.error('Failed to start VRChat OSC relay server');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Error starting relay server: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
})();