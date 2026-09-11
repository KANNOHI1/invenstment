---
name: 巡回の固定セッションID
description: 毎朝のブリーフィングを出す固定セッションの ID と、デスクトップアプリのセッションがオーナーになれない理由
type: project
last_verified: 2026-09-11
---

毎朝の巡回（ブリーフィング）を出す**固定セッションの ID は `36358243-ef8c-4c8b-ba08-30112934c274`**。
ターミナルの `claude` ウィンドウで、`scripts/run_patrol.cmd` の `SID=` と同じ値。transcript は
`~/.claude/projects/C--Users-c6341-Documents-Projects-invenstment/36358243-....jsonl`。
Remote Control 経由でスマホの「Morning patrol」スレッドに届く。

**デスクトップアプリ（Code タブ）のセッションは巡回のオーナーになれない。**
理由2つ: (a) セッション ID を持つ claude プロセスがプロセス一覧に現れないため、`run_patrol.cmd` の
ALIVE 判定が常に「窓が死んでいる」と誤認する (b) 外から `--resume` できない（アプリが同じ jsonl を
開いている最中に別プロセスが追記すると壊れる）。よって復旧手段がセッション内 cron だけになり、
PC 再起動で消えたら自力で戻せない。2026-09-10 にデスクトップ側へ移そうとして、翌朝の再起動で
cron が消え、保険が拾った結果**オーナーが2つになり巡回が重複した**。

**ブリーフィングは固定セッション1つがオーナー。** デスクトップ側のセッションは議論・分析・開発に使う。
関連: [[feedback_local_scheduled_claude_pitfalls]] [[feedback_report_via_chat_session]]
