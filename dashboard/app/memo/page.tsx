import Link from "next/link";

export default function MemoIndexPage() {
  return (
    <main className="memo-reader">
      <div className="memo-reader__bar">
        <Link href="/">← 司令室へ戻る</Link>
        <span>メモ未指定</span>
      </div>
      <section className="panel">
        <h1>メモを選んでください</h1>
        <p>司令室のWatch表またはメモリンクから開くと、静的生成済みのMarkdownを表示します。</p>
      </section>
    </main>
  );
}
