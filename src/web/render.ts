import MarkdownIt from "markdown-it";
import sanitize from "sanitize-html";
const md = new MarkdownIt({ html: true, linkify: false, breaks: true });
export function renderMarkdown(markdown: string) {
  return sanitize(md.render(markdown), {
    allowedTags: ["h1", "h2", "h3", "h4", "p", "br", "strong", "em", "ul", "ol", "li", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "hr", "pre", "code", "s", "sup", "sub"],
    allowedAttributes: { td: ["colspan", "rowspan"], th: ["colspan", "rowspan"], ol: ["start"] },
    disallowedTagsMode: "discard"
  });
}
export function documentHtml(markdown: string) {
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.65;color:#213d39}table{border-collapse:collapse;width:100%}td,th{border:1px solid #baccc6;padding:8px}th{background:#edf5f1}h1,h2{color:#155d50}</style><body>${renderMarkdown(markdown)}</body></html>`;
}
