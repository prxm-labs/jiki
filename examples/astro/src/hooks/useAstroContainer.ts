import { useState, useCallback, useRef, useEffect } from "react";
import {
  boot,
  type Container,
  bundlePackageForBrowser,
  generateRequireScript,
  scanBareImports,
  extractPackageName,
  preprocessImports,
} from "jiki";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { TerminalLine, FileEntry } from 'jiki-ui';
export type { TerminalLine, FileEntry };


interface Frontmatter {
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Virtual project files -- an Astro blog site with layouts, components,
// file-based routing, markdown blog posts, and tag navigation
// ---------------------------------------------------------------------------

const VIRTUAL_FILES: Record<string, string> = {
  "/package.json": `{
  "name": "my-astro-site",
  "type": "module",
  "version": "0.0.1",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/react": "^4.0.0",
    "@astrojs/vue": "^5.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "vue": "^3.5.0"
  }
}`,

  "/astro.config.mjs": `import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vue from "@astrojs/vue";

export default defineConfig({
  site: "https://my-astro-site.example.com",
  integrations: [react(), vue()],
});`,

  "/public/robots.txt": `User-agent: *
Allow: /`,

  // ---- Layouts ----

  "/src/layouts/BaseLayout.astro": `---
const { pageTitle } = Astro.props;
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{pageTitle}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="bg-white text-black">
  <Navbar />
  <main>
    <slot />
  </main>
  <Footer />
</body>
</html>`,

  "/src/layouts/MarkdownPostLayout.astro": `---
const { frontmatter } = Astro.props;
---
<BaseLayout pageTitle={frontmatter.title}>
  <article style="max-width: 720px; margin: 0 auto; padding: 3rem 1.5rem;">
    <header style="margin-bottom: 2rem;">
      <p style="font-size: 0.85rem; color: #888; margin-bottom: 0.5rem;">
        {frontmatter.pubDate} &middot; by {frontmatter.author}
      </p>
      <h1 style="font-size: 2.25rem; font-weight: 800; line-height: 1.2; color: #1a1a2e;">
        {frontmatter.title}
      </h1>
      <p style="font-size: 1.1rem; color: #555; margin-top: 0.75rem; line-height: 1.6;">
        {frontmatter.description}
      </p>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem;">
        {frontmatter.tags.map(tag =>
          <a href="/tags/{tag}" style="font-size: 0.8rem; padding: 0.25rem 0.75rem; border-radius: 9999px; background: #fff4ee; color: #e05d26; border: 1px solid #fdd8c4;">{tag}</a>
        )}
      </div>
    </header>
    <div class="prose">
      <slot />
    </div>
  </article>
  <style>
    .prose { line-height: 1.8; color: #333; font-size: 1.05rem; }
    .prose h2 { font-size: 1.5rem; font-weight: 700; margin: 2rem 0 0.75rem; color: #1a1a2e; }
    .prose h3 { font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 0.5rem; color: #1a1a2e; }
    .prose p { margin-bottom: 1rem; }
    .prose ul, .prose ol { margin: 0.5rem 0 1rem 1.5rem; }
    .prose li { margin-bottom: 0.35rem; }
    .prose code { background: #f0f0f0; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
    .prose pre { background: #1a1a2e; color: #e0e0e0; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 1rem 0; }
    .prose pre code { background: none; padding: 0; color: inherit; }
    .prose blockquote { border-left: 3px solid #e05d26; padding-left: 1rem; color: #555; margin: 1rem 0; font-style: italic; }
    .prose strong { font-weight: 600; }
  </style>
</BaseLayout>`,

  // ---- Components ----

  "/src/components/Navbar.astro": `---
---
<nav class="border-b border-black/10 sticky top-0 z-50 bg-white">
  <div class="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
    <a href="/" class="text-sm font-bold tracking-tight no-underline text-black"><span style="color:#e05d26;">a</span>stro.</a>
    <div style="display:flex;gap:20px;align-items:center;">
      <a href="/" class="text-sm text-black/40 hover:text-black no-underline">Home</a>
      <a href="/about" class="text-sm text-black/40 hover:text-black no-underline">About</a>
      <a href="/blog" class="text-sm text-black/40 hover:text-black no-underline">Blog</a>
      <a href="/islands" class="text-sm text-black/40 hover:text-black no-underline">Islands</a>
    </div>
  </div>
</nav>`,

  "/src/components/Footer.astro": `---
---
<footer class="border-t border-black/10 mt-auto">
  <div class="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
    <span class="text-xs font-bold tracking-tight"><span style="color:#e05d26;">a</span>stro.</span>
    <span class="text-xs text-black/30">Astro 5 &middot; React + Vue Islands &middot; jiki</span>
  </div>
</footer>`,

  "/src/components/BlogCard.astro": `---
const { url, title, description, pubDate, tags } = Astro.props;
---
<a href="{url}" style="display: block; padding: 1.5rem; background: white; border-radius: 12px; border: 1px solid #eee; text-decoration: none; transition: all 0.2s;" onmouseover="this.style.borderColor='#fbb87a';this.style.boxShadow='0 4px 20px rgba(224,93,38,0.08)'" onmouseout="this.style.borderColor='#eee';this.style.boxShadow='none'">
  <p style="font-size: 0.8rem; color: #999; margin-bottom: 0.5rem;">{pubDate}</p>
  <h3 style="font-size: 1.15rem; font-weight: 600; color: #1a1a2e; margin-bottom: 0.5rem;">{title}</h3>
  <p style="font-size: 0.9rem; color: #666; line-height: 1.5; margin-bottom: 0.75rem;">{description}</p>
  <div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">
    {tags.map(tag =>
      <span style="font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 9999px; background: #fff4ee; color: #e05d26;">{tag}</span>
    )}
  </div>
</a>`,

  // ---- Interactive island components (React + Vue) ----

  "/src/components/Counter.tsx": `import { useState } from 'react';

export default function Counter({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', background: 'white', borderRadius: '12px', border: '1px solid #eee', width: 'fit-content' }}>
      <button
        onClick={() => setCount(c => c - 1)}
        style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
      >−</button>
      <span style={{ fontSize: '1.5rem', fontWeight: '700', minWidth: '3rem', textAlign: 'center', color: '#1a1a2e', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      <button
        onClick={() => setCount(c => c + 1)}
        style={{ width: '36px', height: '36px', borderRadius: '8px', border: 'none', background: '#e05d26', color: 'white', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
      >+</button>
    </div>
  );
}`,

  "/src/components/Greeting.tsx": `import { useState } from 'react';

export default function Greeting() {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #fff4ee, #fff8f0)', borderRadius: '12px', border: '1px solid #fdd8c4', textAlign: 'center' }}>
        <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👋</p>
        <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1a1a2e', marginBottom: '0.25rem' }}>Hello, {name}!</p>
        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1rem' }}>This greeting was rendered by a React island.</p>
        <button
          onClick={() => { setSubmitted(false); setName(''); }}
          style={{ padding: '0.4rem 1rem', background: 'white', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#555' }}
        >Reset</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setSubmitted(true); }}
        placeholder="Enter your name"
        style={{ flex: 1, padding: '0.6rem 0.75rem', border: '1px solid #ddd', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
      />
      <button
        onClick={() => name.trim() && setSubmitted(true)}
        disabled={!name.trim()}
        style={{ padding: '0.6rem 1.25rem', background: name.trim() ? '#e05d26' : '#ccc', color: 'white', border: 'none', borderRadius: '8px', cursor: name.trim() ? 'pointer' : 'not-allowed', fontSize: '0.9rem', fontWeight: '600', whiteSpace: 'nowrap' }}
      >Say Hello</button>
    </div>
  );
}`,

  "/src/components/TodoList.vue": `<template>
  <div style="background: white; border-radius: 12px; border: 1px solid #eee; overflow: hidden;">
    <div style="display: flex; gap: 0.5rem; padding: 0.75rem; border-bottom: 1px solid #eee; background: #fafafa;">
      <input
        v-model="newTodo"
        @keyup.enter="addTodo"
        placeholder="Add a todo..."
        style="flex: 1; padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; outline: none;"
      />
      <button
        @click="addTodo"
        :disabled="!newTodo.trim()"
        :style="{ padding: '0.5rem 1rem', background: newTodo.trim() ? '#e05d26' : '#ccc', color: 'white', border: 'none', borderRadius: '8px', cursor: newTodo.trim() ? 'pointer' : 'not-allowed', fontSize: '0.85rem', fontWeight: '600' }"
      >Add</button>
    </div>
    <ul style="list-style: none; padding: 0; margin: 0;">
      <li
        v-for="(todo, i) in todos"
        :key="i"
        style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; border-bottom: 1px solid #f0f0f0;"
      >
        <input
          type="checkbox"
          :checked="todo.done"
          @change="todo.done = !todo.done"
          style="width: 18px; height: 18px; accent-color: #e05d26; cursor: pointer;"
        />
        <span :style="{ flex: 1, fontSize: '0.9rem', color: todo.done ? '#aaa' : '#333', textDecoration: todo.done ? 'line-through' : 'none', transition: 'all 0.2s' }">
          {{ todo.text }}
        </span>
        <button
          @click="removeTodo(i)"
          style="width: 24px; height: 24px; border: none; background: transparent; cursor: pointer; color: #ccc; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; border-radius: 4px;"
          @mouseover="$event.target.style.color='#e05d26';$event.target.style.background='#fff4ee'"
          @mouseout="$event.target.style.color='#ccc';$event.target.style.background='transparent'"
        >&times;</button>
      </li>
    </ul>
    <div v-if="todos.length" style="padding: 0.5rem 0.75rem; font-size: 0.8rem; color: #999; background: #fafafa; display: flex; justify-content: space-between; align-items: center;">
      <span>{{ remaining }} of {{ todos.length }} remaining</span>
      <button
        v-if="todos.length - remaining > 0"
        @click="clearDone"
        style="border: none; background: none; color: #e05d26; cursor: pointer; font-size: 0.8rem;"
      >Clear done</button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      newTodo: '',
      todos: [
        { text: 'Learn Astro basics', done: true },
        { text: 'Try component islands', done: false },
        { text: 'Mix React and Vue', done: false },
        { text: 'Deploy to production', done: false },
      ]
    };
  },
  computed: {
    remaining() { return this.todos.filter(t => !t.done).length; }
  },
  methods: {
    addTodo() {
      if (this.newTodo.trim()) {
        this.todos.push({ text: this.newTodo.trim(), done: false });
        this.newTodo = '';
      }
    },
    removeTodo(i) { this.todos.splice(i, 1); },
    clearDone() { this.todos = this.todos.filter(t => !t.done); }
  }
};
<\/script>`,

  "/src/components/ThemePicker.vue": `<template>
  <div style="background: white; border-radius: 12px; border: 1px solid #eee; padding: 1.25rem;">
    <p style="font-size: 0.85rem; font-weight: 600; color: #555; margin-bottom: 0.75rem;">Pick a theme color:</p>
    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
      <button
        v-for="c in colors"
        :key="c.name"
        @click="selected = c"
        :style="{
          width: '40px', height: '40px', borderRadius: '50%',
          background: c.value, cursor: 'pointer',
          border: selected.name === c.name ? '3px solid #1a1a2e' : '3px solid transparent',
          transition: 'all 0.2s',
          transform: selected.name === c.name ? 'scale(1.15)' : 'scale(1)'
        }"
        :title="c.name"
      ></button>
    </div>
    <div :style="{
      background: selected.gradient,
      padding: '1rem', borderRadius: '8px', color: 'white',
      transition: 'background 0.3s'
    }">
      <p style="font-weight: 600; margin-bottom: 0.25rem;">{{ selected.name }}</p>
      <p style="font-size: 0.85rem; opacity: 0.9;">{{ selected.desc }}</p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      selected: null,
      colors: [
        { name: 'Sunset', value: '#e05d26', gradient: 'linear-gradient(135deg, #e05d26, #f0933a)', desc: 'Warm and energetic, like Astro\\'s own brand.' },
        { name: 'Ocean', value: '#2563eb', gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)', desc: 'Cool and professional, great for corporate sites.' },
        { name: 'Forest', value: '#16a34a', gradient: 'linear-gradient(135deg, #16a34a, #22c55e)', desc: 'Natural and fresh, perfect for eco-friendly themes.' },
        { name: 'Berry', value: '#9333ea', gradient: 'linear-gradient(135deg, #9333ea, #a855f7)', desc: 'Bold and creative, ideal for portfolios.' },
        { name: 'Slate', value: '#475569', gradient: 'linear-gradient(135deg, #334155, #475569)', desc: 'Minimal and elegant, timeless design.' },
      ]
    };
  },
  created() {
    this.selected = this.colors[0];
  }
};
<\/script>`,

  // ---- Pages ----

  "/src/pages/index.astro": `---
layout: ../layouts/BaseLayout.astro
pageTitle: Home
---
<section class="max-w-2xl mx-auto px-6 pt-16 pb-12">
  <p class="text-xs font-medium uppercase tracking-widest" style="color:rgba(0,0,0,0.4);margin-bottom:8px;">Astro 5</p>
  <h1 class="text-5xl font-black leading-tight tracking-tight" style="margin-bottom:16px;">
    Static HTML.<br/><span style="color:#e05d26;">Zero JavaScript.</span>
  </h1>
  <p class="text-base leading-relaxed" style="color:rgba(0,0,0,0.5);max-width:28rem;margin-bottom:2.5rem;">
    A statically-generated site with layouts, markdown posts, React + Vue islands, and file-based routing &mdash; all inside jiki.
  </p>
  <div style="display:flex;gap:12px;">
    <a href="/blog" style="padding:8px 16px;background:black;color:white;font-size:14px;font-weight:700;text-decoration:none;">Read blog</a>
    <a href="/islands" style="padding:8px 16px;border:2px solid black;font-size:14px;font-weight:700;text-decoration:none;color:black;">Islands demo</a>
  </div>
</section>

<section style="border-top:1px solid rgba(0,0,0,0.1);">
  <div class="max-w-2xl mx-auto px-6" style="padding-top:2.5rem;padding-bottom:2.5rem;">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2rem;">
      <div>
        <h3 style="font-size:14px;font-weight:700;margin-bottom:4px;">Static</h3>
        <p style="font-size:12px;color:rgba(0,0,0,0.4);line-height:1.6;">Pages render to HTML. No JS shipped unless you opt in.</p>
      </div>
      <div>
        <h3 style="font-size:14px;font-weight:700;margin-bottom:4px;">Islands</h3>
        <p style="font-size:12px;color:rgba(0,0,0,0.4);line-height:1.6;">Hydrate only interactive parts. Static content stays pure HTML.</p>
      </div>
      <div>
        <h3 style="font-size:14px;font-weight:700;margin-bottom:4px;">Markdown</h3>
        <p style="font-size:12px;color:rgba(0,0,0,0.4);line-height:1.6;">First-class .md support with frontmatter and layouts.</p>
      </div>
      <div>
        <h3 style="font-size:14px;font-weight:700;margin-bottom:4px;">Routing</h3>
        <p style="font-size:12px;color:rgba(0,0,0,0.4);line-height:1.6;">Files in src/pages/ become routes automatically.</p>
      </div>
      <div>
        <h3 style="font-size:14px;font-weight:700;margin-bottom:4px;">Scoped CSS</h3>
        <p style="font-size:12px;color:rgba(0,0,0,0.4);line-height:1.6;">Write styles in components with automatic scoping.</p>
      </div>
      <div>
        <h3 style="font-size:14px;font-weight:700;margin-bottom:4px;">Multi-framework</h3>
        <p style="font-size:12px;color:rgba(0,0,0,0.4);line-height:1.6;">Use React, Vue, or Svelte components together.</p>
      </div>
    </div>
  </div>
</section>`,

  "/src/pages/about.astro": `---
layout: ../layouts/BaseLayout.astro
pageTitle: About
---
<div class="max-w-2xl mx-auto px-6" style="padding-top:4rem;padding-bottom:5rem;">
  <p style="font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;color:rgba(0,0,0,0.4);margin-bottom:8px;">About</p>
  <h1 style="font-size:2.25rem;font-weight:900;line-height:1.1;letter-spacing:-0.02em;margin-bottom:16px;">How it works.</h1>
  <p style="font-size:16px;color:rgba(0,0,0,0.5);line-height:1.7;max-width:28rem;margin-bottom:3rem;">
    Astro running inside jiki. The entire project lives in a virtual filesystem and pages render to static HTML.
  </p>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
    <div style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: #f8f8f8; border-radius: 8px; border: 1px solid #eee;">
      <div style="width: 8px; height: 8px; border-radius: 50%; background: #e05d26;"></div>
      <div>
        <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #999;">Framework</div>
        <div style="font-size: 0.9rem; font-weight: 500; color: #333;">Astro 5</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Stack</h2>
      <div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.05);padding-bottom:12px;">
        <span style="font-size:14px;font-weight:700;">Static HTML</span>
        <span style="font-size:12px;color:rgba(0,0,0,0.3);font-family:monospace;">Output</span>
      </div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.05);padding-bottom:12px;">
        <span style="font-size:14px;font-weight:700;">Zero by default</span>
        <span style="font-size:12px;color:rgba(0,0,0,0.3);font-family:monospace;">Client JS</span>
      </div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;">
        <span style="font-size:14px;font-weight:700;">In-memory MemFS</span>
        <span style="font-size:12px;color:rgba(0,0,0,0.3);font-family:monospace;">Filesystem</span>
      </div>
    </div>

    <div style="border-top:1px solid rgba(0,0,0,0.1);padding-top:24px;margin-top:24px;">
      <h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">Pipeline</h2>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;gap:12px;"><span style="font-size:12px;font-weight:900;color:#e05d26;margin-top:2px;">01</span><div><span style="font-size:14px;font-weight:700;">Boot container.</span> <span style="font-size:14px;color:rgba(0,0,0,0.4);">Initialize jiki with boot()</span></div></div>
        <div style="display:flex;gap:12px;"><span style="font-size:12px;font-weight:900;color:#e05d26;margin-top:2px;">02</span><div><span style="font-size:14px;font-weight:700;">Write files.</span> <span style="font-size:14px;color:rgba(0,0,0,0.4);">.astro and .md files stored in virtual FS</span></div></div>
        <div style="display:flex;gap:12px;"><span style="font-size:12px;font-weight:900;color:#e05d26;margin-top:2px;">03</span><div><span style="font-size:14px;font-weight:700;">Parse.</span> <span style="font-size:14px;color:rgba(0,0,0,0.4);">Frontmatter extracted, layouts and components resolved</span></div></div>
        <div style="display:flex;gap:12px;"><span style="font-size:12px;font-weight:900;color:#e05d26;margin-top:2px;">04</span><div><span style="font-size:14px;font-weight:700;">Assemble.</span> <span style="font-size:14px;color:rgba(0,0,0,0.4);">Pages built into static HTML documents</span></div></div>
        <div style="display:flex;gap:12px;"><span style="font-size:12px;font-weight:900;color:#e05d26;margin-top:2px;">05</span><div><span style="font-size:14px;font-weight:700;">Render.</span> <span style="font-size:14px;color:rgba(0,0,0,0.4);">Sandboxed iframe displays the result</span></div></div>
      </div>
    </div>
  </div>
</div>`,

  "/src/pages/blog.astro": `---
layout: ../layouts/BaseLayout.astro
pageTitle: Blog
---
<div class="max-w-2xl mx-auto px-6" style="padding-top:4rem;padding-bottom:5rem;">
  <p style="font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;color:rgba(0,0,0,0.4);margin-bottom:8px;">Blog</p>
  <h1 style="font-size:2.25rem;font-weight:900;letter-spacing:-0.02em;margin-bottom:8px;">Posts.</h1>
  <p style="font-size:14px;color:rgba(0,0,0,0.4);margin-bottom:2rem;">Astro, web development, and the future of the web.</p>
  <div style="display:flex;flex-direction:column;">
    <!-- BLOG_CARDS_PLACEHOLDER -->
  </div>
</div>`,

  "/src/pages/islands.astro": `---
layout: ../layouts/BaseLayout.astro
pageTitle: Islands Demo
---
<div class="max-w-2xl mx-auto px-6" style="padding-top:4rem;padding-bottom:5rem;">
  <p style="font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;color:rgba(0,0,0,0.4);margin-bottom:8px;">Islands</p>
  <h1 style="font-size:2.25rem;font-weight:900;letter-spacing:-0.02em;margin-bottom:8px;">Multi-framework.</h1>
  <p style="font-size:16px;color:rgba(0,0,0,0.5);line-height:1.7;max-width:28rem;margin-bottom:2.5rem;">
    React and Vue components coexist as interactive islands in static HTML. Each hydrates independently via <code style="font-size:13px;background:rgba(0,0,0,0.05);padding:1px 6px;">client:</code> directives.
  </p>


  <!-- React Islands -->
  <div style="margin-bottom: 3rem;">
    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem;">
      <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; background: #e8f8ff; font-size: 0.85rem;">⚛️</span>
      <h2 style="font-size: 1.25rem; font-weight: 700; color: #1a1a2e;">React Islands</h2>
      <span style="font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 9999px; background: #e8f8ff; color: #0284c7; font-weight: 600;">client:load</span>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
      <div>
        <h3 style="font-size: 0.95rem; font-weight: 600; color: #333; margin-bottom: 0.5rem;">Counter</h3>
        <p style="font-size: 0.85rem; color: #888; margin-bottom: 0.75rem;">A stateful counter using <code style="background:#f0f0f0;padding:0.1rem 0.3rem;border-radius:4px;font-size:0.85em;">useState</code>. Hydrated immediately on page load.</p>
        <Counter client:load />
      </div>
      <div>
        <h3 style="font-size: 0.95rem; font-weight: 600; color: #333; margin-bottom: 0.5rem;">Greeting</h3>
        <p style="font-size: 0.85rem; color: #888; margin-bottom: 0.75rem;">An interactive form with conditional rendering. Type your name and click the button.</p>
        <Greeting client:load />
      </div>
    </div>

    <div style="margin-top: 1rem; padding: 0.75rem 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
      <p style="font-size: 0.8rem; color: #64748b; font-family: monospace;">
        &lt;Counter <span style="color: #0284c7;">client:load</span> /&gt; &mdash; React component, hydrated immediately
      </p>
    </div>
  </div>

  <!-- Vue Islands -->
  <div style="margin-bottom: 3rem;">
    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem;">
      <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; background: #ecfdf5; font-size: 0.85rem;">🌿</span>
      <h2 style="font-size: 1.25rem; font-weight: 700; color: #1a1a2e;">Vue Islands</h2>
      <span style="font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 9999px; background: #ecfdf5; color: #059669; font-weight: 600;">client:visible</span>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
      <div>
        <h3 style="font-size: 0.95rem; font-weight: 600; color: #333; margin-bottom: 0.5rem;">Todo List</h3>
        <p style="font-size: 0.85rem; color: #888; margin-bottom: 0.75rem;">Reactive data binding with computed properties. Hydrated when scrolled into view.</p>
        <TodoList client:visible />
      </div>
      <div>
        <h3 style="font-size: 0.95rem; font-weight: 600; color: #333; margin-bottom: 0.5rem;">Theme Picker</h3>
        <p style="font-size: 0.85rem; color: #888; margin-bottom: 0.75rem;">Dynamic style bindings and transitions. A Vue component in an Astro page.</p>
        <ThemePicker client:visible />
      </div>
    </div>

    <div style="margin-top: 1rem; padding: 0.75rem 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
      <p style="font-size: 0.8rem; color: #64748b; font-family: monospace;">
        &lt;TodoList <span style="color: #059669;">client:visible</span> /&gt; &mdash; Vue component, hydrated when scrolled into view
      </p>
    </div>
  </div>

  <!-- How Islands Work -->
  <div style="padding: 1.5rem; background: linear-gradient(135deg, #fff4ee, #ecfdf5); border-radius: 12px; border: 1px solid #e5e7eb;">
    <h2 style="font-weight: 700; color: #1a1a2e; margin-bottom: 0.75rem; font-size: 1.1rem;">How Islands Work</h2>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
      <div style="padding: 1rem; background: white; border-radius: 8px;">
        <code style="font-size: 0.8rem; color: #e05d26; font-weight: 600;">client:load</code>
        <p style="font-size: 0.8rem; color: #666; margin-top: 0.35rem;">Hydrate immediately when the page loads. Best for above-the-fold interactive content.</p>
      </div>
      <div style="padding: 1rem; background: white; border-radius: 8px;">
        <code style="font-size: 0.8rem; color: #e05d26; font-weight: 600;">client:visible</code>
        <p style="font-size: 0.8rem; color: #666; margin-top: 0.35rem;">Hydrate when the component scrolls into view. Great for below-the-fold content.</p>
      </div>
      <div style="padding: 1rem; background: white; border-radius: 8px;">
        <code style="font-size: 0.8rem; color: #e05d26; font-weight: 600;">client:idle</code>
        <p style="font-size: 0.8rem; color: #666; margin-top: 0.35rem;">Hydrate when the browser is idle. For low-priority interactive elements.</p>
      </div>
    </div>
  </div>
</div>`,

  // ---- Blog posts (Markdown with frontmatter) ----

  "/src/pages/blog/getting-started-with-astro.md": `---
layout: ../../layouts/MarkdownPostLayout.astro
title: Getting Started with Astro
pubDate: 2025-12-15
author: Astro Learner
description: A beginner-friendly introduction to Astro and why it is one of the most exciting web frameworks today.
tags:
  - astro
  - getting-started
  - tutorial
---

## Why Astro?

Astro is a modern web framework designed for **content-driven websites**. Unlike traditional JavaScript frameworks that ship a large runtime to the browser, Astro takes a different approach: it renders your pages to static HTML at build time and ships **zero JavaScript** by default.

This means your blog, documentation site, or marketing page loads incredibly fast because the browser only needs to parse HTML and CSS.

## Key Concepts

### File-Based Routing

Every file in \`src/pages/\` becomes a page on your site:

\`\`\`
src/pages/index.astro     -> /
src/pages/about.astro     -> /about
src/pages/blog/post-1.md  -> /blog/post-1
\`\`\`

### Frontmatter

Astro components use a frontmatter block (between \`---\` fences) for server-side logic:

\`\`\`astro
---
const title = "Hello World";
const items = ["one", "two", "three"];
---
<h1>{title}</h1>
\`\`\`

### Layouts

Layouts are reusable page wrappers. You specify them in frontmatter:

\`\`\`
---
layout: ../layouts/BaseLayout.astro
---
\`\`\`

## Getting Started

1. Create a new Astro project with \`npm create astro@latest\`
2. Add pages in the \`src/pages/\` directory
3. Run \`npm run dev\` to start the development server
4. Deploy static HTML to any hosting provider

> Astro is the perfect choice when performance and content are your priorities.`,

  "/src/pages/blog/component-islands.md": `---
layout: ../../layouts/MarkdownPostLayout.astro
title: Understanding Component Islands
pubDate: 2025-12-20
author: Astro Learner
description: Learn how Astro's Islands Architecture lets you add interactivity only where you need it.
tags:
  - astro
  - architecture
  - performance
---

## What Are Component Islands?

The **Islands Architecture** is a pattern where most of your page is static HTML, but you can sprinkle in interactive "islands" of JavaScript where needed. Think of it like an ocean of static HTML with small islands of interactivity.

## How It Works in Astro

In Astro, you can use components from any framework (React, Vue, Svelte, Solid) and control exactly when they hydrate:

\`\`\`astro
---
import Counter from '../components/Counter.jsx';
---
<!-- Static HTML - no JS -->
<h1>My Page</h1>
<p>This text is pure HTML.</p>

<!-- Interactive island - hydrated on load -->
<Counter client:load />

<!-- Hydrated when visible -->
<Counter client:visible />

<!-- Hydrated on idle -->
<Counter client:idle />
\`\`\`

## Benefits

- **Performance**: Only interactive parts load JavaScript
- **Progressive Enhancement**: The page works even before JS loads
- **Framework Flexibility**: Mix React, Vue, Svelte in the same page
- **Smaller Bundles**: Ship only the JS you actually need

## Comparison

| Approach | JS Shipped | Time to Interactive |
|----------|-----------|-------------------|
| Traditional SPA | ~200KB+ | Slow |
| SSR + Hydration | ~150KB+ | Medium |
| **Astro Islands** | **~5-20KB** | **Fast** |

The islands pattern is particularly effective for content-heavy sites like blogs, documentation, and marketing pages where most content is static.`,

  "/src/pages/blog/markdown-and-mdx.md": `---
layout: ../../layouts/MarkdownPostLayout.astro
title: Markdown and MDX in Astro
pubDate: 2025-12-28
author: Astro Learner
description: Astro has first-class support for Markdown and MDX, making it ideal for content-driven sites.
tags:
  - astro
  - markdown
  - content
---

## Markdown Support

Astro treats Markdown as a first-class citizen. Any \`.md\` file in \`src/pages/\` automatically becomes a page with:

- **Frontmatter** for metadata (title, date, tags)
- **Layouts** for consistent page structure
- **Syntax highlighting** for code blocks
- **Auto-generated slugs** from the filename

## Frontmatter

Every Markdown file can include YAML frontmatter:

\`\`\`markdown
---
title: My Blog Post
pubDate: 2025-01-15
author: Jane Doe
tags:
  - web
  - astro
---

Your content here...
\`\`\`

The frontmatter is accessible in your layout component via \`Astro.props.frontmatter\`.

## Content Collections

For larger sites, Astro provides **Content Collections** with type-safe schemas:

\`\`\`typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    tags: z.array(z.string()),
  }),
});

export const collections = { blog };
\`\`\`

This gives you:
- **Type safety** for all your content
- **Validation** at build time
- **Auto-completion** in your editor
- **Querying** with \`getCollection()\` and \`getEntry()\`

## MDX Support

For pages that need interactive components alongside Markdown, use MDX:

\`\`\`mdx
---
title: Interactive Post
---

# Hello World

This is regular Markdown.

<Counter client:load />

Back to Markdown again.
\`\`\`

MDX lets you import and use components directly in your content files, giving you the best of both worlds.`,
};

// ---------------------------------------------------------------------------
// Frontmatter parser
// ---------------------------------------------------------------------------

function parseFrontmatter(raw: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  const fm: Frontmatter = {};
  if (!raw.startsWith("---")) return { frontmatter: fm, body: raw };

  const end = raw.indexOf("---", 3);
  if (end === -1) return { frontmatter: fm, body: raw };

  const fmBlock = raw.slice(3, end).trim();
  const body = raw.slice(end + 3).trim();

  let currentKey = "";
  let inArray = false;

  for (const line of fmBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (inArray && trimmed.startsWith("- ")) {
      const val = trimmed.slice(2).trim();
      (fm[currentKey] as string[]).push(val);
      continue;
    }

    inArray = false;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (!value) {
      fm[key] = [];
      currentKey = key;
      inArray = true;
    } else {
      fm[key] = value;
      currentKey = key;
    }
  }

  return { frontmatter: fm, body };
}

// ---------------------------------------------------------------------------
// Minimal markdown-to-HTML converter
// ---------------------------------------------------------------------------

function markdownToHtml(md: string): string {
  let html = "";
  const lines = md.split("\n");
  let inCodeBlock = false;
  let codeContent = "";
  let inList = false;
  let listType: "ul" | "ol" = "ul";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        html += `<pre><code>${escapeHtml(
          codeContent.trimEnd()
        )}</code></pre>\n`;
        codeContent = "";
        inCodeBlock = false;
      } else {
        if (inList) {
          html += listType === "ul" ? "</ul>\n" : "</ol>\n";
          inList = false;
        }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + "\n";
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) {
        html += listType === "ul" ? "</ul>\n" : "</ol>\n";
        inList = false;
      }
      continue;
    }

    // Tables
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (inList) {
        html += listType === "ul" ? "</ul>\n" : "</ol>\n";
        inList = false;
      }
      const rows: string[] = [];
      let j = i;
      while (
        j < lines.length &&
        lines[j].trim().startsWith("|") &&
        lines[j].trim().endsWith("|")
      ) {
        rows.push(lines[j].trim());
        j++;
      }
      html += renderTable(rows);
      i = j - 1;
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      if (inList) {
        html += listType === "ul" ? "</ul>\n" : "</ol>\n";
        inList = false;
      }
      const level = headingMatch[1].length;
      html += `<h${level}>${inlineFormat(headingMatch[2])}</h${level}>\n`;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      if (inList) {
        html += listType === "ul" ? "</ul>\n" : "</ol>\n";
        inList = false;
      }
      html += `<blockquote><p>${inlineFormat(
        trimmed.slice(2)
      )}</p></blockquote>\n`;
      continue;
    }

    // Unordered list
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList || listType !== "ul") {
        if (inList) html += "</ol>\n";
        html += "<ul>\n";
        inList = true;
        listType = "ul";
      }
      html += `<li>${inlineFormat(trimmed.slice(2))}</li>\n`;
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        if (inList) html += "</ul>\n";
        html += "<ol>\n";
        inList = true;
        listType = "ol";
      }
      html += `<li>${inlineFormat(olMatch[1])}</li>\n`;
      continue;
    }

    // Paragraph
    if (inList) {
      html += listType === "ul" ? "</ul>\n" : "</ol>\n";
      inList = false;
    }
    html += `<p>${inlineFormat(trimmed)}</p>\n`;
  }

  if (inList) html += listType === "ul" ? "</ul>\n" : "</ol>\n";
  if (inCodeBlock)
    html += `<pre><code>${escapeHtml(codeContent.trimEnd())}</code></pre>\n`;

  return html;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineFormat(s: string): string {
  // inline code
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  // bold
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // italic
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

function renderTable(rows: string[]): string {
  if (rows.length < 2) return "";
  const parseRow = (r: string) =>
    r
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  const headers = parseRow(rows[0]);
  // rows[1] is the separator line (|---|---|)
  const dataRows = rows.slice(2).map(parseRow);

  let html =
    '<table style="width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.9rem;">';
  html += "<thead><tr>";
  for (const h of headers) {
    html += `<th style="text-align:left;padding:0.5rem;border-bottom:2px solid #ddd;font-weight:600;">${inlineFormat(
      h
    )}</th>`;
  }
  html += "</tr></thead><tbody>";
  for (const row of dataRows) {
    html += "<tr>";
    for (const cell of row) {
      html += `<td style="padding:0.5rem;border-bottom:1px solid #eee;">${inlineFormat(
        cell
      )}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  return html;
}

// ---------------------------------------------------------------------------
// Astro-like rendering engine
// ---------------------------------------------------------------------------

function resolveComponent(container: Container, name: string): string {
  const componentPaths = [`/src/components/${name}.astro`];
  for (const p of componentPaths) {
    try {
      const raw = container.readFile(p);
      const { body } = parseFrontmatter(raw);
      return body;
    } catch {
      /* not found */
    }
  }
  return `<!-- Component ${name} not found -->`;
}

function inlineComponents(container: Container, html: string): string {
  const componentNames = ["Navbar", "Footer", "BlogCard"];
  for (const name of componentNames) {
    const selfClosingTag = new RegExp(`<${name}\\s*/>`, "g");
    if (selfClosingTag.test(html)) {
      const componentHtml = resolveComponent(container, name);
      html = html.replace(selfClosingTag, componentHtml);
    }
  }
  return html;
}

// ---------------------------------------------------------------------------
// Island processing -- Astro's Islands Architecture
// Detects <Component client:load|visible|idle /> directives, loads framework
// CDNs, and mounts interactive components alongside static HTML.
// ---------------------------------------------------------------------------

interface IslandDef {
  id: number;
  componentName: string;
  hydration: "load" | "visible" | "idle";
  framework: "react" | "vue";
}

function detectIslandFramework(
  container: Container,
  name: string
): "react" | "vue" | null {
  const tsxPath = `/src/components/${name}.tsx`;
  const jsxPath = `/src/components/${name}.jsx`;
  const vuePath = `/src/components/${name}.vue`;
  try {
    container.readFile(tsxPath);
    return "react";
  } catch {
    /* */
  }
  try {
    container.readFile(jsxPath);
    return "react";
  } catch {
    /* */
  }
  try {
    container.readFile(vuePath);
    return "vue";
  } catch {
    /* */
  }
  return null;
}

function parseVueSFC(source: string): { template: string; script: string } {
  const templateMatch = source.match(/<template>([\s\S]*?)<\/template>/);
  const scriptMatch = source.match(/<script>([\s\S]*?)<\/script>/);
  return {
    template: templateMatch ? templateMatch[1].trim() : "<div></div>",
    script: scriptMatch ? scriptMatch[1].trim() : "",
  };
}

function processIslands(container: Container, html: string): string {
  const islands: IslandDef[] = [];
  let islandId = 0;

  const islandRegex = /<(\w+)\s+client:(load|visible|idle)\s*\/>/g;

  html = html.replace(
    islandRegex,
    (_match, name: string, hydration: string) => {
      const framework = detectIslandFramework(container, name);
      if (!framework) return `<!-- Island ${name} not found -->`;

      const id = islandId++;
      islands.push({
        id,
        componentName: name,
        hydration: hydration as "load" | "visible" | "idle",
        framework,
      });

      return `<div id="astro-island-${id}"></div>`;
    }
  );

  if (islands.length === 0) return html;

  const needsReact = islands.some((i) => i.framework === "react");
  const needsVue = islands.some((i) => i.framework === "vue");

  const cdnGlobals: Record<string, string> = {};
  const cdnExternals = new Set<string>();
  if (needsReact) {
    cdnGlobals["react"] = "React";
    cdnGlobals["react-dom"] = "ReactDOM";
    cdnGlobals["react-dom/client"] = "ReactDOM";
    cdnExternals.add("react");
    cdnExternals.add("react-dom");
  }
  if (needsVue) {
    cdnGlobals["vue"] = "Vue";
    cdnExternals.add("vue");
  }

  let cdnScripts = "";
  if (needsReact) {
    cdnScripts +=
      '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>\n';
    cdnScripts +=
      '<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>\n';
    cdnScripts +=
      '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>\n';
  }
  if (needsVue) {
    cdnScripts +=
      '<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>\n';
  }

  const islandSources: string[] = [];
  let mountScripts = "";

  for (const island of islands) {
    const ext = island.framework === "react" ? "tsx" : "vue";
    const filePath = `/src/components/${island.componentName}.${ext}`;
    let source: string;
    try {
      source = container.readFile(filePath);
    } catch {
      try {
        source = container.readFile(
          `/src/components/${island.componentName}.jsx`
        );
      } catch {
        mountScripts += `<!-- Could not read ${island.componentName} -->`;
        continue;
      }
    }

    islandSources.push(source);
    const mountId = `astro-island-${island.id}`;

    if (island.framework === "react") {
      const processed = preprocessImports(source)
        .replace(/^export\s+default\s+/gm, "")
        .trim();

      const mountCode = `
(function() {
  function __mount__() {
    var el = document.getElementById('${mountId}');
    if (!el) return;
    ${processed}
    var root = ReactDOM.createRoot(el);
    root.render(React.createElement(${island.componentName}));
  }
  ${wrapHydration(island.hydration, mountId)}
})();`;

      mountScripts += `<script type="text/babel">${mountCode}<\/script>\n`;
    } else {
      const { template, script } = parseVueSFC(source);
      const cleanScript = script.replace(/^export\s+default\s*/, "").trim();

      const safeTemplate = template
        .replace(/\\/g, "\\\\")
        .replace(/`/g, "\\`")
        .replace(/\$\{/g, "\\${");

      const mountCode = `
(function() {
  function __mount__() {
    var el = document.getElementById('${mountId}');
    if (!el) return;
    var opts = ${cleanScript};
    opts.template = \`${safeTemplate}\`;
    Vue.createApp(opts).mount(el);
  }
  ${wrapHydration(island.hydration, mountId)}
})();`;

      mountScripts += `<script>${mountCode}<\/script>\n`;
    }
  }

  const bareImports = scanBareImports(islandSources);
  for (const specifier of [...bareImports]) {
    const pkg = extractPackageName(specifier);
    if (cdnExternals.has(pkg) || cdnExternals.has(specifier)) {
      bareImports.delete(specifier);
    }
  }

  const bundles = new Map();
  for (const specifier of bareImports) {
    try {
      const bundle = bundlePackageForBrowser(container.vfs, specifier, cdnExternals);
      bundles.set(specifier, bundle);
    } catch (err) {
      console.warn(`[processIslands] Could not bundle "${specifier}":`, err);
    }
  }

  const requireShim = generateRequireScript(bundles, cdnGlobals);

  // Explicitly trigger Babel transform after all scripts are in the DOM.
  // Babel standalone auto-transforms on DOMContentLoaded, but in sandboxed
  // srcdoc iframes the timing can be unreliable.
  if (needsReact) {
    mountScripts += `<script>
if (typeof Babel !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { Babel.transformScriptTags(); });
  } else {
    Babel.transformScriptTags();
  }
}
<\/script>\n`;
  }

  html = html.replace(
    "</body>",
    cdnScripts + requireShim + "\n" + mountScripts + "</body>"
  );
  return html;
}

function wrapHydration(
  mode: "load" | "visible" | "idle",
  elementId: string
): string {
  switch (mode) {
    case "load":
      return "__mount__();";
    case "visible":
      return `
    if ('IntersectionObserver' in window) {
      var el = document.getElementById('${elementId}');
      if (el) {
        el.style.minHeight = '1px';
        var obs = new IntersectionObserver(function(entries) {
          if (entries[0].isIntersecting) { obs.disconnect(); __mount__(); }
        }, { threshold: 0, rootMargin: '200px 0px' });
        obs.observe(el);
      } else { __mount__(); }
    } else { __mount__(); }`;
    case "idle":
      return `
    if ('requestIdleCallback' in window) {
      requestIdleCallback(function() { __mount__(); });
    } else {
      setTimeout(function() { __mount__(); }, 200);
    }`;
  }
}

// ---------------------------------------------------------------------------

function collectBlogPosts(container: Container): Array<{
  url: string;
  title: string;
  pubDate: string;
  author: string;
  description: string;
  tags: string[];
}> {
  const posts: Array<{
    url: string;
    title: string;
    pubDate: string;
    author: string;
    description: string;
    tags: string[];
  }> = [];

  try {
    const entries = container.vfs.readdirSync("/src/pages/blog");
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const filePath = `/src/pages/blog/${entry}`;
      try {
        const raw = container.readFile(filePath);
        const { frontmatter } = parseFrontmatter(raw);
        const slug = entry.replace(/\.md$/, "");
        posts.push({
          url: `/blog/${slug}`,
          title: (frontmatter.title as string) || slug,
          pubDate: (frontmatter.pubDate as string) || "",
          author: (frontmatter.author as string) || "",
          description: (frontmatter.description as string) || "",
          tags: (frontmatter.tags as string[]) || [],
        });
      } catch {
        /* skip unreadable */
      }
    }
  } catch {
    /* no blog dir */
  }

  posts.sort((a, b) => (b.pubDate > a.pubDate ? 1 : -1));
  return posts;
}

function renderBlogCards(
  posts: Array<{
    url: string;
    title: string;
    description: string;
    pubDate: string;
    tags: string[];
  }>
): string {
  return posts
    .map((post) => {
      const tagsHtml = post.tags
        .map(
          (t) =>
            `<span style="font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 9999px; background: #fff4ee; color: #e05d26;">${t}</span>`
        )
        .join("");

      return `<a href="${post.url}" style="display: block; padding: 1.5rem; background: white; border-radius: 12px; border: 1px solid #eee; text-decoration: none; transition: all 0.2s;" onmouseover="this.style.borderColor='#fbb87a';this.style.boxShadow='0 4px 20px rgba(224,93,38,0.08)'" onmouseout="this.style.borderColor='#eee';this.style.boxShadow='none'">
  <p style="font-size: 0.8rem; color: #999; margin-bottom: 0.5rem;">${post.pubDate}</p>
  <h3 style="font-size: 1.15rem; font-weight: 600; color: #1a1a2e; margin-bottom: 0.5rem;">${post.title}</h3>
  <p style="font-size: 0.9rem; color: #666; line-height: 1.5; margin-bottom: 0.75rem;">${post.description}</p>
  <div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">${tagsHtml}</div>
</a>`;
    })
    .join("\n");
}

function applyLayout(
  container: Container,
  layoutPath: string,
  content: string,
  frontmatter: Frontmatter
): string {
  const normalizedPath = layoutPath.startsWith("/")
    ? layoutPath
    : `/src/layouts/${layoutPath.replace(/^\.\.\/layouts\//, "")}`;

  try {
    const rawLayout = container.readFile(normalizedPath);
    const { body: layoutBody } = parseFrontmatter(rawLayout);

    let result = layoutBody;

    // Replace {pageTitle} and similar simple expressions
    result = result.replace(
      /\{pageTitle\}/g,
      (frontmatter.pageTitle as string) || (frontmatter.title as string) || ""
    );
    result = result.replace(/\{frontmatter\.(\w+)\}/g, (_, key) => {
      const val = frontmatter[key];
      if (val === undefined) return "";
      if (typeof val === "string") return val;
      return String(val);
    });

    // Handle {frontmatter.tags.map(...)} for tag rendering
    result = result.replace(
      /\{frontmatter\.tags\.map\(tag\s*=>\s*\n?\s*<a href="\/tags\/\{tag\}"[^>]*>[^<]*\{tag\}[^<]*<\/a>\s*\n?\s*\)\}/g,
      () => {
        const tags = (frontmatter.tags as string[]) || [];
        return tags
          .map(
            (tag) =>
              `<a href="/tags/${tag}" style="font-size: 0.8rem; padding: 0.25rem 0.75rem; border-radius: 9999px; background: #fff4ee; color: #e05d26; border: 1px solid #fdd8c4; text-decoration: none;">${tag}</a>`
          )
          .join("\n");
      }
    );

    // Replace <slot />
    result = result.replace(/<slot\s*\/?>/g, content);

    // Inline components in the layout
    result = inlineComponents(container, result);

    // If the layout itself references another layout (e.g., MarkdownPostLayout uses BaseLayout)
    const layoutFmMatch = rawLayout.match(/^---\n([\s\S]*?)\n---/);
    if (layoutFmMatch) {
      const innerLayoutMatch = layoutBody.match(
        /<(BaseLayout|MarkdownPostLayout)\s+([^>]*)>([\s\S]*)<\/\1>/
      );
      if (innerLayoutMatch) {
        const parentName = innerLayoutMatch[1];
        const parentPath = `/src/layouts/${parentName}.astro`;
        const innerContent = result.match(
          new RegExp(`<${parentName}[^>]*>([\\s\\S]*)<\\/${parentName}>`)
        );
        if (innerContent) {
          const wrappedContent = innerContent[1];
          const outerParts = result.split(innerContent[0]);
          const parentResult = applyLayout(
            container,
            parentPath,
            wrappedContent,
            frontmatter
          );
          result = outerParts[0] + parentResult + (outerParts[1] || "");
        }
      }
    }

    return result;
  } catch {
    return content;
  }
}

function assembleAstroPage(container: Container, route: string): string {
  const pagePath = resolveRoute(container, route);
  if (!pagePath) {
    return wrapFullHtml(
      "404 - Page Not Found",
      '<div style="max-width:600px;margin:4rem auto;text-align:center;padding:2rem;">' +
        '<h1 style="font-size:4rem;font-weight:800;color:#e05d26;margin-bottom:1rem;">404</h1>' +
        '<p style="color:#666;font-size:1.1rem;">Page not found</p>' +
        `<a href="/" style="display:inline-block;margin-top:1.5rem;padding:0.5rem 1.5rem;background:#e05d26;color:white;border-radius:0.5rem;text-decoration:none;">Go Home</a>` +
        "</div>"
    );
  }

  let raw: string;
  try {
    raw = container.readFile(pagePath);
  } catch {
    return wrapFullHtml("Error", "<p>Error reading file</p>");
  }

  const { frontmatter, body } = parseFrontmatter(raw);
  const isMarkdown = pagePath.endsWith(".md");

  let pageContent: string;
  if (isMarkdown) {
    pageContent = markdownToHtml(body);
  } else {
    pageContent = body;
  }

  // Handle blog listing page
  if (pagePath === "/src/pages/blog.astro") {
    const posts = collectBlogPosts(container);
    const cardsHtml = renderBlogCards(posts);
    pageContent = pageContent.replace(
      "<!-- BLOG_CARDS_PLACEHOLDER -->",
      cardsHtml
    );
  }

  // Apply layout
  const layoutRef = frontmatter.layout as string | undefined;
  if (layoutRef) {
    const layoutPath = layoutRef.startsWith(".")
      ? resolveRelativePath(pagePath, layoutRef)
      : `/src/layouts/${layoutRef}`;
    pageContent = applyLayout(container, layoutPath, pageContent, frontmatter);
  } else {
    pageContent = wrapFullHtml(
      (frontmatter.pageTitle as string) || "Astro",
      pageContent
    );
  }

  // Process interactive islands (React/Vue components with client: directives)
  pageContent = processIslands(container, pageContent);

  // Add navigation script for client-side link interception
  const navScript = `<script>
document.addEventListener('click', function(e) {
  var a = e.target.closest('a[href]');
  if (!a) return;
  var href = a.getAttribute('href');
  if (href && href.startsWith('/') && !href.startsWith('//')) {
    e.preventDefault();
    window.parent.postMessage({ type: 'route-change', path: href }, '*');
  }
});
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'navigate') {
    window.parent.postMessage({ type: 'route-change', path: e.data.path }, '*');
  }
});
<\/script>`;

  pageContent = pageContent.replace("</body>", navScript + "\n</body>");

  return pageContent;
}

function resolveRoute(container: Container, route: string): string | null {
  const cleanRoute = route === "/" ? "/" : route.replace(/\/$/, "");

  // Direct .astro page match
  if (cleanRoute === "/") {
    try {
      container.readFile("/src/pages/index.astro");
      return "/src/pages/index.astro";
    } catch {
      /* */
    }
  }

  const pagePath = `/src/pages${cleanRoute}.astro`;
  try {
    container.readFile(pagePath);
    return pagePath;
  } catch {
    /* */
  }

  // Markdown match
  const mdPath = `/src/pages${cleanRoute}.md`;
  try {
    container.readFile(mdPath);
    return mdPath;
  } catch {
    /* */
  }

  // Directory index
  const dirIndex = `/src/pages${cleanRoute}/index.astro`;
  try {
    container.readFile(dirIndex);
    return dirIndex;
  } catch {
    /* */
  }

  return null;
}

function resolveRelativePath(from: string, relative: string): string {
  const fromDir = from.substring(0, from.lastIndexOf("/"));
  const parts = fromDir.split("/");

  for (const segment of relative.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== ".") parts.push(segment);
  }

  return parts.join("/");
}

function wrapFullHtml(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | My Astro Site</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1a1a2e; background: #fafafa; }
    a { color: #e05d26; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let lineId = 0;

export function useAstroContainer() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);

  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isBooted, setIsBooted] = useState(false);
  const [htmlSrc, setHtmlSrc] = useState("");
  const [currentPath, setCurrentPath] = useState("/");
  const [history, setHistory] = useState<string[]>(["/"]);
  const [historyIdx, setHistoryIdx] = useState(0);

  const pushLine = useCallback((type: TerminalLine["type"], text: string) => {
    const line = { id: ++lineId, type, text };
    linesRef.current = [...linesRef.current, line];
    setTerminal([...linesRef.current]);
  }, []);

  const refreshFiles = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const buildTree = (dirPath: string): FileEntry[] => {
      try {
        const entries = c.vfs.readdirSync(dirPath);
        return entries
          .filter((n) => !n.startsWith("."))
          .sort((a, b) => {
            const fullA = dirPath === "/" ? `/${a}` : `${dirPath}/${a}`;
            const fullB = dirPath === "/" ? `/${b}` : `${dirPath}/${b}`;
            const aDir = c.vfs.statSync(fullA).isDirectory();
            const bDir = c.vfs.statSync(fullB).isDirectory();
            if (aDir !== bDir) return aDir ? -1 : 1;
            return a.localeCompare(b);
          })
          .map((name) => {
            const fullPath =
              dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
            const isDir = c.vfs.statSync(fullPath).isDirectory();
            return {
              name,
              path: fullPath,
              isDir,
              children: isDir ? buildTree(fullPath) : undefined,
            };
          });
      } catch {
        return [];
      }
    };
    setFiles(buildTree("/"));
  }, []);

  const rebuildPreview = useCallback((route: string) => {
    const c = containerRef.current;
    if (!c) return;
    setHtmlSrc(assembleAstroPage(c, route));
  }, []);

  // -- boot --

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const c = boot({
      cwd: "/",
      autoInstall: true,
      onConsole: (_method, args) => {
        const text = args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" ");
        pushLine("stdout", text);
      },
    });
    containerRef.current = c;

    for (const [path, content] of Object.entries(VIRTUAL_FILES)) {
      c.writeFile(path, content);
    }

    setIsBooted(true);
    pushLine("info", "Container booted. Astro project loaded.");
    pushLine(
      "info",
      "Try: ls, cat /src/pages/index.astro, or edit files and hit Refresh."
    );
    refreshFiles();
    setSelectedFile("/src/pages/index.astro");
    setFileContent(VIRTUAL_FILES["/src/pages/index.astro"]);
    setHtmlSrc(assembleAstroPage(c, "/"));
  }, [pushLine, refreshFiles]);

  // -- listen for route changes from the iframe --

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "route-change" && typeof e.data.path === "string") {
        const newPath = e.data.path;
        setCurrentPath(newPath);
        rebuildPreview(newPath);
        setHistory((prev) => {
          const trimmed = prev.slice(0, historyIdx + 1);
          return [...trimmed, newPath];
        });
        setHistoryIdx((prev) => prev + 1);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [historyIdx, rebuildPreview]);

  // -- actions --

  const navigateTo = useCallback(
    (path: string) => {
      setCurrentPath(path);
      rebuildPreview(path);
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIdx + 1);
        return [...trimmed, path];
      });
      setHistoryIdx((prev) => prev + 1);
    },
    [historyIdx, rebuildPreview]
  );

  const goBack = useCallback(() => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    const path = history[newIdx];
    setHistoryIdx(newIdx);
    setCurrentPath(path);
    rebuildPreview(path);
  }, [history, historyIdx, rebuildPreview]);

  const goForward = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    const path = history[newIdx];
    setHistoryIdx(newIdx);
    setCurrentPath(path);
    rebuildPreview(path);
  }, [history, historyIdx, rebuildPreview]);

  const refresh = useCallback(() => {
    rebuildPreview(currentPath);
  }, [currentPath, rebuildPreview]);

  const selectFile = useCallback(
    (path: string) => {
      const c = containerRef.current;
      if (!c) return;
      try {
        const content = c.readFile(path);
        setSelectedFile(path);
        setFileContent(content);
      } catch {
        pushLine("stderr", `Cannot read ${path}`);
      }
    },
    [pushLine]
  );

  const saveFile = useCallback(
    (path: string, content: string) => {
      const c = containerRef.current;
      if (!c) return;
      c.writeFile(path, content);
      setFileContent(content);
      refreshFiles();
      pushLine("info", `Saved ${path}`);
      rebuildPreview(currentPath);
    },
    [refreshFiles, pushLine, rebuildPreview, currentPath]
  );

  const runCommand = useCallback(
    async (cmd: string) => {
      const c = containerRef.current;
      if (!c) return;
      pushLine("command", `$ ${cmd}`);
      try {
        const result = await c.run(cmd);
        if (result.stdout.trim()) pushLine("stdout", result.stdout.trimEnd());
        if (result.stderr.trim()) pushLine("stderr", result.stderr.trimEnd());
        if (result.exitCode !== 0)
          pushLine("info", `Exit code ${result.exitCode}`);
      } catch (err) {
        pushLine("stderr", String(err));
      }
      refreshFiles();
      const trimmed = cmd.trim();
      if (/^(npm|pnpm)\s+(install|i|add|uninstall|remove|rm)\b/.test(trimmed)) {
        rebuildPreview(currentPath);
      }
    },
    [pushLine, refreshFiles, rebuildPreview, currentPath]
  );

  const clearTerminal = useCallback(() => {
    linesRef.current = [];
    setTerminal([]);
  }, []);

  return {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    htmlSrc,
    currentPath,
    canGoBack: historyIdx > 0,
    canGoForward: historyIdx < history.length - 1,
    navigateTo,
    goBack,
    goForward,
    refresh,
    selectFile,
    saveFile,
    runCommand,
    clearTerminal,
  };
}
