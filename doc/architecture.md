# VRChat MCP OSC アーキテクチャ

## 全体構成

### アプリケーション層

- **AI Assistant (Claude)**
  - AIアシスタントが VRChat を操作するためのインターフェース
  - MCPを介してVRChatと対話

- **MCP Server**
  - Model Context Protocol を実装したサーバー
  - AIアシスタントとの通信を処理

- **Relay Server**
  - WebSocket と OSC 間の通信を中継
  - 効率的なメッセージング処理

- **VRChat OSC**
  - VRChat との OSC 通信を処理
  - アバター制御とイベント処理

### パッケージ構成

- **mcp-server**
  - メインのMCPサーバー実装
  - AI機能とVRChatの橋渡し

- **relay-server**
  - WebSocketとOSC間のリレーサーバー
  - 双方向通信の実現

- **types**
  - 共通の型定義
  - 型安全性の確保

- **utils**
  - 共通のユーティリティ関数
  - ログ機能など

## 主要機能

### アバター制御機能

- **パラメータ管理**
  - アバターパラメータの取得
  - パラメータの設定
  - 値の監視と更新

- **アバター情報**
  - アバター情報の取得
  - コンフィグの読み込み
  - 状態管理

- **エモート制御**
  - エモートトリガー
  - アニメーション制御

### 通信機能

- **OSC通信**
  - メッセージの送受信
  - イベント処理
  - エラーハンドリング

- **WebSocket通信**
  - クライアントとの接続
  - リアルタイムデータ転送
  - セッション管理

### ユーティリティ機能

- **設定管理**
  - アバターコンフィグの読み込み
  - パラメータの初期化
  - 設定の永続化

- **ログ機能**
  - 詳細なログ記録
  - エラー追跡
  - デバッグサポート

## 通信フロー

```
AI Assistant → Relay Server → MCP Server → VRChat OSC ⇄ VRChat
```

- AIアシスタントがコマンドを発行
- Relay Serverが適切な形式に変換
- MCP Serverが処理を実行
- VRChat OSCがVRChatと通信
- 結果が逆順で返される

## 技術スタック

- **言語**: TypeScript
- **通信プロトコル**: OSC, WebSocket
- **パッケージ管理**: pnpm
- **主要ライブラリ**:
  - node-osc: OSC通信
  - ws: WebSocket実装
  - winston: ログ管理