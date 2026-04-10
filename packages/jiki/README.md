<div align="center">
  <a href="https://jiki.sh">
    <img src="../../apps/website/public/favicon.svg" alt="Jiki" width="120" />
  </a>

<a href="https://jiki.sh"><img alt="jiki logo" src="https://img.shields.io/badge/MADE%20For%20the%20browser-000000.svg?style=for-the-badge"></a>
<a href="https://www.npmjs.com/package/@run0/jiki"><img alt="NPM version" src="https://img.shields.io/npm/v/@run0/jiki.svg?style=for-the-badge&labelColor=000000"></a>
<a href="https://github.com/run0/jiki/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/npm/l/@run0/jiki.svg?style=for-the-badge&labelColor=000000"></a>
<a href="https://jiki.sh/docs"><img alt="jiki logo" src="https://img.shields.io/badge/docs-000000.svg?style=for-the-badge"></a>

</div>

---

A sandboxed Node.js runtime that runs entirely client-side. Filesystem, shell, npm / pnpm, and dev servers. No backend required. 

## A few lines is all it takes

```ts
import { boot } from "@run0/jiki";

const container = boot();
container.writeFile("/index.js", 'console.log("Hello from the browser!")');
await container.run("node index.js");
// → Hello from the browser!
```

## Learn more

- [Website](https://jiki.sh)
- [Documentation](https://jiki.sh/docs)
- [API Reference](http://localhost:4321/docs/api/boot)
- [Examples](./examples)

## License

MIT
