/**
 * MCP tools for VRChat input control.
 */

import { createLogger, delay } from '@vrchat-mcp-osc/utils';
import { LookDirection, MovementDirection, ToolContext } from '../types/index.js';
import { WebSocketClient } from '../ws-client.js';

const logger = createLogger('InputTools');

/**
 * Tools for controlling VRChat avatar inputs.
 */
export class InputTools {
  private wsClient: WebSocketClient;

  /**
   * Initialize input tools.
   * 
   * @param wsClient - WebSocket client for communication with the relay server
   */
  constructor(wsClient: WebSocketClient) {
    this.wsClient = wsClient;
  }

  /**
   * Move the avatar in a specific direction.
   * 
   * @param direction - Direction to move
   * @param duration - Duration in seconds
   * @param ctx - MCP Context (optional)
   * @returns Promise resolving to a confirmation message
   */
  public async move(
    direction: MovementDirection,
    duration: number,
    ctx?: ToolContext
  ): Promise<string> {
    if (ctx) {
      await ctx.info(`Moving ${direction} for ${duration} seconds`);
    }
    
    let inputName: string;
    let value: number;
    let releaseTimer: NodeJS.Timeout | null = null;
    
    try {
      // Map direction to input name and value
      switch (direction) {
        case 'forward':
          inputName = 'MoveForward';
          value = 1;
          break;
        case 'backward':
          inputName = 'MoveBackward';
          value = 1;
          break;
        case 'left':
          inputName = 'Moveleft';
          value = 1;
          break;
        case 'right':
          inputName = 'MoveRight';
          value = 1;
          break;
        default:
          return `Unknown direction: ${direction}`;
      }
      
      // Log the action
      logger.info(`Starting movement: ${direction} (${inputName}=${value}) for ${duration} seconds`);
      
      // Helper function to ensure input release
      const ensureInputRelease = async (): Promise<boolean> => {
        // Try up to 3 times to release the input
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            logger.debug(`Releasing input ${inputName} (attempt ${attempt})`);
            const success = await this.wsClient.sendInput(inputName, 0.0);
            if (success) {
              logger.info(`Successfully released input ${inputName}`);
              return true;
            } else {
              logger.warn(`Failed to release input ${inputName} (attempt ${attempt})`);
              // Wait a short time before retry
              if (attempt < 3) await delay(100);
            }
          } catch (error) {
            logger.error(`Error releasing input ${inputName} (attempt ${attempt}): ${error instanceof Error ? error.message : String(error)}`);
            // Wait a short time before retry
            if (attempt < 3) await delay(200);
          }
        }
        return false;
      };
      
      // Always ensure input is released, even if there's an error
      const cleanupAndExit = async (message: string): Promise<string> => {
        if (releaseTimer) {
          clearTimeout(releaseTimer);
          releaseTimer = null;
        }
        
        await ensureInputRelease();
        return message;
      };
      
      // Set up a safety release timer that's longer than the requested duration
      // This ensures movement stops even if there's a problem during the normal flow
      releaseTimer = setTimeout(async () => {
        logger.warn(`Safety timeout for ${inputName} movement triggered`);
        await ensureInputRelease();
      }, (duration + 0.5) * 1000);
      
      // Send input press - use a retry mechanism
      let pressSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          logger.debug(`Sending input ${inputName}=${value} (attempt ${attempt})`);
          pressSuccess = await this.wsClient.sendInput(inputName, value);
          if (pressSuccess) {
            logger.info(`Successfully sent input ${inputName}=${value}`);
            break;
          } else {
            logger.warn(`Failed to send input ${inputName}=${value} (attempt ${attempt})`);
            if (attempt < 3) await delay(100);
          }
        } catch (error) {
          logger.error(`Error sending input ${inputName}=${value} (attempt ${attempt}): ${error instanceof Error ? error.message : String(error)}`);
          if (attempt < 3) await delay(200);
        }
      }
      
      if (!pressSuccess) {
        return await cleanupAndExit(`Failed to start movement: ${direction}`);
      }
      
      // Wait for duration
      logger.debug(`Waiting for ${duration} seconds before releasing ${inputName}`);
      await delay(duration * 1000);
      
      // Send input release
      const releaseSuccess = await ensureInputRelease();
      
      // Clean up the safety timer
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = null;
      }
      
      if (!releaseSuccess) {
        return `Started moving ${direction} but failed to stop completely`;
      }
      
      return `Moved ${direction} for ${duration} seconds`;
    } catch (error) {
      const errorMsg = `Error during ${direction} movement: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      
      // Ensure cleanup happens even on error
      if (releaseTimer) {
        clearTimeout(releaseTimer);
      }
      
      // Try to release the input if we got far enough to define inputName
      if (inputName!) {
        try {
          await this.wsClient.sendInput(inputName, 0.0);
          logger.info(`Emergency release of ${inputName} after error`);
        } catch (releaseError) {
          logger.error(`Failed emergency release: ${releaseError instanceof Error ? releaseError.message : String(releaseError)}`);
        }
      }
      
      return errorMsg;
    }
  }

  /**
   * Turn to look in a specific direction.
   * 
   * @param direction - Direction to look
   * @param duration - Duration in seconds
   * @param ctx - MCP Context (optional)
   * @returns Promise resolving to a confirmation message
   */
  public async look(
    direction: LookDirection,
    duration: number = 1.0,
    ctx?: ToolContext
  ): Promise<string> {
    if (ctx) {
      await ctx.info(`Looking ${direction} for ${duration} seconds`);
    }
    
    if (direction !== 'left' && direction !== 'right') {
      return `Unknown direction: ${direction}`;
    }
    
    // ボタン入力名を決定
    const inputName = direction === 'left' ? 'LookLeft' : 'LookRight';
    
    try {
      logger.info(`[LOOK] Starting look ${direction} operation, duration: ${duration}s`);
      
      // ボタン入力を実行
      const result = await this.tryButtonLook(inputName, duration);
      
      if (!result.success) {
        return `Failed to look ${direction}: ${result.error}`;
      }
      
      return `Looked ${direction} for ${duration} seconds`;
    } catch (error) {
      const errorMsg = `Error during look ${direction}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(`[LOOK] ${errorMsg}`);
      
      // 緊急リセット
      try {
        await this.wsClient.sendInput(inputName, 0);
        logger.info(`[LOOK] Emergency reset of look input after error`);
      } catch (resetError) {
        logger.error(`[LOOK] Failed emergency reset: ${resetError instanceof Error ? resetError.message : String(resetError)}`);
      }
      
      return errorMsg;
    }
  }
  
  /**
   * ボタン入力方式で視線方向を変更する（LookLeft/LookRight）
   * 
   * @param inputName 入力名（'LookLeft'または'LookRight'）
   * @param duration 持続時間（秒）
   * @returns 成功したかどうかの結果
   */
  private async tryButtonLook(
    inputName: string,
    duration: number
  ): Promise<{success: boolean, error?: string}> {
    try {
      // ボタン入力では、まず0（リリース）を送信してから1（プレス）を送信する必要がある
      logger.info(`[LOOK-BUTTON] Initializing button ${inputName}=0`);
      await this.wsClient.sendInput(inputName, 0);
      
      // 少し待機
      await new Promise(r => setTimeout(r, 50));
      
      // ボタンプレスを送信
      logger.info(`[LOOK-BUTTON] Pressing button ${inputName}=1`);
      const pressSuccess = await this.wsClient.sendInput(inputName, 1);
      
      if (!pressSuccess) {
        return {success: false, error: `Failed to press button ${inputName}`};
      }
      
      // 時間待機
      await new Promise(r => setTimeout(r, (duration+2)*100 ));
      
      // ボタンリリースを送信
      logger.info(`[LOOK-BUTTON] Releasing button ${inputName}=0`);
      const releaseSuccess = await this.wsClient.sendInput(inputName, 0);
      
      if (!releaseSuccess) {
        logger.warn(`[LOOK-BUTTON] Failed to release button ${inputName}`);
        // 再試行
        await new Promise(r => setTimeout(r, 100));
        await this.wsClient.sendInput(inputName, 0);
      }
      
      // // 指定された持続時間だけ待機
      // if (duration > 0.2) { // すでに少し待機したので調整
      //   logger.info(`[LOOK-BUTTON] Waiting for remaining duration: ${duration - 0.2} seconds`);
      //   await new Promise(resolve => setTimeout(resolve, (duration - 0.2) * 1000));
      // }
      
      return {success: true};
    } catch (error) {
      const errorMsg = `Error in button look: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(`[LOOK-BUTTON] ${errorMsg}`);
      return {success: false, error: errorMsg};
    } finally {
      // 最終的な安全策として、もう一度入力をリセットする
      try {
        await this.wsClient.sendInput(inputName, 0);
        logger.info(`[LOOK-BUTTON] Final safety reset of ${inputName}`);
      } catch (e) {
        // エラーを無視
      }
    }
  }

  /**
   * Make the avatar jump.
   * 
   * @param ctx - MCP Context (optional)
   * @returns Promise resolving to a confirmation message
   */
  public async jump(ctx?: ToolContext): Promise<string> {
    if (ctx) {
      await ctx.info('Jumping');
    }

    try {
      // Send jump input
      const success = await this.wsClient.sendInput('Jump', 1.0);
      if (!success) {
        return 'Failed to jump';
      }

      // Short delay for button press
      await delay(100);

      // Release jump button
      const releaseSuccess = await this.wsClient.sendInput('Jump', 0.0);
      if (!releaseSuccess) {
        return 'Jump initiated but failed to release button';
      }

      return 'Jumped';
    } catch (error) {
      const errorMsg = `Error jumping: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return errorMsg;
    }
  }

  /**
   * Menu
   * 
   * @param ctx - MCP Context (optional)
   * @returns Promise resolving to a confirmation message
   */
  public async menu(ctx?: ToolContext): Promise<string> {
    if (ctx) {
      await ctx.info('Menu');
    }

    try {
      // Send jump input
      const success = await this.wsClient.sendInput('QuickMenuToggleLeft', 1.0);
      if (!success) {
        return 'Failed to Menu';
      }

      // Short delay for button press
      await delay(100);

      // Release jump button
      const releaseSuccess = await this.wsClient.sendInput('QuickMenuToggleLeft', 0.0);
      if (!releaseSuccess) {
        return 'Menu initiated but failed to release button';
      }

      return 'Menu';
    } catch (error) {
      const errorMsg = `Error Menu: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return errorMsg;
    }
  }

  /**
   * Make the avatar voice.
   * 
   * @param ctx - MCP Context (optional)
   * @returns Promise resolving to a confirmation message
   */
  public async voice(ctx?: ToolContext): Promise<string> {
    if (ctx) {
      await ctx.info('Voice');
    }

    try {
      // Send jump input
      const success = await this.wsClient.sendInput('Voice', 1.0);
      if (!success) {
        return 'Failed to Voice';
      }

      // Short delay for button press
      await delay(100);

      // Release jump button
      const releaseSuccess = await this.wsClient.sendInput('Voice', 0.0);
      if (!releaseSuccess) {
        return 'Voice initiated but failed to release button';
      }

      return 'Voice';
    } catch (error) {
      const errorMsg = `Error jumping: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return errorMsg;
    }
  }

  /**
   * Send a message to the VRChat chatbox.
   * 
   * @param message - Message to send
   * @param sendImmediately - Whether to send immediately
   * @param ctx - MCP Context (optional)
   * @returns Promise resolving to a confirmation message
   */
  public async sendChatboxMessage(
    message: string,
    sendImmediately: boolean = true,
    ctx?: ToolContext
  ): Promise<string> {
    if (ctx) {
      await ctx.info(`Sending message: "${message}" (immediate: ${sendImmediately})`);
    }

    try {
      const success = await this.wsClient.sendChatboxMessage(message, sendImmediately);
      if (success) {
        return `Message sent: "${message}"`;
      } else {
        return `Failed to send message: "${message}"`;
      }
    } catch (error) {
      const errorMsg = `Error sending message: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return errorMsg;
    }
  }
}