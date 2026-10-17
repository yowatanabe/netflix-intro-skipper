---
name: release
description: バージョンを更新してリリースを準備する (dry-run 確認 → 更新 → コミット → マージ後のタグ付け)
argument-hint: patch | minor | major
disable-model-invocation: true
---

# リリース手順

引数 `$ARGUMENTS` は `patch` / `minor` / `major` のいずれか。指定がない、または不正な場合は、どれにするかユーザーに確認して中断する。

バージョンは `package.json` を正とし、`scripts/release-version.js` が `manifest.json` へ同期する。`manifest.json` の `version` は手で編集しない (hook でもブロックされる)。

## 1. 事前確認

- `git status --short` が空であること。未コミットの変更があれば中断して知らせる
- 現在のブランチが `main` で、`git pull --ff-only` 済みであること。そうでなければユーザーに確認する

## 2. Dry Run

`npm run version:dry-run:$ARGUMENTS` を実行し、何が起きるかをユーザーに見せる。**ユーザーが承認するまで次へ進まない。**

## 3. バージョン更新

`npm run version:$ARGUMENTS` を実行する。`preversion` で `npm test` が走り、テストが失敗した場合はそこで中断して内容を報告する。

成功したら `package.json` の新しい version を読み取り (以下 `X.Y.Z`)、`package.json` / `package-lock.json` / `manifest.json` の3つだけが変更されていることを `git status --short` と `git diff` で確認する。意図しない変更があれば中断する。

## 4. ブランチとコミット

- `release/vX.Y.Z` ブランチを作成して切り替える (`main` に直接コミットしない)
- 3ファイルをコミットする。メッセージは `chore: リリース vX.Y.Z`

## 5. PR の作成

ユーザーに確認したうえで、`/commit-push-pr` などでプッシュして PR を作成する。**ユーザーの確認なしにプッシュしない。**

## 6. マージ後のタグ付け

PR がマージされたことをユーザーから伝えられたら実行する。

1. `main` に切り替えて `git pull --ff-only`
2. 注釈付きタグを作成する。過去のタグと同じ形式にする
   `git tag -a vX.Y.Z -m "Release vX.Y.Z - <変更内容の要約>"`
3. ユーザーに確認してから `git push origin vX.Y.Z`

タグは付け直しが難しいため、作成前に `git log --oneline -3` で対象コミットがマージコミットであることを確認する。
