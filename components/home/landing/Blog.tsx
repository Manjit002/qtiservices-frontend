import Link from 'next/link';
import { BLOG_POSTS } from './blog-content';

/**
 * Homepage blog section.
 *
 * Reuses the existing section shell (`.lp-sec`, `.lp-eyebrow`, `.lp-h2`,
 * `.lp-sub`) and the same bordered-grid card treatment as Services, so it
 * reads as part of the existing page rather than a bolted-on block.
 */
export function Blog() {
  return (
    <section className="lp-sec lp-cream" id="blog">
      <div className="lp-srv-head">
        <div>
          <div className="lp-eyebrow">Blog</div>
          <h2 className="lp-h2">Insights &amp; Updates</h2>
        </div>
        <p className="lp-sub">
          Explore insights, practical information, and updates covering technology,
          digital solutions, online learning, and educational support.
        </p>
      </div>

      <div className="lp-blog-grid">
        {BLOG_POSTS.map((post) => (
          <article className="lp-post" key={post.slug}>
            <div className="lp-post-top">
              <span className="lp-post-icon" aria-hidden>{post.icon}</span>
              <span className="lp-post-cat">{post.category}</span>
            </div>

            <h3 className="lp-post-title">
              {/* The whole card is not a link — a nested link inside a card
                  breaks keyboard navigation and screen-reader output. The
                  title carries the link, and the Read More below points at the
                  same target for anyone scanning for it. */}
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </h3>

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

      <div className="lp-blog-all">
        <Link href="/blog" className="lp-btn-outline-dark">View all articles</Link>
      </div>
    </section>
  );
}
