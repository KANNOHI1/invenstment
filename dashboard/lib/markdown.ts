export type MarkdownReadingMeta = {
  title: string;
  headingCount: number;
  tableCount: number;
  bulletCount: number;
};

export function getMarkdownReadingMeta(markdown: string): MarkdownReadingMeta {
  const lines = markdown.split(/\r?\n/);
  const titleLine = lines.find((line) => /^#\s+/.test(line.trim()));
  const headings = lines.filter((line) => /^#{1,6}\s+/.test(line.trim()));
  const tableSeparators = lines.filter((line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line));
  const bullets = lines.filter((line) => /^\s*[-*]\s+\S/.test(line));

  return {
    title: titleLine ? titleLine.replace(/^#\s+/, "").trim() : "投資メモ",
    headingCount: headings.length,
    tableCount: tableSeparators.length,
    bulletCount: bullets.length
  };
}
