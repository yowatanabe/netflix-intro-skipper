#!/usr/bin/env node

/**
 * PreToolUse hook: manifest.json の version を直接編集する操作をブロックする。
 * version は package.json を正とし、`npm run version:*` で同期する運用のため。
 * version 以外 (host_permissions など) の編集は許可する。
 * ブロック時は exit code 2 で終了し、理由を Claude に返す。
 */

const fs = require("fs");
const path = require("path");

// "manifest_version" は対象外にするため、直前が "_" でない "version" だけを拾う
const VERSION_PATTERN = /(?<!_)"version"\s*:\s*"([^"]*)"/;

const extractVersion = (text) => text?.match(VERSION_PATTERN)?.[1];

function changesVersion(toolName, toolInput, filePath) {
  if (toolName === "Write") {
    let current;
    try {
      current = extractVersion(fs.readFileSync(filePath, "utf8"));
    } catch {
      return false;
    }
    return extractVersion(toolInput.content) !== current;
  }

  const edits =
    toolName === "MultiEdit"
      ? toolInput.edits || []
      : [{ old_string: toolInput.old_string, new_string: toolInput.new_string }];

  return edits.some(
    (edit) =>
      extractVersion(edit.old_string) !== extractVersion(edit.new_string)
  );
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    return;
  }

  const toolInput = data.tool_input || {};
  const filePath = toolInput.file_path;
  if (!filePath || path.basename(filePath) !== "manifest.json") return;

  if (changesVersion(data.tool_name, toolInput, filePath)) {
    process.stderr.write(
      [
        "manifest.json の version は直接編集できません。",
        "package.json の version を正として、次のコマンドで同期してください。",
        "  npm run version:patch | version:minor | version:major",
        "  (事前確認: npm run version:dry-run:patch など)",
      ].join("\n") + "\n"
    );
    process.exit(2);
  }
});
