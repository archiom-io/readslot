import { describe, expect, it } from "vitest";
import { htmlFragmentToPlainText, parseImportedUrls } from "./import";

describe("htmlFragmentToPlainText", () => {
  it("removes ordinary markup without changing the readable title", () => {
    expect(htmlFragmentToPlainText("Read <strong>this</strong> next")).toBe("Read this next");
  });

  it("does not expose a new tag from nested multi-character input", () => {
    const title = htmlFragmentToPlainText("<<script>script>alert(1)<</script>");

    expect(title).toBe("scriptalert(1)");
    expect(title).not.toMatch(/[<>]/u);
  });

  it("drops an unterminated tag-shaped suffix", () => {
    expect(htmlFragmentToPlainText("Safe title<script")).toBe("Safe title");
  });
});

describe("parseImportedUrls", () => {
  it("returns a stable plain-text title from bookmark HTML", () => {
    const [item] = parseImportedUrls(
      "html",
      '<DT><A HREF="https://example.com"><<script>script>Useful<</script></A>'
    );

    expect(item).toEqual({ url: "https://example.com", title: "scriptUseful" });
  });
});
