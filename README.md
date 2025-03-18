# VRChat MCP OSC

**VRChat MCP OSC** provides a bridge between AI assistants and VRChat using the Model Context Protocol (MCP), enabling AI-driven avatar control and interactions in virtual reality environments.  
*Note: This project is still under development. Certain detailed parameters cannot be configured yet, but support will be added soon.*

## Overview

By leveraging OSC (Open Sound Control) to communicate with VRChat, **VRChat MCP OSC** allows AI assistants such as Claude to:
- Control avatar parameters and expressions
- Send messages in VRChat
- Respond to various VR events  
And more—all through the high-level API provided by the Model Context Protocol.


## Key Features

- **Avatar Control**: Manipulate avatar parameters and expressions
- **Movement Control**: Direct avatar movement and orientation
- **Communication**: Send messages through VRChat's chatbox
- **Menu Access**: Toggle VRChat menu and interface elements
- **Avatar Information**: Query avatar properties and parameters
- **Seamless VRChat Integration**: Automatic detection of avatar configurations

## System Requirements

- Node.js 18 or higher
- VRChat with OSC enabled
- Claude Desktop (with MCP support)

## Using with Claude Desktop

planning to upload npm soon...

1. Clone this repository to your PC

2. Build with `pnpm -r build`

3. Configure VRChat to enable OSC (in-game settings)

4. Configure Claude Desktop to use VRChat MCP OSC by editing the `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "vrchat-mcp-osc": {
      "command": "node",
      "args": [
        "path_to_your_folder\\packages\\mcp-server\\dist\\server.js"
      ]
    }
  }
}
```

### Command Line Options

You can customize the server's behavior by adding command-line arguments:

```json
{
  "mcpServers": {
    "vrchat-mcp-osc": {
      "command": "node",
      "args": [
        "path_to_your_folder\\packages\\mcp-server\\dist\\server.js",
        "--websocket-port", "8765",
        "--websocket-host", "localhost",
        "--osc-send-port", "9000",
        "--osc-send-ip", "127.0.0.1",
        "--osc-receive-port", "9001",
        "--osc-receive-ip", "127.0.0.1",
        "--debug"             
      ]
    }
  }
}
```

### Available Options

| Option | Description | Default | Notes |
|--------|-------------|---------|-------|
| `--websocket-port <port>` | WebSocket port | 8765 | For WebSocket通信 |
| `--websocket-host <host>` | WebSocket host | localhost | For WebSocket通信 |
| `--osc-send-port <port>` | OSC send port | 9000 | VRChatへの送信ポート |
| `--osc-send-ip <ip>` | OSC send IP | 127.0.0.1 | VRChatへの送信アドレス |
| `--osc-receive-port <port>` | OSC receive port | 9001 | VRChatからの受信ポート |
| `--osc-receive-ip <ip>` | OSC receive IP | 127.0.0.1 | VRChatからの受信アドレス |
| `--debug` | Enable debug logging | false | 詳細なログを出力 |
| `--no-relay` | Disable relay server | false | リレーサーバーを使用しない場合 |

3. Restart Claude Desktop and enjoy AI-controlled avatar interactions!

## Available MCP Tools

VRChat MCP OSC exposes the following MCP tools to AI assistants:

| Tool Name | Description |
|-----------|-------------|
| `get_avatar_name` | Retrieves the current avatar's name |
| `get_avatar_parameters` | Lists available avatar parameters |
| `set_avatar_parameter` | Sets a specific avatar parameter |
| `set_emote_parameter` | Triggers avatar emotes |
| `move_avatar` | Moves the avatar in a specific direction |
| `look_direction` | Controls avatar's view direction |
| `jump` | Makes the avatar jump |
| `menu` | Toggles the VRChat menu |
| `voice` | Toggles voice features |
| `send_message` | Sends a message to the VRChat chatbox |


## Troubleshooting

### Common Issues

1. **VRChat not responding to commands**
   - Ensure OSC is enabled in VRChat settings
   - Check that the OSC ports match between VRChat and MCP configuration
   - Restart VRChat and Claude Desktop

2. **MCP server not starting**
   - Ensure Node.js 18+ is installed
   - Check console logs in Claude Desktop for errors
   - Try running with `--debug` flag for more detailed logs

## Project Structure

```
vrchat-mcp-osc/
├── packages/
│   ├── mcp-server/    # MCP server implementation
│   ├── relay-server/  # WebSocket to OSC relay
│   ├── types/         # Shared TypeScript interfaces
│   └── utils/         # Common utilities
└── pnpm-workspace.yaml  # Workspace configuration
```

## License
VRChat MCP OSC is dual-licensed as follows:

For Non-Commercial Use:
You may use, modify, and redistribute the software under the terms of the MIT License.
(See the MIT License file for details.)

For Commercial Use:
Commercial use of this software requires a separate commercial license.


By using this software under the MIT License for non-commercial purposes, you agree to the terms of that license. Commercial users must obtain a commercial license as described above.

## Acknowledgments

- VRChat team for the OSC integration
- Model Context Protocol for the standardized AI interface
- Anthropic for Claude's MCP implementation
