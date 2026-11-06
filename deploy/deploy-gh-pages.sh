#!/usr/bin/env bash
# 把当前内容发布到 GitHub Pages（仓库 main 分支根目录）
set -euo pipefail
cd "$(dirname "$0")/.."

REPO="${1:-JarrettChen888/ta-xue-biancheng}"
MSG="${2:-更新课程内容：$(date +%Y-%m-%d\ %H:%M)}"

echo "==> 检查全站"
python3 tools/check_site.py

echo "==> 提交"
git add -A
if git diff --cached --quiet; then
  echo "没有需要提交的改动。"
else
  git commit -m "$MSG"
fi

echo "==> 推送 $REPO"
git push origin main

echo "==> 线上地址：https://$(echo "$REPO" | cut -d/ -f1 | tr '[:upper:]' '[:lower:]').github.io/$(echo "$REPO" | cut -d/ -f2)/"
