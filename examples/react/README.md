# React Example — jiki Web Container

A multi-page React application running entirely in the browser using jiki's virtual filesystem, npm package manager, and esbuild-powered JSX transpilation.

## Getting Started

```bash
cd examples/react
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Installing & Using npm Packages

Install real npm packages from the built-in terminal and use them in your components:

### 1. Install a package

```
npm install lucide-react
```

### 2. Import in any .jsx file

```jsx
import { Camera, Heart, Star } from 'lucide-react';
```

### 3. Use in JSX

```jsx
function MyComponent() {
  return (
    <div>
      <Camera color="#7c3aed" size={32} />
      <Heart color="red" size={32} />
      <Star color="gold" size={32} />
    </div>
  );
}
```

### 4. Save

Press **Ctrl+S** (Cmd+S on Mac). The preview updates automatically.

## How It Works

### Live Compilation

JSX is compiled on the host side using **esbuild-wasm**:

1. **`discoverComponents()`** walks `/src/` in the VFS and finds all `.jsx`/`.tsx` files
2. **`preprocessImports()`** converts `import { X } from 'pkg'` → `var { X } = window.require("pkg")`
3. **`transpile()`** converts JSX → `React.createElement()` calls via esbuild
4. Output goes into plain `<script>` tags — no Babel Standalone CDN needed

### Package Pipeline

1. **`npm install`** downloads the package tarball and extracts it to `/node_modules/` in the VFS
2. **`scanBareImports()`** detects which packages are imported across all component files
3. **`bundlePackageForBrowser()`** reads package code from VFS, resolves entry points, and transforms ESM → CJS
4. **`generateRequireScript()`** creates a `require()` shim that maps package names to their bundled code
5. React/ReactDOM are served from CDN as globals — they are excluded from bundling

### Dynamic File Discovery

New `.jsx`/`.tsx` files created in `/src/` are automatically discovered on each rebuild. You can create new components via the terminal (`echo` or editor) and they'll be included in the next preview.

## Project Structure

```
/
├── index.html              # HTML shell (React, ReactDOM, Tailwind from CDN)
├── src/
│   ├── components/
│   │   ├── Navbar.jsx
│   │   └── Footer.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── About.jsx       # Install instructions
│   │   ├── Icons.jsx       # Icon gallery (requires lucide-react)
│   │   └── Contact.jsx
│   └── App.jsx             # Router and layout
└── node_modules/           # Created after npm install
```

## Other Packages to Try

```
npm install date-fns
npm install clsx
npm install uuid
```
