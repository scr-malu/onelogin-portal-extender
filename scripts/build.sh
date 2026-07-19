#!/usr/bin/env bash
# src/ の内容を Chrome Web Store 提出用の zip にまとめる
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' src/manifest.json)
if [ -z "$VERSION" ]; then
  echo "エラー: src/manifest.json からバージョンを取得できませんでした" >&2
  exit 1
fi

OUT="dist/onelogin-portal-extender-v${VERSION}.zip"

mkdir -p dist
rm -f "$OUT"
(cd src && zip -r "../$OUT" . -x ".*")

echo "ビルド完了: $OUT"
