import { describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";

// dompurify reads `window` at import time — install a DOM before importing markdown.ts
const dom = new JSDOM("");
(globalThis as Record<string, unknown>).window = dom.window;
(globalThis as Record<string, unknown>).document = dom.window.document;

const { renderMarkdown } = await import("../web/src/lib/markdown");

describe("renderMarkdown", () => {
  test("highlights fenced code with hljs spans", () => {
    const html = renderMarkdown("```ts\nconst x: number = 1;\n```");
    expect(html).toContain('<code class="hljs language-ts">');
    expect(html).toContain('class="hljs-keyword"');
    expect(html).toContain('class="hljs-number"');
  });

  test("language aliases resolve to registered languages", () => {
    expect(renderMarkdown("```sh\necho hi\n```")).toContain("language-sh");
    expect(renderMarkdown("```html\n<p>hi</p>\n```")).toContain("language-html");
  });

  test("unknown or missing lang falls back to escaped plaintext", () => {
    const html = renderMarkdown("```nope\n<script>alert(1)</script>\n```");
    expect(html).toContain("language-plaintext");
    expect(html).not.toContain("<script>");
  });

  test("still sanitizes html and hardens links", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">\n\n[link](https://example.com)');
    expect(html).not.toContain("onerror");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  test("task-list checkboxes still pass", () => {
    const html = renderMarkdown("- [x] done");
    expect(html).toContain("<input");
    expect(html).toContain('type="checkbox"');
  });
});
