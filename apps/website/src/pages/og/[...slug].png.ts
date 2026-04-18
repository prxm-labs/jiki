import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { renderOGPng } from "../../lib/og/render.ts";
import type { OGKind } from "../../lib/og/template.tsx";

export const prerender = true;

interface OGRouteProps {
  title: string;
  description?: string;
  eyebrow?: string;
  route?: string;
  kind: OGKind;
}

const SECTION_LABELS: Record<string, string> = {
  "getting-started": "Getting Started",
  "core-concepts": "Core Concepts",
  ai: "AI",
  api: "API Reference",
  ui: "UI Components",
  guides: "Guides",
};

const CATEGORY_LABELS: Record<string, string> = {
  agentic: "Agentic",
  frameworks: "Frameworks",
  servers: "Servers",
  testing: "Testing",
  tools: "Tools",
  runtime: "Runtime",
};

export const getStaticPaths: GetStaticPaths = async () => {
  const [docs, examples, changelog, roadmap] = await Promise.all([
    getCollection("docs", entry => !entry.data.draft),
    getCollection("examples"),
    getCollection("changelog"),
    getCollection("roadmap"),
  ]);

  const paths: { params: { slug: string }; props: OGRouteProps }[] = [];

  paths.push({
    params: { slug: "index" },
    props: {
      title: "Run Node.js in the browser",
      description:
        "jiki is a lightweight browser-based Node.js runtime with a virtual filesystem, npm/pnpm support, shell, and dev servers for building coding playgrounds and AI-powered tools.",
      eyebrow: "jiki",
      route: "jiki.sh",
      kind: "home",
    },
  });

  paths.push({
    params: { slug: "default" },
    props: {
      title: "Run Node.js in the browser",
      description:
        "A lightweight browser-based Node.js runtime for playgrounds and AI tools.",
      eyebrow: "jiki",
      route: "jiki.sh",
      kind: "page",
    },
  });

  for (const entry of docs) {
    const sectionKey = entry.data.section;
    const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey;
    paths.push({
      params: { slug: `docs/${entry.id}` },
      props: {
        title: entry.data.title,
        description: entry.data.description,
        eyebrow: `Docs · ${sectionLabel}`,
        route: `/docs/${entry.id}`,
        kind: "docs",
      },
    });
  }

  paths.push({
    params: { slug: "docs/index" },
    props: {
      title: "Documentation",
      description:
        "Guides, API reference, and concepts for building with jiki.",
      eyebrow: "Docs",
      route: "/docs",
      kind: "docs",
    },
  });

  for (const entry of examples) {
    const cat = CATEGORY_LABELS[entry.data.category] ?? entry.data.category;
    paths.push({
      params: { slug: `examples/${entry.id}` },
      props: {
        title: entry.data.title,
        description: entry.data.description,
        eyebrow: `Example · ${cat}`,
        route: `/examples/${entry.id}`,
        kind: "example",
      },
    });
  }

  paths.push({
    params: { slug: "examples/index" },
    props: {
      title: "The browser goes vroom",
      description: `Browse ${examples.length} examples showing jiki in action — frameworks, servers, testing, and more.`,
      eyebrow: "Examples",
      route: "/examples",
      kind: "example",
    },
  });

  paths.push({
    params: { slug: "changelog/index" },
    props: {
      title: "What's new",
      description: `Version history and release notes — ${changelog.length} releases and counting.`,
      eyebrow: "Changelog",
      route: "/changelog",
      kind: "changelog",
    },
  });

  paths.push({
    params: { slug: "roadmap/index" },
    props: {
      title: "What we're building",
      description: `A look at what's in progress, planned next, and shipped — ${roadmap.length} items tracked.`,
      eyebrow: "Roadmap",
      route: "/roadmap",
      kind: "roadmap",
    },
  });

  return paths;
};

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOGPng(props as unknown as OGRouteProps);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
