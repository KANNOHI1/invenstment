---
name: 一次資料のPDFは WebFetch→Read で読む
description: WebFetch は PDF の中身を返せないがローカルに保存する。そのパスを Read の pages 指定で読むと表も数字も取れる（FOMC 声明・SEP で実証）
type: feedback
last_verified: 2026-09-17
---

**WebFetch に PDF の URL を渡すと「バイナリで読めない」と返ってくるが、諦めない。** 応答の末尾に
`[Binary content (application/pdf, ...) also saved to <ローカルパス>]` が付いており、**実体はダウンロード済み**。
そのパスを **`Read` の `pages` 指定**（例 `pages: "2-3"`）で開くと、表・数字・脚注まで画像として正確に読める。

**実証（2026-09-17 invenstment）**: FOMC の投下条件判定で、`federalreserve.gov` の当日資料から
2 つの数字を一次で取る必要があった。
- 声明 `monetary20260916a1.pdf` → 誘導目標の引き上げ幅・新レンジ・票決（12-0）
- SEP `fomcprojtabl20260916.pdf`（1.2MB・17ページ）→ Table 1 の中央値行（政策金利 2026末 4.1 等）

WebFetch は両方とも「corrupted or improperly encoded」と返したが、保存されたパスを `Read` で
ページ指定したところ、**Table 1 の中央値・中心傾向・レンジ、6月時点との比較行まで完全に読めた**。

**How to apply**
- 一次資料が PDF のときは「WebFetch → 失敗メッセージ内のパスを `Read pages:`」を1セットの手順とみなす
- **必要なページだけ指定する。** 17ページの PDF を全部開かない（表は冒頭 2〜3 ページに集中していることが多い）
- 報道や二次要約で代替しない。数字の規律（出所のない数字は出さない）に直結する場面ほど、この手順で一次に当たる

関連: [[project_register_gate]]
