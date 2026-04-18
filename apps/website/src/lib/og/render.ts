import { readFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { renderOG, type OGProps } from "./template.tsx";

// Resolved relative to project root (cwd during astro build).
const FONT_DIR = path.resolve(
  process.cwd(),
  "src/assets/og-fonts",
);

const FONT_FILES = {
  interRegular: "Inter-Regular.ttf",
  interSemi: "Inter-SemiBold.ttf",
  instrumentItalic: "InstrumentSerif-Italic.ttf",
  jbMono: "JetBrainsMono-Regular.ttf",
  jbMonoBold: "JetBrainsMono-Bold.ttf",
} as const;

let fontsPromise: Promise<
  {
    name: string;
    data: Buffer;
    weight: 400 | 700;
    style: "normal" | "italic";
  }[]
> | null = null;

function loadFonts() {
  if (!fontsPromise) {
    const read = (f: string) => readFile(path.join(FONT_DIR, f));
    fontsPromise = Promise.all([
      read(FONT_FILES.interRegular),
      read(FONT_FILES.interSemi),
      read(FONT_FILES.instrumentItalic),
      read(FONT_FILES.jbMono),
      read(FONT_FILES.jbMonoBold),
    ]).then(
      ([interReg, interSemi, instItalic, jbMono, jbMonoBold]) =>
        [
          {
            name: "Inter",
            data: interReg,
            weight: 400 as const,
            style: "normal" as const,
          },
          {
            name: "Inter",
            data: interSemi,
            weight: 700 as const,
            style: "normal" as const,
          },
          {
            name: "Instrument Serif",
            data: instItalic,
            weight: 400 as const,
            style: "italic" as const,
          },
          {
            name: "JetBrains Mono",
            data: jbMono,
            weight: 400 as const,
            style: "normal" as const,
          },
          {
            name: "JetBrains Mono",
            data: jbMonoBold,
            weight: 700 as const,
            style: "normal" as const,
          },
        ],
    );
  }
  return fontsPromise;
}

export async function renderOGPng(props: OGProps): Promise<Uint8Array> {
  const fonts = await loadFonts();
  const svg = await satori(renderOG(props), {
    width: 1200,
    height: 630,
    fonts,
  });
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  })
    .render()
    .asPng();
  return png;
}
