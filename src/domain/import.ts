export type ImportFormat = "csv" | "html" | "markdown" | "urls";

export interface ImportedUrl {
  url: string;
  title?: string;
}

/**
 * Convert an HTML title fragment to plain text in one pass.
 *
 * A tag-shaped regular-expression replacement is intentionally avoided: nested input such as
 * `<<script>script>` can expose a new tag after a single replacement. This scanner never copies
 * angle brackets or text observed while inside a tag-shaped section to the result.
 */
export const htmlFragmentToPlainText = (value: string): string => {
  let plainText = "";
  let insideTag = false;

  for (const character of value) {
    if (character === "<") {
      insideTag = true;
      continue;
    }
    if (character === ">") {
      insideTag = false;
      continue;
    }
    const codePoint = character.codePointAt(0) ?? 0;
    if (!insideTag) plainText += codePoint <= 0x1f || codePoint === 0x7f ? " " : character;
  }

  return plainText.replace(/\s+/gu, " ").trim();
};

export const parseImportedUrls = (format: ImportFormat, text: string): ImportedUrl[] => {
  if (format === "html") {
    return [...text.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/giu)].map((match) => ({
      url: match[1],
      title: htmlFragmentToPlainText(match[2]) || undefined
    }));
  }
  if (format === "markdown") {
    const linked = [...text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gu)].map((match) => ({
      title: match[1],
      url: match[2]
    }));
    if (linked.length > 0) return linked;
  }
  if (format === "csv") {
    return text
      .split(/\r?\n/u)
      .slice(1)
      .map(
        (line) =>
          line
            .match(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/gu)
            ?.map((cell) => cell.replace(/^,?"?|"?$/g, "").replaceAll('""', '"')) ?? []
      )
      .map((cells) => ({
        title: cells[0],
        url: cells.find((cell) => /^https?:\/\//iu.test(cell)) ?? ""
      }))
      .filter((entry) => entry.url);
  }
  return text
    .split(/\s+/u)
    .filter((part) => /^https?:\/\//iu.test(part))
    .map((url) => ({ url: url.replace(/[),.;]+$/u, "") }));
};
