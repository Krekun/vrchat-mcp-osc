#!/usr/bin/env node
/**
 * VRChat OSC MCP server implementation.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLogger } from '@vrchat-mcp-osc/utils';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { RelayServerManager, RelayServerManagerEvent } from './managers/relay-server-manager.js';
import { AvatarTools, InputTools } from './tools/index.js';
import { LookDirection, MovementDirection, ServerContext, ToolContext } from './types/index.js';
import { WebSocketClient } from './ws-client.js';

// Setup logger
const logger = createLogger('MCPServer');

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Redirect console.log to stderr to avoid interfering with MCP protocol
const originalConsoleLog = console.log;
console.log = function() {
  process.stderr.write('[console.log] ' + Array.from(arguments).join(' ') + '\n');
};

// Attempt to locate relay-server package
let relayServerPath = '';
// First check relative to current directory (development environment)
const devRelayPath = path.resolve(__dirname, '../../relay-server/dist/index.js');
if (fs.existsSync(devRelayPath)) {
  relayServerPath = devRelayPath;
  logger.info(`Found relay server at dev path: ${relayServerPath}`);
} else {
  // Then check in node_modules
  const prodRelayPath = path.resolve(process.cwd(), 'node_modules/@vrchat-mcp-osc/relay-server/dist/index.js');
  if (fs.existsSync(prodRelayPath)) {
    relayServerPath = prodRelayPath;
    logger.info(`Found relay server at prod path: ${relayServerPath}`);
  } else {
    logger.warn('Could not find relay server module. Will attempt default path.');
    // Default fallback
    relayServerPath = './node_modules/@vrchat-mcp-osc/relay-server/dist/index.js';
  }
}

// Create relay server manager
const relayServerManager = new RelayServerManager({
  execPath: 'node',
  args: [relayServerPath],
  autoRestart: true,
  env: {
    VR_BUTLER_WEBSOCKET_PORT: process.env.VR_BUTLER_WEBSOCKET_PORT || '8765'
  }
});

// Add event handlers for relay server
relayServerManager.on(RelayServerManagerEvent.STARTED, () => {
  logger.info('Relay server started successfully');
});

relayServerManager.on(RelayServerManagerEvent.STOPPED, () => {
  logger.info('Relay server stopped');
});

relayServerManager.on(RelayServerManagerEvent.ERROR, (error) => {
  logger.error(`Relay server error: ${error.message}`);
});

relayServerManager.on(RelayServerManagerEvent.RESTARTING, ({ attempt }) => {
  logger.info(`Relay server restarting (attempt ${attempt})`);
});

// Initialize WebSocket client
const wsClient = new WebSocketClient({
  host: process.env.VR_BUTLER_WEBSOCKET_HOST || 'localhost',
  port: parseInt(process.env.VR_BUTLER_WEBSOCKET_PORT || '8765', 10),
  reconnectAttempts: 3
});

// Initialize tools
const avatarTools = new AvatarTools(wsClient);
const inputTools = new InputTools(wsClient);

// Server context
const serverContext: ServerContext = {
  wsClient,
  avatarTools,
  inputTools
};

// Initialize McpServer
const server = new McpServer({
  name: 'VRChat OSC',
  version: '1.0.0'
});

/**
 * Connect to the WebSocket server and initialize tools.
 */
async function initializeServer(): Promise<void> {
  logger.info('Initializing VRChat OSC MCP server');
  
  try {
    // Start relay server first
    logger.info('Starting relay server...');
    const relayStarted = await relayServerManager.start();
    
    if (!relayStarted) {
      logger.warn('Failed to start relay server. Some features may not work properly.');
    }
    
    // Connect to WebSocket server
    logger.info('Connecting to WebSocket server...');
    const connected = await wsClient.connect();
    
    if (!connected) {
      logger.warn('Failed to connect to WebSocket server. Some features may not work.');
    }
    
    // Connect to MCP transport
    logger.info('Connecting to MCP transport...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info('VRChat OSC MCP server initialized successfully');
    
    // Register cleanup handler for process exit
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  } catch (error) {
    logger.error(`Error during initialization: ${error instanceof Error ? error.message : String(error)}`);
    // Don't exit - let MCP SDK handle the connection
  }
}

/**
 * Clean up resources on server shutdown.
 */
async function cleanup(): Promise<void> {
  logger.info('Shutting down VRChat OSC MCP server');
  
  try {
    // Stop relay server
    await relayServerManager.stop();
    
    // Disconnect from WebSocket server
    await wsClient.disconnect();
    
    // Close MCP server
    await server.close();
  } catch (error) {
    logger.error(`Error during cleanup: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to create tool context that works with the SDK
function createToolContext(extra: any): ToolContext {
  // Safely access logging functions, depending on what's available in the SDK
  const logMessage = async (level: string, message: string) => {
    if (extra.server && typeof extra.server.sendLoggingMessage === 'function') {
      await extra.server.sendLoggingMessage({ level, data: message });
    } else if (extra.session && typeof extra.session.sendLoggingMessage === 'function') {
      await extra.session.sendLoggingMessage({ level, data: message });
    } else {
      // Fallback to console logging if SDK doesn't provide logging functionality
      switch (level) {
        case 'info': logger.info(message); break;
        case 'warning': logger.warn(message); break;
        case 'error': logger.error(message); break;
        case 'debug': logger.debug(message); break;
      }
    }
  };

  return {
    info: async (message: string) => logMessage('info', message),
    warning: async (message: string) => logMessage('warning', message),
    error: async (message: string) => logMessage('error', message),
    debug: async (message: string) => logMessage('debug', message),
    request_context: {
      lifespan_context: serverContext
    }
  };
}

// Add test tool
server.tool(
  'add',
  'Add two numbers',
  {
    a: z.number().describe('First number'),
    b: z.number().describe('Second number')
  },
  async ({ a, b }) => {
    return { content: [{ type: 'text', text: String(a + b) }] };
  }
);

// Register avatar tools
server.tool(
  'get_avatar_name',
  'Get the name of the current avatar.',
  {},
  async () => {
    try {
      const name = await avatarTools.getAvatarName();
      return { content: [{ type: 'text', text: name }] };
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error getting avatar name: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);



// Register avatar parameter tools
server.tool(
  'set_avatar_parameter',
  'Set a parameter on the current avatar.',
  {
    parameter_name: z.string().describe('Name of the parameter to set'),
    value: z.union([z.number(), z.boolean(),z.string()]).describe('Value to set')
  },
  async ({ parameter_name, value }, extra) => {
    try {
      const ctx = createToolContext(extra);
      
     // 文字列が数値として解析可能な場合は数値に変換
     let value_con: number | boolean;
     if (typeof value === 'string') {
       // 数値として解析を試みる
       value_con = Number(value);
       // 変換できなかった場合（NaNの場合）はエラーを投げる
       if (isNaN(value_con)) {
         throw new Error(`文字列 "${value}" を数値に変換できませんでした`);
       }
     } else {
       value_con = value;
     }
      
      const result = await avatarTools.setParameter(parameter_name, value_con, ctx);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error setting parameter: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

server.tool(
  'get_avatar_parameters',
  'Get a list of parameters available on the current avatar.',
  {},
  async (_, extra) => {
    try {
      const ctx = createToolContext(extra);
      const parameters = await avatarTools.getParameterNames(ctx);
      return { content: [{ type: 'text', text: JSON.stringify(parameters) }] };
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error getting parameters: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Register avatar parameter tools
server.tool(
  'set_emote_parameter',
  'Set VRCEmote on the current avatar.',
  {
    value: z.union([z.number(),z.string()]).describe('Value to set')
  },
  async ({value }, extra) => {
    try {
      const ctx = createToolContext(extra);
      
     // 文字列が数値として解析可能な場合は数値に変換
     let value_con: number;
     if (typeof value === 'string') {
       // 数値として解析を試みる
       value_con = Number(value);
       // 変換できなかった場合（NaNの場合）はエラーを投げる
       if (isNaN(value_con)) {
         throw new Error(`文字列 "${value}" を数値に変換できませんでした`);
       }
     } else {
       value_con = value;
     }
      
      const result = await avatarTools.setParameter('VRCEmote', value_con, ctx);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error setting parameter: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);


// Register input control tools
server.tool(
  'move_avatar',
  'Move the avatar in a specific direction.',
  {
    direction: z.enum(['forward', 'backward', 'left', 'right']).describe('Direction to move'),
    duration: z.number().default(1.0).describe('Duration in seconds')
  },
  async ({ direction, duration }, extra) => {
    try {
      const ctx = createToolContext(extra);
      const result = await inputTools.move(direction as MovementDirection, duration, ctx);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error moving avatar: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

server.tool(
  'look_direction',
  'Turn to look in a specific direction.',
  {
    direction: z.enum(['left', 'right']).describe('Direction to look'),
    duration: z.number().default(1.0).describe('Duration in seconds')
  },
  async ({ direction, duration }, extra) => {
    try {
      const ctx = createToolContext(extra);
      const result = await inputTools.look(direction as LookDirection, duration, ctx);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error looking direction: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

server.tool(
  'jump',
  'Make the avatar jump.',
  {},
  async (_, extra) => {
    try {
      const ctx = createToolContext(extra);
      const result = await inputTools.jump(ctx);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error jumping: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

server.tool(
  'menu',
  'Toggle Menu.',
  {},
  async (_, extra) => {
    try {
      const ctx = createToolContext(extra);
      const result = await inputTools.menu(ctx);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error jumping: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

server.tool(
  'voice',
  'Toggle voice',
  {},
  async (_, extra) => {
    try {
      const ctx = createToolContext(extra);
      const result = await inputTools.voice(ctx);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error jumping: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

server.tool(
  'send_message',
  'Send a message to the VRChat chatbox.',
  {
    message: z.string().describe('Message to send'),
    send_immediately: z.boolean().default(true).describe('Send immediately or just populate chatbox')
  },
  async ({ message, send_immediately }, extra) => {
    try {
      const ctx = createToolContext(extra);
      const result = await inputTools.sendChatboxMessage(message, send_immediately, ctx);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error sending message: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Silent initialization without using process.exit
initializeServer().catch(error => {
  logger.error(`Error initializing server: ${error instanceof Error ? error.message : String(error)}`);
  // Don't call process.exit here as it might disrupt the MCP communication
});