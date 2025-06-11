# GitHub PR 自動オープンルール

## ルール
Claude Codeで`gh pr create`コマンドを実行してPRを作成した場合、自動的にBraveブラウザでPRのURLを開く。

## 実装方法
1. `gh pr create`の実行後、出力されたPR URLを取得
2. `open -a "Brave Browser" [PR_URL]`コマンドを実行

## 使用例
```bash
# PRを作成
PR_URL=$(gh pr create --title "..." --body "...")

# Braveブラウザで開く
open -a "Brave Browser" "$PR_URL"
```

## Claude Codeでの適用
Claude Codeがこのルールに従って、PR作成後は自動的にBraveブラウザでPRページを開きます。