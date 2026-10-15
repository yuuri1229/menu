import type { Block, RichText } from "./types";

// ノートは Markdown で保存する（Claude が読み書きしやすいように）。表示するときに Block へ変換する。
// 対応：見出し（# ## ###）、箇条書き（- * 1.）、チェック（- [ ] - [x]）、入れ子（タブか2スペース）、
// 引用（>）、区切り線（---）、表（| a | b |）、コード（```）、太字・斜体・取り消し線・コード・リンク。

const INLINE = /(\*\*([^*]+)\*\*|~~([^~]+)~~|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*)/g;

export function parseInline(text: string): RichText[] {
  const out: RichText[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push({ t: unescape(text.slice(last, m.index)) });
    if (m[2] != null) out.push(...parseInline(m[2]).map((r) => ({ ...r, b: true })));
    else if (m[3] != null) out.push(...parseInline(m[3]).map((r) => ({ ...r, s: true })));
    else if (m[4] != null) out.push({ t: m[4], c: true });
    else if (m[5] != null) out.push({ t: unescape(m[5]), href: m[6] });
    else if (m[7] != null) out.push(...parseInline(m[7]).map((r) => ({ ...r, i: true })));
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ t: unescape(text.slice(last)) });
  return out;
}

const unescape = (s: string) => s.replace(/\\([\\`*_~[\]()#>|-])/g, "$1");

function indentLevel(ws: string) {
  let tabs = 0;
  let spaces = 0;
  for (const ch of ws) ch === "\t" ? tabs++ : spaces++;
  return tabs + Math.floor(spaces / 2);
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((c) => parseInline(c.trim()));

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const root: Block[] = [];
  // 入れ子の親になれるリスト項目を、深さごとに覚えておく
  const parents: Block[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) root.push({ type: "p", rich: parseInline(para.join("\n")) });
    para = [];
  };
  const place = (block: Block, level: number) => {
    const parent = level > 0 ? parents[Math.min(level, parents.length) - 1] : undefined;
    if (parent) (parent.children ??= []).push(block);
    else root.push(block);
    return parent ? Math.min(level, parents.length) : 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const [, ws, body] = raw.match(/^([ \t]*)(.*)$/)!;
    const level = indentLevel(ws);

    if (!body.trim()) {
      flushPara();
      continue;
    }

    if (body.startsWith("```")) {
      flushPara();
      const code: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i]);
      root.push({ type: "code", rich: [{ t: code.join("\n") }] });
      parents.length = 0;
      continue;
    }

    let m: RegExpMatchArray | null;
    const list =
      (m = body.match(/^[-*+] \[([ xX])\] (.*)$/))
        ? ({ type: "todo", checked: m[1] !== " ", rich: parseInline(m[2]) } as Block)
        : (m = body.match(/^[-*+] (.*)$/))
          ? ({ type: "ul", rich: parseInline(m[1]) } as Block)
          : (m = body.match(/^\d+[.)] (.*)$/))
            ? ({ type: "ol", rich: parseInline(m[1]) } as Block)
            : null;
    if (list) {
      flushPara();
      const depth = place(list, level);
      parents.length = depth;
      parents.push(list);
      continue;
    }

    // リストの下に字下げして続く文は、その項目の中の段落にする
    if (level > 0 && parents.length) {
      flushPara();
      place({ type: "p", rich: parseInline(body.trim()) }, level);
      continue;
    }

    parents.length = 0;
    if ((m = body.match(/^(#{1,3}) (.*)$/))) {
      flushPara();
      root.push({ type: (["h1", "h2", "h3"] as const)[m[1].length - 1], rich: parseInline(m[2].trim()) });
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(body.trim())) {
      flushPara();
      root.push({ type: "divider" });
    } else if (body.startsWith(">")) {
      flushPara();
      const quote: string[] = [body.replace(/^> ?/, "")];
      while (i + 1 < lines.length && lines[i + 1].trimStart().startsWith(">")) quote.push(lines[++i].trimStart().replace(/^> ?/, ""));
      root.push({ type: "quote", rich: parseInline(quote.join("\n")) });
    } else if (body.trimStart().startsWith("|")) {
      flushPara();
      const rows: RichText[][][] = [];
      let header = false;
      for (let j = i; j < lines.length && lines[j].trim().startsWith("|"); j++, i = j - 1) {
        if (/^\|?\s*:?-{2,}/.test(lines[j].trim()) && /^[\s|:-]+$/.test(lines[j])) header = rows.length === 1;
        else rows.push(cells(lines[j]));
      }
      root.push({ type: "table", rows, header });
    } else {
      para.push(body);
    }
  }
  flushPara();
  return root;
}
