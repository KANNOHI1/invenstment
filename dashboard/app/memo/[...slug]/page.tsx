import Link from "next/link";
import { getStaticMemoPaths, readProjectMarkdown } from "@/lib/data";
import { getMarkdownReadingMeta } from "@/lib/markdown";
import { MarkdownView } from "../markdown-view";

export function generateStaticParams() {
  return getStaticMemoPaths().map((path) => ({
    slug: path.split("/")
  }));
}

export default async function MemoPage({
  params
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const relativePath = slug.join("/");
  const body = readProjectMarkdown(relativePath);
  const meta = body ? getMarkdownReadingMeta(body) : null;

  return (
    <main className="memo-reader">
      <div className="memo-reader__bar">
        <Link href="/">← 司令室へ戻る</Link>
        <span>{relativePath}</span>
      </div>
      {body ? (
        <>
          <header className="memo-hero">
            <p className="eyebrow">RESEARCH NOTE</p>
            <h1>{meta?.title}</h1>
            <div className="memo-stats">
              <span>{meta?.headingCount} headings</span>
              <span>{meta?.tableCount} tables</span>
              <span>{meta?.bulletCount} bullets</span>
            </div>
          </header>
          <MarkdownView body={body} />
        </>
      ) : (
        <section className="panel">
          <h1>メモを開けません</h1>
          <p>指定されたMarkdownが見つからないか、プロジェクト外のパスです。</p>
        </section>
      )}
    </main>
  );
}
