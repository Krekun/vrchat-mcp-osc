/**
 * MCP tools for VRChat avatar parameters.
 */

import { createLogger } from '@vrchat-mcp-osc/utils';
import { AvatarConfig, ParameterValue, ToolContext } from '../types/index.js';
import { WebSocketClient } from '../ws-client.js';

const logger = createLogger('AvatarTools');

/**
 * Tools for interacting with VRChat avatar parameters.
 */
export class AvatarTools {
  private wsClient: WebSocketClient;
  private logger = createLogger('AvatarTools');
  private currentAvatarInfo: { id: string | null; name: string } = { id: null, name: 'Unknown Avatar' };
  private avatarConfigs: Map<string, AvatarConfig> = new Map();

  /**
   * Initialize avatar tools.
   * 
   * @param wsClient - WebSocket client for communication with the relay server
   */
  constructor(wsClient: WebSocketClient) {
    this.wsClient = wsClient;
    
    // Register event handler for avatar changes
    // this.wsClient.registerEventHandler('avatar/changed', this.onAvatarChange.bind(this));
  }

  

  /**
   * Get a list of all available avatars.
   *
   * @param ctx - MCP Context (optional)
   * @returns Promise resolving to an object with avatar IDs as keys and names as values
   */
  public async getAllAvatars(ctx?: ToolContext): Promise<{ [avatarId: string]: string }> {
    if (ctx) {
      await ctx.info('Getting list of available avatars');
    }

    try {
      const avatars = await this.wsClient.getAvatarlist();
      
      if (ctx) {
        const avatarCount = Object.keys(avatars).length;
        await ctx.info(`Found ${avatarCount} available avatars`);
      }

      return avatars;
    } catch (error) {
      const errorMsg = `Error getting avatar list: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMsg);
      if (ctx) {
        await ctx.error(errorMsg);
      }
      return {};
    }
  }

  /**
   * Get the current avatar name.
   * 
   * @param ctx - MCP Context (optional)
   * @returns Promise resolving to the name of the current avatar
   */
  public async getAvatarName(ctx?: ToolContext): Promise<string> {
    if (ctx) {
      await ctx.info('Getting avatar name');
    }
    
    try {
      // Multiple retry attempts
      let attempts = 0;
      const maxAttempts = 3;
      let lastError: Error | null = null;
      
      while (attempts < maxAttempts) {
        attempts++;
        logger.info(`Getting avatar info (attempt ${attempts}/${maxAttempts})`);
        
        try {
          // Get the latest avatar info with increased timeout
          const avatarInfo = await this.wsClient.getAvatarInfo();
          
          // Validate the response
          if (!avatarInfo || !avatarInfo.id) {
            throw new Error('Invalid avatar info response');
          }
          
          // Update stored info and return the name
          this.currentAvatarInfo = avatarInfo;
          logger.info(`Got avatar info: ${JSON.stringify(this.currentAvatarInfo)}`);
          
          // Return result
          if (ctx) {
            await ctx.info(`Current avatar: ${this.currentAvatarInfo.name}`);
          }
          
          return this.currentAvatarInfo.name;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger.warn(`Attempt ${attempts} failed: ${lastError.message}`);
          
          // Wait before retry
          if (attempts < maxAttempts) {
            const delay = 500 * attempts; // Increasing delay for each retry
            logger.info(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // All attempts failed
      if (lastError) {
        throw lastError;
      } else {
        throw new Error('Failed to get avatar name after multiple attempts');
      }
    } catch (error) {
      logger.error(`Failed to get avatar info: ${error instanceof Error ? error.message : String(error)}`);
      
      // Try to fall back to loaded config info if available
      const fallbackName = this.getFallbackAvatarName();
      
      if (ctx) {
        await ctx.warning(`Could not get avatar name: ${error instanceof Error ? error.message : String(error)}. Using fallback: ${fallbackName}`);
      }
      
      return fallbackName;
    }
  }
  
  /**
   * Get a fallback avatar name from loaded configs if available
   * 
   * @returns Best guess at avatar name or default string
   */
  private getFallbackAvatarName(): string {
    // If we already have a valid name, return it
    if (this.currentAvatarInfo.id && this.currentAvatarInfo.name !== 'Unknown Avatar') {
      return this.currentAvatarInfo.name;
    }
    
    // Try to find the config for the current avatar
    if (this.currentAvatarInfo.id && this.avatarConfigs.has(this.currentAvatarInfo.id)) {
      const config = this.avatarConfigs.get(this.currentAvatarInfo.id)!;
      return config.name || 'Unknown Avatar';
    }
    
    return 'Unknown Avatar';
  }

  /**
   * Get parameter names for the current avatar.
   * 
   * @param ctx - MCP Context (optional)
   * @returns Promise resolving to a list of parameter names
   */
  public async getParameterNames(ctx?: ToolContext): Promise<string[]> {
    if (ctx) {
      await ctx.info('Getting avatar parameters');
    }
    
    try {
      // Multiple retry attempts
      let attempts = 0;
      const maxAttempts = 3;
      let lastError: Error | null = null;
      
      while (attempts < maxAttempts) {
        attempts++;
        logger.info(`Getting avatar parameters (attempt ${attempts}/${maxAttempts})`);
        
        try {
          // Get the parameters with increased timeout
          const parameters = await this.wsClient.getAvatarParameters();
          
          // Validate the response
          if (!Array.isArray(parameters)) {
            throw new Error('Invalid parameter response: not an array');
          }
          
          // Return the list
          logger.info(`Found ${parameters.length} avatar parameters`);
          
          if (parameters.length > 0) {
            logger.debug(`Parameters: ${parameters.join(', ')}`);
          } else {
            logger.warn('No parameters found for current avatar');
          }
          
          if (ctx) {
            await ctx.info(`Found ${parameters.length} avatar parameters`);
            if (parameters.length <= 10 && parameters.length > 0) {
              await ctx.info(`Parameters: ${parameters.join(', ')}`);
            }
          }
          
          return parameters;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger.warn(`Attempt ${attempts} failed: ${lastError.message}`);
          
          // Wait before retry
          if (attempts < maxAttempts) {
            const delay = 500 * attempts; // Increasing delay for each retry
            logger.info(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // All attempts failed
      if (lastError) {
        throw lastError;
      } else {
        throw new Error('Failed to get avatar parameters after multiple attempts');
      }
    } catch (error) {
      logger.error(`Failed to get avatar parameters: ${error instanceof Error ? error.message : String(error)}`);
      
      // Try to get parameters from the loaded config if we have it
      const fallbackParams = this.getFallbackParameters();
      
      if (ctx) {
        await ctx.warning(`Could not get avatar parameters: ${error instanceof Error ? error.message : String(error)}`);
        if (fallbackParams.length > 0) {
          await ctx.info(`Using ${fallbackParams.length} parameters from cached config`);
        }
      }
      
      return fallbackParams;
    }
  }
  
  /**
   * Get fallback parameters from loaded config
   * 
   * @returns Array of parameter names or empty array
   */
  private getFallbackParameters(): string[] {
    // Try to find the config for the current avatar
    if (this.currentAvatarInfo.id && this.avatarConfigs.has(this.currentAvatarInfo.id)) {
      const config = this.avatarConfigs.get(this.currentAvatarInfo.id)!;
      if (config.parameters && Array.isArray(config.parameters)) {
        return config.parameters.map(p => p.name);
      }
    }
    
    // Return common VRChat parameters as absolute fallback
    return [
      'VRCEmote',
      'GestureLeft',
      'GestureRight',
      'GestureLeftWeight',
      'GestureRightWeight'
    ];
  }

  /**
   * Set an avatar parameter.
   * 
   * @param parameterName - Name of the parameter to set
   * @param value - Value to set
   * @param ctx - MCP Context (optional)
   * @returns Promise resolving to a confirmation message
   */
  /**
   * Change the current avatar.
   *
   * @param avatarId - ID of the avatar to change to
   * @param ctx - MCP Context (optional)
   * @returns Promise resolving to a confirmation message
   */
  public async setAvatar(
    avatarId: string,
    ctx?: ToolContext
  ): Promise<string> {
    if (!avatarId) {
      const errorMsg = 'Missing avatar ID';
      logger.error(errorMsg);
      if (ctx) await ctx.error(errorMsg);
      return errorMsg;
    }

    if (ctx) {
      await ctx.info(`Changing avatar to ${avatarId}`);
    }

    try {
      // Multiple retry attempts
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        logger.info(`Changing avatar to ${avatarId} (attempt ${attempts}/${maxAttempts})`);

        try {
        //   // Get available avatars
        //   const avatars = await this.wsClient.getAvatarlist();
        //   if (!avatars || !avatars[avatarId]) {
        //     throw new Error(`Avatar ${avatarId} not found in available avatars`);
        //   }

          // Send avatar change request using the new method
          const success = await this.wsClient.setAvatar(avatarId);

          if (success) {
            // const successMsg = `Successfully changed avatar to ${avatars[avatarId]} (${avatarId})`;
            const successMsg = `Successfully changed avatar to (${avatarId})`;
            logger.info(successMsg);
            return successMsg;
          } else {
            logger.warn(`Failed to change avatar (attempt ${attempts})`);

            // Try again if we have attempts left
            if (attempts < maxAttempts) {
              const delay = 300 * attempts;
              logger.info(`Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        } catch (error) {
          logger.warn(`Error changing avatar (attempt ${attempts}): ${error instanceof Error ? error.message : String(error)}`);

          // Try again if we have attempts left
          if (attempts < maxAttempts) {
            const delay = 300 * attempts;
            logger.info(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All attempts failed
      const failMsg = `Failed to change avatar after ${maxAttempts} attempts`;
      logger.error(failMsg);
      return failMsg;
    } catch (error) {
      const errorMsg = `Error changing avatar: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return errorMsg;
    }
  }

  public async setParameter(
    parameterName: string,
    value: ParameterValue,
    ctx?: ToolContext
  ): Promise<string> {
    if (!parameterName) {
      const errorMsg = 'Missing parameter name';
      logger.error(errorMsg);
      if (ctx) await ctx.error(errorMsg);
      return errorMsg;
    }
    
    // // Validate value type
    // if (typeof value !== 'number' && typeof value !== 'boolean') {
    //   const errorMsg = `Invalid parameter value type: ${typeof value} (must be number or boolean)`;
    //   logger.error(errorMsg);
    //   if (ctx) await ctx.error(errorMsg);
    //   return errorMsg;
    // }
    
    if (ctx) {
      await ctx.info(`Setting avatar parameter ${parameterName} to ${value}`);
    }
    
    try {
      // Multiple retry attempts
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        attempts++;
        logger.info(`Setting parameter ${parameterName}=${value} (attempt ${attempts}/${maxAttempts})`);
        
        try {
          // Set parameter with timeout
          const success = await this.wsClient.setAvatarParameter(parameterName, value);
          
          if (success) {
            const successMsg = `Successfully set ${parameterName} to ${value}`;
            logger.info(successMsg);
            return successMsg;
          } else {
            logger.warn(`Failed to set parameter ${parameterName} (attempt ${attempts})`);
            
            // Try again if we have attempts left
            if (attempts < maxAttempts) {
              const delay = 300 * attempts; // Increasing delay for each retry
              logger.info(`Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        } catch (error) {
          logger.warn(`Error setting parameter ${parameterName} (attempt ${attempts}): ${error instanceof Error ? error.message : String(error)}`);
          
          // Try again if we have attempts left
          if (attempts < maxAttempts) {
            const delay = 300 * attempts; // Increasing delay for each retry
            logger.info(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // All attempts failed
      const failMsg = `Failed to set ${parameterName} after ${maxAttempts} attempts`;
      logger.error(failMsg);
      return failMsg;
    } catch (error) {
      const errorMsg = `Error setting parameter ${parameterName}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return errorMsg;
    }
  }
}