---
name: ローカル定期実行の落とし穴
description: Task Scheduler から対話 claude を定期起動するときに実際に踏んだ 4 つの落とし穴と回避策（2026-09-09〜10 invenstment）
type: feedback
last_verified: 2026-09-10
---

対話モードの claude を Task Scheduler で毎朝起動し、固定セッションに `--resume` で追記する構成で踏んだもの。他プロジェクトで同じ構成を組むときは最初から避ける。

1. **Claude Code のセッション内のツールから対話 claude を起動しない。** `CLAUDE_CODE_*` 環境変数を継承し会話記録（`.jsonl`）を残さない。翌朝 `--resume` が「No conversation found」。検証は必ず `Start-ScheduledTask <task>` で Task Scheduler 経由にする
2. **PowerShell `Start-Process` 経由も同じく記録が残らない。** Task Scheduler の action は `cmd.exe /k "<batch>"` で直接 claude を呼ぶ
3. **Task Scheduler は `-MultipleInstances Parallel`。** 前日のウィンドウが開いたままだとタスクは実行中扱いで、既定の IgnoreNew では翌朝の起動が黙って無視される（0x800710E0）。旧ウィンドウはバッチ側で `taskkill` する。`-ExecutionTimeLimit` はゼロ（無制限）
4. **CLI の初回はフォルダ信頼ダイアログで止まる。** `~/.claude.json` の `projects[<path>].hasTrustDialogAccepted` を true にしておく。日本語コメント入りの `.ps1` は BOM なしだと PowerShell 5.1 が構文エラーになる（`.cmd` は ASCII のみで書く）

**Why**: 2026-09-09 夜に 3 回「止まっていた」を繰り返し HK を待たせた。原因は毎回別だったが、どれも起動経路の問題で、コード側ではなかった。

**How to apply**: 定期起動を組んだら、その日のうちに (a) 記録ファイルが出る (b) 2 回目起動で同じ記録に追記される (c) 時刻トリガーで発火する、の 3 点を Task Scheduler 経由で実証してから完了と言う。関連: `[[定期レポートはチャットで受け取る]]`
