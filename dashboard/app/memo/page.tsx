import Link from "next/link";
import { readProjectMarkdown } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MemoPage({
  searchParams
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const params = await searchParams;
  const relativePath = params.path ?? "";
  const body = readProjectMarkdown(relativePath);

  return (
    <main className="memo-reader">
      <div className="memo-reader__bar">
        <Link href="/">← 司令室へ戻る</Link>
        <span>{relativePath || "未指定"}</span>
      </div>
      {body ? (
        <pre className="memo-reader__body">{body}</pre>
      ) : (
        <section className="panel">
          <h1>メモを開けません</h1>
          <p>指定されたMarkdownが見つからないか、プロジェクト外のパスです。</p>
        </section>
      )}
    </main>
  );
}
