import { cn, formatDate } from "@/lib/utils";
import type { Article } from "@/data/types";

export function ArticleMeta({
  article,
  className,
  inverted = false,
}: {
  article: Article;
  className?: string;
  inverted?: boolean;
}) {
  return (
    <p
      className={cn(
        "text-[12px] font-medium uppercase tracking-[0.14em]",
        inverted ? "text-white/70" : "text-fg-subtle",
        className,
      )}
    >
      <time dateTime={article.publishedAt} className="normal-case tracking-normal">
        {formatDate(article.publishedAt)}
      </time>
    </p>
  );
}
