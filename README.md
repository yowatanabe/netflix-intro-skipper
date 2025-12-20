# Netflix Intro Skipper

Netflix のイントロを自動的にスキップする Chrome 拡張機能です。

## 🎯 機能

- ✅ Netflix の「イントロをスキップ」ボタンを自動検出・クリック
- ✅ 自動スキップ機能のオン/オフ切り替え
- ✅ 世界各国の Netflix ドメインに対応
- ✅ 軽量で非侵入的な設計
- ✅ 多言語対応（日本語、英語、その他）
- ✅ セッション管理で複数動画に対応
- ✅ 堅牢なエラーハンドリング

## 🚀 インストール方法

**注意**: このツールは個人利用のために作成されたもので、現時点では Chrome ウェブストアで公開する予定はありません。以下の手順で手動インストールしてください。

1. このプロジェクトのファイルをダウンロード
2. Chrome を開き、`chrome://extensions/` にアクセス
3. 右上の「デベロッパーモード」を有効にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. 拡張機能のディレクトリを選択
6. 拡張機能がインストールされ、使用準備完了

## 📖 使用方法

1. Netflix にアクセスして動画の視聴を開始
2. イントロが表示されると、拡張機能が自動的にスキップ
3. 拡張機能のポップアップで自動スキップのオン/オフを切り替え可能
4. 設定はブラウザセッション間で保存されます

## 🛠️ 開発

### 開発者向け（コードを修正・テストする場合）

拡張機能のコードを修正したり、テストを実行したい場合のみ以下が必要です：

### 環境セットアップ

```bash
# 依存関係をインストール（開発・テスト用）
npm install

# すべてのテストを実行
npm test

# 特定のテストを実行
npm test -- integration.test.js

# テストをウォッチモードで実行
npm run test:watch

# テストカバレッジを確認
npm run test:coverage
```

### 開発ワークフロー

1. **ソースコード**: `src/` フォルダ内のファイルを編集
2. **テスト**: `tests/` フォルダ内でテストを作成・実行
3. **アイコン**: `assets/icons/` でアイコンファイルを管理
4. **拡張機能テスト**: Chrome で `chrome://extensions/` から再読み込み

### プロジェクト構造

```none
netflix-intro-skipper/
├── .kiro/                              # Kiro 仕様ドキュメント
│   └── specs/
│       └── netflix-intro-skipper/
│           ├── design.md               # 設計ドキュメント
│           ├── requirements.md         # 要件定義
│           └── tasks.md                # 実装タスク
├── .vscode/                            # VS Code / Kiro 設定
│   └── settings.json                   # プロジェクト固有設定
├── assets/                             # 静的ファイル
│   ├── icons/                          # 拡張機能アイコン
│   │   ├── icon16.png                  # 16x16px アイコン
│   │   ├── icon32.png                  # 32x32px アイコン
│   │   ├── icon48.png                  # 48x48px アイコン
│   │   ├── icon128.png                 # 128x128px アイコン
│   │   └── README.md                   # アイコン作成ガイド
│   └── .gitkeep
├── coverage/                           # テストカバレッジレポート(Git管理外)
├── node_modules/                       # npm 依存関係(Git管理外)
├── src/                                # ソースコード
│   ├── popup/                          # ポップアップUI
│   │   ├── .gitkeep
│   │   ├── popup.html                  # 設定インターフェース
│   │   └── popup.js                    # ポップアップロジック
│   ├── .gitkeep
│   ├── background.js                   # バックグラウンドサービスワーカー
│   ├── content.js                      # Netflix ページ用コンテンツスクリプト
│   ├── integration.js                  # コンポーネント統合管理
│   └── settings.js                     # 設定管理
├── tests/                              # テストファイル
│   ├── .gitkeep
│   ├── auto-click.test.js              # 自動クリック機能のテスト
│   ├── conditional-behavior.test.js    # 条件付き動作のテスト
│   ├── domain-filtering.test.js        # ドメインフィルタリングのテスト
│   ├── e2e.test.js                     # エンドツーエンドテスト
│   ├── error-handling.test.js          # エラーハンドリングのテスト
│   ├── integration.test.js             # 統合テスト
│   ├── multiple-video-session.test.js  # 複数動画セッションのテスト
│   ├── no-action-behavior.test.js      # 非アクション時の動作テスト
│   ├── popup.test.js                   # ポップアップUIのテスト
│   ├── retry-mechanism.test.js         # リトライ機構のテスト
│   ├── settings-persistence.test.js    # 設定永続化のテスト
│   ├── test-setup.js                   # Jest テスト設定
│   └── ui-non-interference.test.js     # UI非干渉性のテスト
├── .gitignore                          # Git 除外設定
├── LICENSE                             # MIT ライセンス
├── manifest.json                       # 拡張機能の設定
├── package-lock.json                   # npm 依存関係ロック
├── package.json                        # プロジェクト設定とテスト設定
└── README.md
```

## 🏗️ 技術仕様

- **Manifest V3** - 最新の Chrome 拡張機能 API

## 📋 動作要件

- Chrome ブラウザ（Manifest V3 対応）
- Netflix サブスクリプションとアクセス権

## 📄 ライセンス

このプロジェクトは [MIT License](LICENSE) の下でライセンスされています。

## 🙏 謝辞

- [Netflix](https://www.netflix.com) - 素晴らしいストリーミングサービス
- [Kiro](https://kiro.dev) - このプロジェクトの開発を支援してくれた Agentic IDE。仕様・デザイン・タスクの作成から実装やテストまで全ての工程でサポートしてくれました。Kiro のおかげで私のアイデアが実現できました。
- [Lovart AI](https://lovart.ai) - 拡張機能アイコンのデザイン作成に使用

---

**注意**: この拡張機能は Netflix の公式製品ではありません。個人利用目的で作成されており、Netflix の利用規約に従って使用してください。
