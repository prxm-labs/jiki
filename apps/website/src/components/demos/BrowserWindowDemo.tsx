import { useState } from "react";
import { BrowserWindow } from "@run0/jiki-ui";
import { DemoTabs } from "./DemoTabs";

const HTML_SRC = `<!DOCTYPE html>
<html>
  <head><title>My App</title></head>
  <body style="margin:0;font-family:system-ui;background:#09090b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;height:100vh">
    <div style="text-align:center">
      <h1 style="font-size:1.5rem;margin-bottom:0.5rem">Hello from jiki</h1>
      <p style="color:#a1a1aa">Click the crosshair to inspect elements</p>
    </div>
  </body>
</html>`;

const CODE = `import { useState } from "react";
import { BrowserWindow } from "@run0/jiki-ui";

const HTML_SRC = \`<!DOCTYPE html>
<html>
  <head><title>My App</title></head>
  <body style="margin:0;font-family:system-ui;background:#09090b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;height:100vh">
    <div style="text-align:center">
      <h1>Hello from jiki</h1>
      <p style="color:#a1a1aa">Click the crosshair to inspect elements</p>
    </div>
  </body>
</html>\`;

export default function BrowserWindowDemo() {
  const [url, setUrl] = useState("/");

  return (
    <div style={{ height: 380 }}>
      <BrowserWindow
        htmlSrc={HTML_SRC}
        url={url}
        canGoBack={false}
        canGoForward={false}
        onBack={() => {}}
        onForward={() => {}}
        onRefresh={() => {}}
        onNavigate={setUrl}
        onInspectElement={(el) =>
          alert(\`<\${el.tagName}> \${el.textContent}\`)
        }
      />
    </div>
  );
}`;

export default function BrowserWindowDemo() {
  const [url, setUrl] = useState("/");

  return (
    <DemoTabs code={CODE}>
      <div style={{ height: 380 }}>
        <BrowserWindow
          htmlSrc={HTML_SRC}
          url={url}
          canGoBack={false}
          canGoForward={false}
          onBack={() => {}}
          onForward={() => {}}
          onRefresh={() => {}}
          onNavigate={setUrl}
          onInspectElement={(el) =>
            alert(`<${el.tagName}> ${el.textContent}`)
          }
        />
      </div>
    </DemoTabs>
  );
}
