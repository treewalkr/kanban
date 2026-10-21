import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: true, async: false });

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.getAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/** Card note → sanitized markdown HTML (safe for {@html}). */
export function renderMarkdown(src: string): string {
  return DOMPurify.sanitize(marked.parse(src) as string, {
    ADD_TAGS: ["input"], // gfm task-list checkboxes
  });
}
