import { defineConfig } from "vitepress";

const siteTitle = "local-llm-bench-lab";
const siteDescription =
  "Repeatable Apple Silicon local LLM benchmark scripts, reports, and lightweight result records.";
const siteOrigin = "https://sunwood-ai-labs.github.io";
const siteBase = "/local-llm-bench-lab/";
const siteUrl = new URL(siteBase, siteOrigin).toString();
const repoUrl = "https://github.com/Sunwood-ai-labs/local-llm-bench-lab";
const ogImageUrl = new URL("ogp.svg", siteUrl).toString();

const socialLinks = [{ icon: "github", link: repoUrl }];

const footer = {
  message: "Built for repeatable local LLM benchmarking.",
  copyright: "Copyright (c) 2026 Sunwood AI Labs",
};

function toPagePath(page: string): string {
  if (page === "index.md") return "/";
  if (page.endsWith("/index.md")) return `/${page.replace(/\/index\.md$/, "")}/`;
  return `/${page.replace(/\.md$/, "")}`;
}

function toAbsoluteUrl(path: string): string {
  return new URL(path.replace(/^\/+/, ""), siteUrl).toString();
}

export default defineConfig({
  title: siteTitle,
  description: siteDescription,
  base: siteBase,
  lang: "en-US",
  cleanUrls: true,
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: `${siteBase}favicon.svg` }],
    ["meta", { name: "theme-color", content: "#2f6f73" }],
  ],
  sitemap: {
    hostname: siteUrl,
  },
  transformHead({ page, title, description }) {
    const pageUrl = toAbsoluteUrl(toPagePath(page));
    const locale = page.startsWith("ja/") ? "ja_JP" : "en_US";

    return [
      ["link", { rel: "canonical", href: pageUrl }],
      ["meta", { property: "og:type", content: "website" }],
      ["meta", { property: "og:site_name", content: siteTitle }],
      ["meta", { property: "og:locale", content: locale }],
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: description }],
      ["meta", { property: "og:url", content: pageUrl }],
      ["meta", { property: "og:image", content: ogImageUrl }],
      ["meta", { property: "og:image:type", content: "image/svg+xml" }],
      ["meta", { property: "og:image:alt", content: "local-llm-bench-lab social card" }],
      ["meta", { name: "twitter:card", content: "summary_large_image" }],
      ["meta", { name: "twitter:title", content: title }],
      ["meta", { name: "twitter:description", content: description }],
      ["meta", { name: "twitter:image", content: ogImageUrl }],
    ];
  },
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      title: siteTitle,
      description: siteDescription,
      themeConfig: {
        logo: "/logo.svg",
        nav: [
          { text: "Home", link: "/" },
          { text: "Guide", link: "/guide/getting-started" },
          { text: "GitHub", link: repoUrl },
        ],
        sidebar: [
          {
            text: "Guide",
            items: [
              { text: "Getting Started", link: "/guide/getting-started" },
              { text: "Usage", link: "/guide/usage" },
              { text: "Experiment Records", link: "/guide/experiment-records" },
              { text: "Repository Name", link: "/guide/repository-name" },
              { text: "Troubleshooting", link: "/guide/troubleshooting" },
            ],
          },
        ],
        socialLinks,
        footer,
      },
    },
    ja: {
      label: "日本語",
      lang: "ja-JP",
      title: siteTitle,
      description: "Apple Silicon 上のローカル LLM ベンチマークを再現可能に記録する実験リポジトリ。",
      themeConfig: {
        logo: "/logo.svg",
        nav: [
          { text: "ホーム", link: "/ja/" },
          { text: "ガイド", link: "/ja/guide/getting-started" },
          { text: "GitHub", link: repoUrl },
        ],
        sidebar: [
          {
            text: "ガイド",
            items: [
              { text: "はじめに", link: "/ja/guide/getting-started" },
              { text: "使い方", link: "/ja/guide/usage" },
              { text: "実験記録", link: "/ja/guide/experiment-records" },
              { text: "リポジトリ名", link: "/ja/guide/repository-name" },
              { text: "トラブルシュート", link: "/ja/guide/troubleshooting" },
            ],
          },
        ],
        socialLinks,
        footer,
      },
    },
  },
  themeConfig: {
    socialLinks,
    footer,
  },
});
