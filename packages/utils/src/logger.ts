/**
 * Shared logger setup for vrchat-mcp-osc components
 */
import fs from 'fs';
import path from 'path';
import winston from 'winston';

// Configure log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ level, message, timestamp, component }) => {
    return `${timestamp} [${component || 'app'}] ${level.toUpperCase()}: ${message}`;
  })
);

// Create logs directory if it doesn't exist
const createLogsDir = (logsDir: string): void => {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
};

/**
 * Create a logger for a specific component
 * 
 * @param component Component name
 * @param logsDir Directory to store log files
 * @returns Winston logger instance
 */
export function createLogger(component: string, logsDir: string = 'logs'): winston.Logger {
  createLogsDir(logsDir);
  
  // MCP環境では標準出力を使わないように設定
  const isMcpMode = true;
  
  // トランスポートを設定
  const transports: winston.transport[] = [];
  
  // コンソール出力の設定
  const consoleTransport = new winston.transports.Console();
  
  // MCP実行時はすべての出力をstderrに向ける
  if (isMcpMode) {
    // stderrLevelsにすべてのログレベルを設定
    (consoleTransport as any).stderrLevels = {
      error: true,
      warn: true,
      info: true,
      debug: true
    };
  }
  
  // トランスポートに追加
  transports.push(consoleTransport);
  
  // ファイルログのトランスポートを追加
  transports.push(
    // File logging - errors
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error' 
    }),
    // File logging - all logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log')
    }),
    // Component-specific logs
    new winston.transports.File({
      filename: path.join(logsDir, `${component}.log`)
    })
  );
  
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { component },
    transports
  });
}

/**
 * Get a component-specific logger
 * 
 * @param component Component name
 * @returns Winston logger instance
 */
export function getComponentLogger(component: string): winston.Logger {
  return createLogger(component);
}