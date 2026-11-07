import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Link } from "next-view-transitions";
import { Container } from "@/components/layout/Container";
import { ArticleCard } from "@/components/article/ArticleCard";
import { ArticleRow } from "@/components/article/ArticleRow";
import { Sidebar } from "@/components/article/Sidebar";
import { Pagination } from "@/components/ui/Pagination";
import { JsonLd } from "@/components/seo/JsonLd";
import { listCategories, listPublishedArticles } from "@/db/repo";
import { listJsonLd } from "@/lib/seo";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 5;

type Props = {
  searchParams: Promise<{ category?: string; page?: string }>;
};

/** 不带 page 参数的基准地址（分页链接以它为准）。 */
function basePath(category?: string) {
  return category ? `/blog?category=${category}` : "/blog";
}

/** 某页的地址（第 1 页就是基准地址本身）。 */
function pageHref(category: string | undefined, page: number) {
  const base = basePath(category);
  if (page <= 1) return base;
  return `${base}${base.includes("?") ? "&" : "?"}page=${page}`;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const categories = await listCategories();
  const activeCategoryName = sp.category
    ? (categories.find((c) => c.slug === sp.category)?.name ?? sp.category)
    : null;
  const parsed = sp.page ? Number.parseInt(sp.page, 10) : 1;
  const page = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;

  const title = activeCategoryName ? `${activeCategoryName} · 博客` : "博客";
  return {
    title: page > 1 ? `${title} · 第 ${page} 页` : title,
    description: "全部文章列表 — 按时间倒序。",
    alternates: { canonical: pageHref(sp.category, page) },
  };
}

export default async function BlogPage({ searchParams }: Props) {
  const sp = await searchParams;
  const activeCategory = sp.category;

  const [allArticles, categories] = await Promise.all([
    listPublishedArticles(),
    listCategories(),
  ]);

  const activeCategoryName = activeCategory
    ? (categories.find((c) => c.slug === activeCategory)?.name ?? activeCategory)
    : null;

  const filtered = activeCategory
    ? allArticles.filter((a) => a.category.slug === activeCategory)
    : allArticles;

  // 分页：5 篇/页。?page=1、非法页码、超出范围都重定向到规范地址。
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const parsed = sp.page ? Number.parseInt(sp.page, 10) : 1;
  let page = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
  if (page > totalPages) page = totalPages;
  if (sp.page !== undefined && (parsed !== page || parsed === 1)) {
    redirect(pageHref(activeCategory, page));
  }
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const BASE = site.url.replace(/\/$/, "");
  const breadcrumb = activeCategoryName
    ? [
        { name: "首页", url: `${BASE}/` },
        { name: "博客", url: `${BASE}/blog` },
        { name: activeCategoryName, url: `${BASE}/blog?category=${activeCategory}` },
      ]
    : [
        { name: "首页", url: `${BASE}/` },
        { name: "博客", url: `${BASE}/blog` },
      ];

  const schemas = listJsonLd({
    url: pageHref(activeCategory, page),
    name: activeCategoryName ? `${activeCategoryName} · 博客` : "全部文章",
    description: activeCategoryName
      ? `「${activeCategoryName}」分类下的全部文章`
      : "按时间倒序排列的全部文章。",
    breadcrumb,
  });

  return (
    <>
      <JsonLd data={schemas} />
      <div className="divider-rule" />

      <Container className="grid items-start gap-12 py-12 lg:grid-cols-[1fr_340px] lg:gap-0 lg:py-14">
        <div className="lg:border-r lg:border-border lg:pr-14">
          <div className="mb-8 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-fg">
            <span aria-hidden className="text-fg">»</span>
            {activeCategoryName ? (
              <span>
                <Link href="/blog" className="text-fg-muted hover:text-fg">
                  分类
                </Link>
                <span className="mx-2 text-fg-subtle">:</span>
                <span>{activeCategoryName}</span>
              </span>
            ) : (
              <span>所有文章</span>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="border border-dashed border-border p-14 text-center text-fg-muted">
              {activeCategory
                ? "该分类下暂无文章。"
                : "还没有文章。登录后台开始写第一篇。"}
            </div>
          ) : (
            <>
              <section>
                <div className="border-b border-border pb-12">
                  <ArticleRow article={pageItems[0]} priority />
                </div>
                {pageItems.length > 1 && (
                  <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
                    {pageItems.slice(1).map((a) => (
                      <div key={a.slug} className="bg-bg p-6 md:p-7">
                        <ArticleCard article={a} titleSize="md" />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <Pagination
                page={page}
                totalPages={totalPages}
                basePath={basePath(activeCategory)}
              />
            </>
          )}

          {!activeCategory && categories.length > 0 && (
            <div className="mt-16 border-t border-border pt-6">
              <p className="eyebrow mb-4">浏览分类</p>
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/blog?category=${c.slug}`}
                      className="ring-focus rounded text-sm font-semibold uppercase tracking-[0.16em] text-fg-muted transition hover:text-fg"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-[88px] lg:pl-14">
          <Sidebar />
        </div>
      </Container>
    </>
  );
}
