/**
 * Configuration manager for vrchat-mcp-osc components
 */
import { ConfigOptions } from '@vrchat-mcp-osc/types';
import fs from 'fs';
import path from 'path';
import { getComponentLogger } from './logger.js';

const logger = getComponentLogger('config');

/**
 * Configuration manager class
 */
export class Config {
  private config: Record<string, any> = {};
  private defaults: Record<string, any> = {};
  private envPrefix: string;
  
  /**
   * Create a new configuration manager
   * 
   * @param options Configuration options
   */
  constructor(options: ConfigOptions = {}) {
    this.defaults = options.defaults || {};
    this.envPrefix = options.envPrefix || 'VRCHAT_MCP_OSC_';
    
    // Load defaults
    this.config = { ...this.defaults };
    
    // Load from file if specified
    if (options.configPath) {
      this.loadFromFile(options.configPath);
    }
    
    // Load from environment variables
    this.loadFromEnv();
    
    logger.info('Configuration initialized');
  }
  
  /**
   * Load configuration from a JSON file
   * 
   * @param configPath Path to configuration file
   */
  private loadFromFile(configPath: string): void {
    try {
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        this.config = this.mergeConfigs(this.config, fileConfig);
        logger.info(`Loaded configuration from ${configPath}`);
      } else {
        logger.warn(`Configuration file not found: ${configPath}`);
      }
    } catch (error) {
      logger.error(`Error loading configuration from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Load configuration from environment variables
   */
  private loadFromEnv(): void {
    for (const key in process.env) {
      if (key.startsWith(this.envPrefix)) {
        const configKey = key.substring(this.envPrefix.length).toLowerCase().replace(/_/g, '.');
        const value = process.env[key];
        
        if (value !== undefined) {
          this.setNestedValue(this.config, configKey, this.parseValue(value));
        }
      }
    }
    logger.info('Loaded configuration from environment variables');
  }
  
  /**
   * Parse a string value into the appropriate type
   * 
   * @param value String value to parse
   * @returns Parsed value
   */
  private parseValue(value: string): any {
    // Try to parse as number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return Number(value);
    }
    
    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if not valid JSON
      return value;
    }
  }
  
  /**
   * Set a nested value in a configuration object
   * 
   * @param obj Object to set value in
   * @param path Dot-separated path to property
   * @param value Value to set
   */
  private setNestedValue(obj: Record<string, any>, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  /**
   * Get a nested value from a configuration object
   * 
   * @param obj Object to get value from
   * @param path Dot-separated path to property
   * @returns Value or undefined if not found
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (current === undefined || current === null || !(part in current)) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }
  
  /**
   * Recursively merge configuration objects
   * 
   * @param target Target object
   * @param source Source object
   * @returns Merged object
   */
  private mergeConfigs(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const result = { ...target };
    
    for (const key in source) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = this.mergeConfigs(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
  
  /**
   * Get a configuration value
   * 
   * @param key Dot-separated path to property
   * @param defaultValue Default value if not found
   * @returns Configuration value or default value
   */
  public get<T>(key: string, defaultValue?: T): T {
    const value = this.getNestedValue(this.config, key);
    return value === undefined ? defaultValue as T : value as T;
  }
  
  /**
   * Set a configuration value
   * 
   * @param key Dot-separated path to property
   * @param value Value to set
   */
  public set(key: string, value: any): void {
    this.setNestedValue(this.config, key, value);
  }
  
  /**
   * Get all configuration values
   * 
   * @returns All configuration values
   */
  public getAll(): Record<string, any> {
    return { ...this.config };
  }
  
  /**
   * Save configuration to a file
   * 
   * @param filePath Path to save to
   * @returns True if saved successfully, false otherwise
   */
  public saveToFile(filePath: string): boolean {
    try {
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(filePath, JSON.stringify(this.config, null, 2), 'utf-8');
      logger.info(`Saved configuration to ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Error saving configuration to ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}