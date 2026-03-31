import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('SEO Improvements', () => {
  const indexHtml = readFileSync(resolve(__dirname, '../client/index.html'), 'utf-8');

  describe('Canonical URL', () => {
    it('has a canonical link tag pointing to herobase.io', () => {
      expect(indexHtml).toContain('<link rel="canonical" href="https://www.herobase.io/"');
    });

    it('has robots meta tag allowing indexing', () => {
      expect(indexHtml).toContain('<meta name="robots" content="index, follow"');
    });
  });

  describe('JSON-LD Structured Data', () => {
    it('contains a JSON-LD script tag', () => {
      expect(indexHtml).toContain('<script type="application/ld+json">');
    });

    it('has WebApplication schema type', () => {
      const jsonLdMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(jsonLdMatch).toBeTruthy();
      const jsonLd = JSON.parse(jsonLdMatch![1]);
      expect(jsonLd['@type']).toBe('WebApplication');
    });

    it('has correct application name', () => {
      const jsonLdMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      const jsonLd = JSON.parse(jsonLdMatch![1]);
      expect(jsonLd.name).toBe('HERO Dapp');
    });

    it('has correct URL', () => {
      const jsonLdMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      const jsonLd = JSON.parse(jsonLdMatch![1]);
      expect(jsonLd.url).toBe('https://www.herobase.io');
    });

    it('has FinanceApplication category', () => {
      const jsonLdMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      const jsonLd = JSON.parse(jsonLdMatch![1]);
      expect(jsonLd.applicationCategory).toBe('FinanceApplication');
    });

    it('has VIC Foundation as creator', () => {
      const jsonLdMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      const jsonLd = JSON.parse(jsonLdMatch![1]);
      expect(jsonLd.creator.name).toBe('VIC Foundation');
      expect(jsonLd.creator['@type']).toBe('Organization');
    });

    it('lists key features', () => {
      const jsonLdMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      const jsonLd = JSON.parse(jsonLdMatch![1]);
      expect(jsonLd.featureList).toContain('Multi-DEX swap aggregator');
      expect(jsonLd.featureList).toContain('DAO governance');
      expect(jsonLd.featureList).toContain('NFT military rank collection');
    });

    it('has social links (Telegram and Twitter)', () => {
      const jsonLdMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      const jsonLd = JSON.parse(jsonLdMatch![1]);
      expect(jsonLd.sameAs).toContain('https://t.me/VetsInCrypto');
      expect(jsonLd.sameAs).toContain('https://twitter.com/HERO501c3');
    });

    it('offers free pricing', () => {
      const jsonLdMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      const jsonLd = JSON.parse(jsonLdMatch![1]);
      expect(jsonLd.offers.price).toBe('0');
      expect(jsonLd.offers.priceCurrency).toBe('USD');
    });
  });

  describe('Sitemap', () => {
    const sitemapXml = readFileSync(resolve(__dirname, '../client/public/sitemap.xml'), 'utf-8');

    it('is valid XML with urlset root', () => {
      expect(sitemapXml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemapXml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    });

    it('includes the landing page with highest priority', () => {
      expect(sitemapXml).toContain('<loc>https://www.herobase.io/</loc>');
      expect(sitemapXml).toContain('<priority>1.0</priority>');
    });

    it('includes all core DeFi pages', () => {
      const corePages = ['/swap', '/dashboard', '/farm', '/tokenomics', '/portfolio', '/dca', '/limits'];
      for (const page of corePages) {
        expect(sitemapXml).toContain(`<loc>https://www.herobase.io${page}</loc>`);
      }
    });

    it('includes NFT and community pages', () => {
      expect(sitemapXml).toContain('<loc>https://www.herobase.io/nft</loc>');
      expect(sitemapXml).toContain('<loc>https://www.herobase.io/media</loc>');
      expect(sitemapXml).toContain('<loc>https://www.herobase.io/blog</loc>');
    });

    it('includes DAO governance pages', () => {
      const daoPages = ['/dao', '/dao/proposals', '/dao/treasury', '/dao/delegates'];
      for (const page of daoPages) {
        expect(sitemapXml).toContain(`<loc>https://www.herobase.io${page}</loc>`);
      }
    });

    it('includes ecosystem and AI pages', () => {
      expect(sitemapXml).toContain('<loc>https://www.herobase.io/ecosystem</loc>');
      expect(sitemapXml).toContain('<loc>https://www.herobase.io/ai</loc>');
    });

    it('has 18 total URLs', () => {
      const urlCount = (sitemapXml.match(/<url>/g) || []).length;
      expect(urlCount).toBe(18);
    });
  });

  describe('Robots.txt', () => {
    const robotsTxt = readFileSync(resolve(__dirname, '../client/public/robots.txt'), 'utf-8');

    it('allows all crawlers', () => {
      expect(robotsTxt).toContain('User-agent: *');
      expect(robotsTxt).toContain('Allow: /');
    });

    it('blocks API routes from crawling', () => {
      expect(robotsTxt).toContain('Disallow: /api/');
    });

    it('references the sitemap', () => {
      expect(robotsTxt).toContain('Sitemap: https://www.herobase.io/sitemap.xml');
    });
  });

  describe('Existing SEO Tags', () => {
    it('has meta description', () => {
      expect(indexHtml).toContain('<meta name="description"');
    });

    it('has focused keywords (6 or fewer)', () => {
      const keywordsMatch = indexHtml.match(/name="keywords" content="([^"]+)"/);
      expect(keywordsMatch).toBeTruthy();
      const keywords = keywordsMatch![1].split(',').map(k => k.trim());
      expect(keywords.length).toBeLessThanOrEqual(6);
    });

    it('has Open Graph tags', () => {
      expect(indexHtml).toContain('property="og:type"');
      expect(indexHtml).toContain('property="og:title"');
      expect(indexHtml).toContain('property="og:description"');
      expect(indexHtml).toContain('property="og:image"');
    });

    it('has Twitter Card tags', () => {
      expect(indexHtml).toContain('name="twitter:card"');
      expect(indexHtml).toContain('name="twitter:site"');
    });
  });
});
