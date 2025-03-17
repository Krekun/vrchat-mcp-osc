# VR Butler

VRChat でのAIアシスタント体験を提供するための統合ソリューション。

## 概要

VR Butler は、VRChat内でのユーザー体験を向上させるために設計された、AIアシスタントの統合フレームワークです。MCPサーバーとVRChat OSCの間の橋渡しをすることで、AIアシスタントがVRChatアバターを制御できるようにします。

## 主な機能

- **アバター制御**: アバターパラメータの取得と設定
- **入力制御**: 移動、視線方向、ジャンプなどの基本アクション
- **チャット機能**: VRChatのチャットボックスへのメッセージ送信
- **自動統合**: ワンコマンドで全コンポーネントを起動

## インストール

```bash
# npm を使用する場合
npm install -g vrchat-mcp-osc

# pnpm を使用する場合
pnpm add -g vrchat-mcp-osc
```

## 使い方

### コマンドライン

```bash
# デフォルト設定で起動
vrchat-mcp-osc start

# WebSocketポートを指定して起動
vrchat-mcp-osc start --ws-port 8766

# 詳細ログを有効にして起動
vrchat-mcp-osc start --verbose
```

### プログラム内での使用

```javascript
import { Butler } from 'vrchat-mcp-osc';

// Butlerインスタンスを作成
const butler = new Butler({
  wsPort: 8765,
  oscSendPort: 9000,
  oscReceivePort: 9001
});

// 起動
await butler.start();

// サービスの実行中...

// 停止
await butler.stop();
```

## アーキテクチャ

VR Butler は以下のコンポーネントから構成されています：

1. **MCPサーバー**: Model Context Protocol に準拠したサーバー
2. **リレーサーバー**: WebSocketとOSCの間の中継
3. **共通ライブラリ**: 型定義とユーティリティ関数

これらのコンポーネントは統合されて動作し、MCPサーバーがリレーサーバーを自動的に起動・管理します。

## 設定

環境変数または設定ファイルを使用して設定を行うことができます。

| 環境変数 | デフォルト値 | 説明 |
|---------|------------|------|
| `VR_BUTLER_WEBSOCKET_PORT` | 8765 | WebSocketサーバーのポート |
| `VR_BUTLER_WEBSOCKET_HOST` | localhost | WebSocketサーバーのホスト |
| `VR_BUTLER_OSC_SEND_PORT` | 9000 | OSC送信ポート |
| `VR_BUTLER_OSC_RECEIVE_PORT` | 9001 | OSC受信ポート |

## 開発

リポジトリをクローンして開発を始めることができます：

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/vrchat-mcp-osc.git
cd vrchat-mcp-osc

# 依存関係のインストール
pnpm install

# すべてのパッケージのビルド
pnpm build

# 開発モードでの実行
pnpm dev
```

## ライセンス

MIT