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

1. clone this repository to your pc

1. build with pnpm -r build

2. Configure VRChat to enable OSC (in-game settings)

3. Configure Claude Desktop to use VRChat MCP OSC by editing the `claude_desktop_config.json` file:

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
