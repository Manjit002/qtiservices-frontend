import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/home/landing/SiteHeader';
import { SiteFooter } from '@/components/home/landing/SiteFooter';
import { BLOG_POSTS, getPost } from '@/components/home/landing/blog-content';
import '@/components/home/landing.css';

interface Props {
  params: Promise<{ slug: string }>;
}

/** Pre-renders every article at build time — the set is known and static. */
export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: 'Article not found | QTIServices' };
  return {
    title: `${post.title} | QTIServices`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  // A slug that does not exist gets the real 404 rather than an empty shell.
  if (!post) notFound();

  const others = BLOG_POSTS.filter((p) => p.slug !== post.slug);

  return (
    <div className="lp">
      <SiteHeader />
      <main>
        <section className="lp-legal-hero">
          <div className="lp-eyebrow center">{post.category}</div>
          <h1 className="lp-legal-h1">{post.title}</h1>
          <p className="lp-legal-updated">{post.readingMinutes} min read</p>
        </section>

        <section className="lp-sec lp-white">
          <div className="lp-legal lp-article">
            <p className="lp-article-lede">{post.excerpt}</p>

            {post.sections.map((sec, i) => (
              <section key={sec.heading ?? i}>
                {sec.heading && <h2>{sec.heading}</h2>}
                {sec.body.map((para) => <p key={para.slice(0, 32)}>{para}</p>)}
                {sec.bullets && (
                  <ul>
                    {sec.bullets.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                )}
              </section>
            ))}

            <div className="lp-article-author">
              Written by the <strong>QTIServices Team</strong>
            </div>

            {others.length > 0 && (
              <div className="lp-article-more">
                <h2>More from the blog</h2>
                <ul className="lp-article-more-list">
                  {others.map((p) => (
                    <li key={p.slug}>
                      <Link href={`/blog/${p.slug}`}>
                        <span className="lp-post-cat">{p.category}</span>
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="lp-legal-related">
              <Link href="/blog">← All articles</Link>
              <Link href="/#services">Our Services</Link>
              <Link href="/#cta">Contact Us</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
