import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const docs = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    section: z.string(),
    order: z.number(),
    draft: z.boolean().optional(),
  }),
});

const changelog = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/changelog" }),
  schema: z.object({
    version: z.string(),
    date: z.coerce.date(),
    highlights: z.array(z.string()).optional(),
  }),
});

const examples = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/examples" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum([
      "agentic",
      "frameworks",
      "servers",
      "testing",
      "tools",
      "runtime",
    ]),
    features: z.array(z.string()).optional(),
  }),
});

const roadmap = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/roadmap" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(["planned", "in-progress", "done"]),
    priority: z.enum(["high", "medium", "low"]),
    order: z.number(),
    touchedAreas: z.array(z.string()).optional().default([]),
    internalNotes: z.string().optional().default(""),
  }),
});

export const collections = { docs, changelog, examples, roadmap };
