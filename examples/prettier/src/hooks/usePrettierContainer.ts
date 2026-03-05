import { useState, useCallback, useRef, useEffect } from "react";
import { boot, type Container } from "jiki";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { TerminalLine, FileEntry } from 'jiki-ui';
export type { TerminalLine, FileEntry };


export interface FormatResult {
  original: string;
  formatted: string;
  changed: boolean;
  duration: number;
}

// ---------------------------------------------------------------------------
// Virtual project files — intentionally messy code to format
// ---------------------------------------------------------------------------

const VIRTUAL_FILES: Record<string, string> = {
  "/package.json": `{
  "name": "my-app",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "prettier": "^3.4.0",
    "typescript": "^5.5.0"
  }
}`,

  "/.prettierrc": `{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 80,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}`,

  "/.prettierignore": `node_modules
dist
build
coverage
*.min.js`,

  "/src/utils/helpers.ts": `// This file is intentionally poorly formatted
export function   calculateTotal(items:{price:number;quantity:number}[]):number{
const total=items.reduce((sum,item)=>{
return sum+item.price*item.quantity
},0)
return Math.round(total*100)/100
}

export const   formatCurrency = (amount:number,currency:string="USD"):string =>   {
return new Intl.NumberFormat("en-US",{style:"currency",currency}).format(amount)
}

export function debounce<T extends (...args:unknown[])=>void>(fn:T,delay:number):(...args:Parameters<T>)=>void{
let timer:ReturnType<typeof setTimeout>
return (...args:Parameters<T>)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),delay)}
}

export   const  clamp=(value:number,min:number,max:number):number=>Math.min(Math.max(value,min),max)

export function    groupBy<T>(arr:T[],key:keyof T):Record<string,T[]>{
return arr.reduce((groups,item)=>{
const k=String(item[key])
if(!groups[k])groups[k]=[]
groups[k].push(item)
return groups
},{} as Record<string,T[]>)
}`,

  "/src/components/UserCard.tsx": `// Messy JSX formatting
import React from "react"
import   {formatCurrency}   from "../utils/helpers"

interface UserCardProps {name:string;email:string;avatar?:string
  balance:number;role:"admin"|"user"|"moderator";isActive:boolean;onEdit:(id:string)=>void;onDelete:(id:string)=>void}

export const UserCard:React.FC<UserCardProps>=({name,email,avatar,balance,role,isActive,onEdit,onDelete})=>{
return (
<div className={  \`rounded-xl border p-4 \${isActive?"border-green-200 bg-green-50":"border-gray-200 bg-gray-50"}\`  }>
<div className="flex items-start gap-3">
{avatar?(<img src={avatar} alt={name}
className="h-12 w-12 rounded-full object-cover"
/>):(<div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-lg font-bold text-white">{name.charAt(0).toUpperCase()}</div>)}
<div className="flex-1 min-w-0">
<div className="flex items-center gap-2"><h3 className="font-semibold text-gray-900 truncate">{name}</h3>
<span className={\`text-xs px-2 py-0.5 rounded-full font-medium \${role==="admin"?"bg-red-100 text-red-700":role==="moderator"?"bg-amber-100 text-amber-700":"bg-blue-100 text-blue-700"}\`}>{role}</span>
{isActive&&<span className="w-2 h-2 rounded-full bg-green-500"></span>}</div>
<p className="text-sm text-gray-500 truncate">{email}</p>
<p className="text-sm font-medium text-gray-700 mt-1">Balance: {formatCurrency(balance)}</p></div>
</div>
<div className="flex gap-2 mt-3 pt-3 border-t border-gray-100"><button onClick={()=>onEdit(email)} className="flex-1 text-sm py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 font-medium transition-colors">Edit</button>
<button onClick={()=>onDelete(email)} className="flex-1 text-sm py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium transition-colors">Delete</button></div>
</div>)
}`,

  "/src/hooks/useApi.ts": `// Poorly formatted hook
import {useState,useEffect,useCallback,useRef} from "react"

interface ApiState<T>{data:T|null;error:Error|null;loading:boolean}

export function useApi<T>(url:string,options?:RequestInit){
  const [state,setState]=useState<ApiState<T>>({data:null,error:null,loading:true})
  const abortRef=useRef<AbortController|null>(null)

const fetchData=useCallback(async()=>{
abortRef.current?.abort()
const controller=new AbortController()
abortRef.current=controller
setState(prev=>({...prev,loading:true,error:null}))
try{
const response=await fetch(url,{...options,signal:controller.signal})
if(!response.ok)throw new Error(\`HTTP \${response.status}: \${response.statusText}\`)
const data=await response.json() as T
if(!controller.signal.aborted){setState({data,error:null,loading:false})}
}catch(err){
if(err instanceof Error&&err.name!=="AbortError"){setState({data:null,error:err,loading:false})}
}
},[url,options])

useEffect(()=>{fetchData();return()=>{abortRef.current?.abort()}},[fetchData])

const refetch=useCallback(()=>fetchData(),[fetchData])

return {...state,refetch}
}`,

  "/src/config/app.config.ts": `// Config with bad formatting
export const APP_CONFIG={
name:"My Application",version:"1.0.0",
api:{baseUrl:"https://api.example.com/v1",timeout:30000,retries:3,
headers:{"Content-Type":"application/json","Accept":"application/json"}},
features:{darkMode:true,notifications:true,analytics:false,
beta:{enabled:true,features:["new-dashboard","ai-search","bulk-export"]}},
pagination:{defaultPageSize:25,maxPageSize:100,
pageSizeOptions:[10,25,50,100]},
auth:{tokenKey:"auth_token",refreshKey:"refresh_token",
expiresIn:3600,refreshThreshold:300}
} as const

export type AppConfig=typeof APP_CONFIG
`,
};

// ---------------------------------------------------------------------------
// Prettier (installed as a dependency, works in browser via standalone)
// ---------------------------------------------------------------------------

import * as prettier from "prettier/standalone";
import * as parserBabel from "prettier/plugins/babel";
import * as parserEstree from "prettier/plugins/estree";
import * as parserTypescript from "prettier/plugins/typescript";
import * as parserHtml from "prettier/plugins/html";
import * as parserCss from "prettier/plugins/postcss";
import * as parserMarkdown from "prettier/plugins/markdown";

const prettierPlugins = [
  parserBabel,
  parserEstree,
  parserTypescript,
  parserHtml,
  parserCss,
  parserMarkdown,
];

function parserForFile(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "babel";
    case "json":
      return "json";
    case "css":
    case "scss":
    case "less":
      return "css";
    case "html":
      return "html";
    case "md":
    case "mdx":
      return "markdown";
    default:
      return "babel";
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let lineId = 0;

export function usePrettierContainer() {
  const containerRef = useRef<Container | null>(null);
  const bootedRef = useRef(false);
  const linesRef = useRef<TerminalLine[]>([]);

  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isBooted, setIsBooted] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [lastResult, setLastResult] = useState<FormatResult | null>(null);
  const [prettierReady, setPrettierReady] = useState(false);

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
          .filter((n) => n !== "node_modules")
          .sort((a, b) => {
            const fullA = dirPath === "/" ? `/${a}` : `${dirPath}/${a}`;
            const fullB = dirPath === "/" ? `/${b}` : `${dirPath}/${b}`;
            const aDir = c.vfs.statSync(fullA).isDirectory();
            const bDir = c.vfs.statSync(fullB).isDirectory();
            if (aDir !== bDir) return aDir ? -1 : 1;
            return a.localeCompare(b);
          })
          .map((name) => {
            const fullPath = dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
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

  // ── Boot ──

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
    setPrettierReady(true);
    pushLine("info", "Container booted. Prettier project loaded.");
    pushLine("info", "Prettier ready. Select a file and click Format.");
    refreshFiles();
    setSelectedFile("/src/utils/helpers.ts");
    setFileContent(VIRTUAL_FILES["/src/utils/helpers.ts"]);
  }, [pushLine, refreshFiles]);

  // ── Actions ──

  const selectFile = useCallback(
    (path: string) => {
      const c = containerRef.current;
      if (!c) return;
      try {
        const content = c.readFile(path);
        setSelectedFile(path);
        setFileContent(content);
        setLastResult(null);
      } catch {
        pushLine("stderr", `Cannot read ${path}`);
      }
    },
    [pushLine],
  );

  const saveFile = useCallback(
    (path: string, content: string) => {
      const c = containerRef.current;
      if (!c) return;
      c.writeFile(path, content);
      setFileContent(content);
      refreshFiles();
      pushLine("info", `Saved ${path}`);
    },
    [refreshFiles, pushLine],
  );

  const formatFile = useCallback(
    async (path: string) => {
      const c = containerRef.current;
      if (!c || !prettierReady) return;

      setFormatting(true);
      pushLine("command", `$ prettier --write ${path}`);

      try {
        const original = c.readFile(path);

        let config: Record<string, unknown> = {};
        try {
          const rawConfig = c.readFile("/.prettierrc");
          config = JSON.parse(rawConfig);
        } catch { /* no config, use defaults */ }

        const parser = parserForFile(path);
        const start = performance.now();

        const formatted = await prettier.format(original, {
          ...config,
          parser,
          plugins: prettierPlugins,
        });

        const duration = Math.round((performance.now() - start) * 10) / 10;
        const changed = formatted !== original;

        if (changed) {
          c.writeFile(path, formatted);
          setFileContent(formatted);
          pushLine("stdout", `${path} ${formatted.split("\n").length}ms`);
        } else {
          pushLine("stdout", `${path} (unchanged)`);
        }

        pushLine("info", `Done in ${duration}ms`);
        setLastResult({ original, formatted, changed, duration });
      } catch (err) {
        pushLine("stderr", `Format error: ${err}`);
      } finally {
        setFormatting(false);
      }
    },
    [prettierReady, pushLine],
  );

  const formatAll = useCallback(async () => {
    const c = containerRef.current;
    if (!c || !prettierReady) return;

    pushLine("command", "$ prettier --write .");

    const filesToFormat: string[] = [];
    const walk = (dir: string) => {
      try {
        for (const entry of c.vfs.readdirSync(dir)) {
          const full = dir === "/" ? `/${entry}` : `${dir}/${entry}`;
          if (entry === "node_modules" || entry === "dist") continue;
          if (c.vfs.statSync(full).isDirectory()) {
            walk(full);
          } else if (/\.(ts|tsx|js|jsx|json|css|html|md)$/.test(entry)) {
            filesToFormat.push(full);
          }
        }
      } catch { /* skip */ }
    };
    walk("/");

    setFormatting(true);
    let changed = 0;
    const start = performance.now();

    for (const fp of filesToFormat) {
      try {
        const original = c.readFile(fp);
        let config: Record<string, unknown> = {};
        try { config = JSON.parse(c.readFile("/.prettierrc")); } catch { /* defaults */ }

        const formatted = await prettier.format(original, {
          ...config,
          parser: parserForFile(fp),
          plugins: prettierPlugins,
        });

        if (formatted !== original) {
          c.writeFile(fp, formatted);
          changed++;
          pushLine("stdout", `${fp} (formatted)`);
        } else {
          pushLine("stdout", `${fp} (unchanged)`);
        }
      } catch (err) {
        pushLine("stderr", `${fp}: ${err}`);
      }
    }

    const duration = Math.round(performance.now() - start);
    pushLine(
      "info",
      `Done: ${filesToFormat.length} files checked, ${changed} changed (${duration}ms)`,
    );

    setFormatting(false);
    refreshFiles();

    if (selectedFile) {
      try {
        setFileContent(c.readFile(selectedFile));
      } catch { /* ok */ }
    }
  }, [prettierReady, pushLine, refreshFiles, selectedFile]);

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
    },
    [pushLine, refreshFiles],
  );

  const clearTerminal = useCallback(() => {
    linesRef.current = [];
    setTerminal([]);
  }, []);

  const isFormattable =
    selectedFile != null &&
    /\.(ts|tsx|js|jsx|json|css|html|md)$/.test(selectedFile);

  return {
    terminal,
    files,
    selectedFile,
    fileContent,
    isBooted,
    formatting,
    prettierReady,
    lastResult,
    isFormattable,
    selectFile,
    saveFile,
    formatFile,
    formatAll,
    runCommand,
    clearTerminal,
  };
}
