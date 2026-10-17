#!/usr/bin/env node

/**
 * PostToolUse hook: src/ または tests/ の JS を編集したら、関連テストを実行する。
 * テストが失敗した場合は exit code 2 で終了し、出力を Claude に返す。
 */

const { spawnSync } = require("child_process");
const path = require("path");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let filePath;
  try {
    filePath = JSON.parse(input).tool_input?.file_path;
  } catch {
    return;
  }
  if (!filePath) return;

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const relative = path.relative(projectDir, filePath);
  if (!/^(src|tests)\/.*\.js$/.test(relative)) return;

  const result = spawnSync(
    "npx",
    ["jest", "--findRelatedTests", relative, "--passWithNoTests"],
    { cwd: projectDir, encoding: "utf8" }
  );

  if (result.status !== 0) {
    process.stderr.write(
      `関連テストが失敗しました (${relative})\n${result.stdout}${result.stderr}`
    );
    process.exit(2);
  }
});
