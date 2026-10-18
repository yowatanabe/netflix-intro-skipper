# CLAUDE.md

Netflix のイントロを自動スキップする Chrome 拡張機能 (Manifest V3)。ビルド工程のない素の JavaScript で、個人利用向け (Chrome ウェブストアでは公開しない)。

## コマンド

```bash
npm test                          # 全テスト (Jest + jsdom)
npm test -- <file>.test.js        # 特定のテストのみ
npm run test:watch                # ウォッチモード
npm run test:coverage             # カバレッジ (coverage/ に出力、Git管理外)
```

動作確認は Chrome の `chrome://extensions/` で「パッケージ化されていない拡張機能」としてこのディレクトリを読み込み、変更後に再読み込みする。jsdom のテストでは実ブラウザ上のポップアップ UI やコンテンツスクリプトの挙動までは確認できない。

## 構成

- `src/content.js` — Netflix ページ上で動くコンテンツスクリプト (約2,700行で最大)。スキップボタンの検出とクリック
- `src/background.js` — Service Worker
- `src/integration.js` — content / popup / background 間の通信と状態同期
- `src/settings.js` — 設定管理 (`chrome.storage`)
- `src/version.js` — `chrome.runtime.getManifest()` からバージョンを取得
- `src/popup/` — ポップアップ UI
- `tests/` — Jest のテスト。fast-check によるプロパティベーステストを含む
- `.kiro/specs/netflix-intro-skipper/` — 要件 (`requirements.md`)・設計 (`design.md`)・タスク (`tasks.md`)

コンテンツスクリプトは `manifest.json` の `content_scripts` に書かれた順 (`version.js` → `settings.js` → `integration.js` → `content.js`) で読み込まれる。ファイルを追加・分割するときは `manifest.json` の登録と順序も更新する。

## 注意点

- **Service Worker はスリープする**。PC スリープ後に壊れた実績がある (PR #1)。`background.js` では状態をメモリに依存させず、`integration.js` のウェイクアップ処理との整合を保つ。
- **Netflix の DOM は予告なく変わる**。セレクタを変更するときは多言語対応 (日本語・英語ほか) と、関連テスト (`auto-click` / `retry-mechanism` / `ui-non-interference` など) を確認する。
- **対象ドメインは `manifest.json` の `host_permissions` と `content_scripts.matches` の2か所に列挙されている**。ドメインを追加・削除するときは両方を揃え、`tests/domain-filtering.test.js` も確認する。
- 拡張機能は Netflix のページを操作するため、ページの見た目や再生を妨げない (非侵入) ことが要件。

## バージョン管理

`package.json` の `version` を正とし、`scripts/release-version.js` が `manifest.json` へ同期する。**`manifest.json` の `version` を手で編集しない**。

```bash
npm run version:dry-run:patch     # 事前確認 (patch / minor / major)
npm run version:patch             # 実行 (patch / minor / major)
```

実行時は、整合性チェック → `npm version` (`preversion` で `npm test` が走る) → `manifest.json` への同期、の順に進む。タグは作成されない (`--no-git-tag-version`) ので、`v1.0.2` のようなタグ (`v` + バージョン) は手動で付ける。

## Git 運用

- `main` から `feature/*` / `fix/*` ブランチを切り、Pull Request でマージする
- コミットメッセージは `feat:` / `fix:` などの接頭辞 + 日本語の要約 (例: `fix: PCスリープ後のService Worker問題を修正`)

## CI / 自動化

`.github/workflows/` に3系統ある。

- `ci.yml` — PR と `main` への push で `npm ci` と `npm test` を実行する。ジョブ名 `test` は ruleset の必須チェックなので、名前を変えない
- `dependabot-automerge.yml` — Dependabot の PR すべてに auto-merge を予約し、更新の種類 (major / minor / patch) をコメントする。マージには、ruleset によるコードオーナーの承認と `test` の成功が必要
- `ai-review.yml` / `ai-review-post.yml` — PR を Kiro CLI (ヘッドレス、V3) がレビューし、PR にコメントを1つ書き続ける。助言のみで、マージの必須チェックではない。プロンプトは `.github/kiro-review-prompt.md`

AI レビューの注意点:

- シークレット `NETFLIX_INTRO_SKIPPER_ACTIONS_DEPENDABOT` (Kiro の API キー) を、**Actions と Dependabot の両方**に、同じ名前で登録する。Dependabot の PR は Dependabot 用のシークレットしか読めない
- `npm ci` / `npm test` を実行するジョブ (`prepare`) と、Kiro を動かすジョブ (`review`) を分けている。シークレットを使うジョブで PR のコードを実行しない。この分離を崩さない
- Kiro に許可するツールは読み取りと検索 (`read_file`, `grep_search`) だけ。シェルや書き込みを許可しない
- フォークからの PR は対象外。公開リポジトリで、外部の PR にシークレットを渡さない
- AI は、削除された API の使用を見逃すことがある (fast-check 4 の更新で確認済み)。合否は `test` の結果で判断し、AI のレビューは補助として扱う
