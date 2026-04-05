<p align="center">
  <img src="apps/website/public/favicon.svg" alt="Jiki" width="120" />
</p>

<h1 align="center">jiki</h1>

<p align="center">Node.js in the browser.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/jiki"><img src="https://img.shields.io/npm/v/jiki.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/jiki"><img src="https://img.shields.io/npm/dm/jiki.svg" alt="npm downloads" /></a>
  <a href="https://github.com/vorillaz/web-containers-lite/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/jiki.svg" alt="license" /></a>
</p>

---

A sandboxed Node.js runtime that runs entirely client-side. Filesystem, shell, npm / pnpm, and dev servers. No backend required.

## A few lines is all it takes

```ts
import { boot } from "jiki";

const container = boot();
container.writeFile("/index.js", 'console.log("Hello from the browser!")');
await container.run("node index.js");
// → Hello from the browser!
```

## Learn more

- [Website](https://jiki.sh)
- [Documentation](https://jiki.sh/docs)
- [Examples](./examples)

## License

MIT
