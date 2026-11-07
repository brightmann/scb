/**
 * 修补粘贴进编辑器的 YouTube iframe 嵌入代码。
 *
 * 背景：编辑器没有视频节点时，粘贴的 `<iframe>` 嵌入代码会被 Tiptap
 * 存成转义文本（最常见是整个包进一个 <pre><code> 代码块），前台
 * dangerouslySetInnerHTML 原样输出，于是只显示一串代码、看不到视频。
 * 这里在渲染时把它还原成真正的视频（不改数据库里的原文）。
 *
 * 规则：
 * - 只处理 src 是 youtube.com/embed 或 youtube-nocookie.com/embed 的 iframe；
 *   其他站点的 iframe 文本原样保留（不替用户决定它是否安全）。
 * - 已是真实 <iframe> / <div data-youtube-video> 的内容不动（幂等）。
 */

const YOUTUBE_EMBED = /youtube(?:-nocookie)?\.com\/embed\/[A-Za-z0-9_-]+/;

function unescapeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** 从一段（已反转义的）文本里取出第一个 YouTube iframe 标签，没有则返回 null。 */
function extractYoutubeIframe(text: string): string | null {
  const m = text.match(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/i);
  if (!m) return null;
  if (!YOUTUBE_EMBED.test(m[0])) return null;
  return m[0];
}

function wrapVideo(iframeTag: string): string {
  return `<div data-youtube-video>${iframeTag}</div>`;
}

/**
 * 把正文 HTML 里以转义文本形式存着的 YouTube iframe 还原成视频。
 * 覆盖三种存法：<pre><code> 代码块、<p> 段落、以及裸露的转义文本。
 */
export function repairYoutubeEmbeds(html: string): string {
  if (!html || !html.includes("&lt;iframe")) return html;

  // 1. <pre><code>&lt;iframe ...&gt;&lt;/iframe&gt;</code></pre>
  let out = html.replace(
    /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (whole, inner: string) => {
      const iframe = extractYoutubeIframe(unescapeEntities(inner));
      return iframe ? wrapVideo(iframe) : whole;
    },
  );

  // 2. <p>&lt;iframe ...&gt;&lt;/iframe&gt;</p>
  out = out.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (whole, inner: string) => {
    if (!inner.includes("&lt;iframe")) return whole;
    const iframe = extractYoutubeIframe(unescapeEntities(inner));
    return iframe ? wrapVideo(iframe) : whole;
  });

  // 3. 裸露的转义 iframe（不在 pre / p 里）
  out = out.replace(/&lt;iframe\b[\s\S]*?&lt;\/iframe&gt;/gi, (whole) => {
    const iframe = extractYoutubeIframe(unescapeEntities(whole));
    return iframe ? wrapVideo(iframe) : whole;
  });

  return out;
}

/**
 * 从摘要/描述这类纯文本里删掉 YouTube iframe 代码（显示时用，不改原文）。
 * 摘要为空字符串时调用方应直接不渲染那一段。
 */
export function stripYoutubeEmbedText(text: string): string {
  if (!text) return "";
  const plain = unescapeEntities(text);
  return plain
    // 摘要常被截断（extractExcerpt 最多 200 字），iframe 标签可能没有
    // 闭合的 > 或 </iframe>，所以从 <iframe 起删到 </iframe> 或串尾
    .replace(/<iframe\b[\s\S]*?(?:<\/iframe>|$)/gi, " ")
    .replace(/<iframe\b[^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
