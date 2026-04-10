import { useState } from "react";
import { CodeEditor } from "@run0/jiki-ui";

const INITIAL_CONTENT = `function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("jiki"));
`;

export default function CodeEditorDemo() {
  const [content, setContent] = useState(INITIAL_CONTENT);

  return (
    <div className="not-prose" style={{ height: 300 }}>
      <CodeEditor
        filename="index.js"
        content={content}
        onSave={(path, code) => {
          setContent(code);
        }}
      />
    </div>
  );
}
