import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/home/landing/SiteHeader';
import { SiteFooter } from '@/components/home/landing/SiteFooter';
import { BLOG_POSTS } from '@/components/home/landing/blog-content';
import '@/components/home/landing.css';

export const metadata: Metadata = {
  title: 'Insights & Updates | QTIServices',
  description:
    'Explore insights, practical information, and updates covering technology, digital solutions, online learning, and educational support.',
};

export default function BlogIndexPage() {
  return (
    <div className="lp">
      <SiteHeader />
      <main>
        <section className="lp-legal-hero">
          <div className="lp-eyebrow center">Blog</div>
          <h1 className="lp-legal-h1">Insights &amp; Updates</h1>
          <p className="lp-legal-sub" style={{ maxWidth: 620, margin: '0 auto' }}>
            Explore insights, practical information, and updates covering technology,
            digital solutions, online learning, and educational support.
          </p>
        </section>

        <section className="lp-sec lp-white">
          <div className="lp-blog-grid">
            {BLOG_POSTS.map((post) => (
              <article className="lp-post" key={post.slug}>
                <div className="lp-post-top">
                  <span className="lp-post-icon" aria-hidden>{post.icon}</span>
                  <span className="lp-post-cat">{post.category}</span>
                </div>
                <h2 className="lp-post-title">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                <p className="lp-post-excerpt">{post.excerpt}</p>
                <div className="lp-post-foot">
                  <Link href={`/blog/${post.slug}`} className="lp-srv-more">
                    Read More <span aria-hidden>→</span>
                    <span className="visually-hidden"> about {post.title}</span>
                  </Link>
                  <span className="lp-post-time">{post.readingMinutes} min read</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
