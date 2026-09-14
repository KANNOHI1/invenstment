---
name: 巡回の固定セッションID
description: 2人体制の分担（巡回=固定セッション 36358243、監督=デスクトップ側）、連携の手段、デスクトップ側がオーナーになれない理由
type: project
last_verified: 2026-09-14
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

**2人体制（2026-09-14 ユーザー決定）。** 「あなたが監督として2人のチーム。必ずあちらのセッションと連携。パトロールは彼の仕事。」
- 連携手段: `ListAgents` に「Morning Patrol」として出る。`SendMessage(to="Morning Patrol")`。返信は `<cross-session-message>` で届く
- 監督のルール: 巡回に影響する変更（スクリプト・登録簿・仕様）は**先に通知してから入れる**。同じファイルを同時に触らない（先方が push するまで待つ）。巡回が見つけた装置の穴・検証したい仮説は監督が受け、菅野さんには監督から持っていく
- 巡回のルール: `rotation_state.md` 冒頭ブロックと `thesis_register.md` を毎回読む。追記は事実と出所のみ
