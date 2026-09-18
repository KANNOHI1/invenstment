# Claude Code Auto Memory

## プロジェクト索引

- [定期レポートはチャットで受け取る](feedback_report_via_chat_session.md) — 定期実行の成果物は続きの会話ができるセッションへ。メール・ファイルは差し戻し済み
- [ローカル定期実行の落とし穴](feedback_local_scheduled_claude_pitfalls.md) — 固定セッション定期起動の 7 つの落とし穴。冪等判定は専用マーカーで持つ（副産物の mtime を流用しない）
- [巡回の固定セッションIDと3セッション体制（巡回は廃止）](project_patrol_session_id.md) — 毎朝巡回は 2026-09-18 に廃止（固定セッション --resume の履歴肥大）。ニュース監視も同日廃止。残るのは監督のみ。再開するなら毎朝新規セッション
- [監視項目は登録前に先行性を測る](project_register_gate.md) — 週足5年で先4/8/13週を測る。3件棄却の経緯
- [ニュース監視セッションの運用契約（廃止）](project_news_watch_session.md) — 2026-09-18 廃止。監督が材料を調べるときの型（一次裏取り・3段階・±8% 深掘り）はここ
- [一次資料のPDFは WebFetch→Read で読む](feedback_primary_pdf_via_webfetch_read.md) — WebFetch はPDF本文を返さないが保存はする。そのパスを Read の pages 指定で開く
- [定期実行を固定セッションの --resume で回さない](feedback_no_resume_for_scheduled_runs.md) — 履歴肥大で cache read が 8 日で 2.4 倍。定期実行は毎回新規セッション、文脈はファイルに
