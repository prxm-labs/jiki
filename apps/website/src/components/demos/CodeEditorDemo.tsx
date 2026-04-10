import { useState } from "react";
import { CodeEditor } from "@run0/jiki-ui";
import { DemoTabs } from "./DemoTabs";

const INITIAL_CONTENT = `function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("jiki"));
`;

const CODE = `import { useState } from "react";
import { CodeEditor } from "@run0/jiki-ui";

const INITIAL_CONTENT = \`function greet(name) {
  return \\\`Hello, \\\${name}!\\\`;
}

console.log(greet("jiki"));
\`;

export default function CodeEditorDemo() {
  const [content, setContent] = useState(INITIAL_CONTENT);

  return (
    <div style={{ height: 300 }}>
      <CodeEditor
        filename="index.js"
        content={content}
        onSave={(path, code) => {
          setContent(code);
          console.log("Saved", path);
        }}
      />
    </div>
  );
}`;

export default function CodeEditorDemo() {
  const [content, setContent] = useState(INITIAL_CONTENT);

  return (
    <DemoTabs code={CODE}>
      <div style={{ height: 300 }}>
        <CodeEditor
          filename="index.js"
          content={content}
          onSave={(path, code) => {
            setContent(code);
          }}
        />
      </div>
    </DemoTabs>
  );
}
