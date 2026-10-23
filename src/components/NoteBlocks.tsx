"use client";

import { Fragment, type ReactNode } from "react";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import type { Block, RichText } from "@/lib/types";

const COLOR: Record<string, string> = {
  red: "text-danger",
  orange: "text-accent-text",
  yellow: "text-warn",
  green: "text-ok",
  blue: "text-night",
  purple: "text-night",
  gray: "text-ink-3",
  brown: "text-[#9a6b43]",
};

export function Rich({ rich }: { rich?: RichText[] }) {
  return (
    <>
      {(rich ?? []).map((r, i) => {
        let node: ReactNode = r.t;
        if (r.c) node = <code className="rounded bg-surface-3 px-1 py-0.5 text-[0.9em]">{node}</code>;
        const cls = clsx(
          r.b && "font-bold",
          r.i && "italic",
          r.u && "underline",
          r.s && "text-ink-3 line-through",
          r.color && COLOR[r.color.replace(/_background$/, "")],
        );
        if (r.href)
          return (
            <a key={i} href={r.href} target="_blank" rel="noreferrer" className={clsx(cls, "text-accent-text underline underline-offset-2")}>
              {node}
            </a>
          );
        return cls ? (
          <span key={i} className={cls}>
            {node}
          </span>
        ) : (
          <Fragment key={i}>{node}</Fragment>
        );
      })}
    </>
  );
}

/** 連続するリスト項目を ul/ol にまとめて描く */
export function Blocks({ blocks }: { blocks: Block[] }) {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "ul" || b.type === "ol" || b.type === "todo") {
      const run: Block[] = [];
      while (i < blocks.length && blocks[i].type === b.type) run.push(blocks[i++]);
      out.push(<List key={`l${i}`} type={b.type} items={run} />);
      continue;
    }
    out.push(<BlockView key={i} block={b} />);
    i++;
  }
  return <>{out}</>;
}

function List({ type, items }: { type: "ul" | "ol" | "todo"; items: Block[] }) {
  if (type === "todo") {
    return (
      <ul className="my-2 space-y-1.5">
        {items.map((b, i) => (
          <li key={i}>
            <div className="flex gap-2.5">
              <span
                className={clsx(
                  "mt-[3px] grid size-[18px] shrink-0 place-items-center rounded-md border-2",
                  b.checked ? "border-ok bg-ok text-white" : "border-line",
                )}
                aria-label={b.checked ? "済み" : "未"}
              >
                {b.checked && <Check className="size-3" strokeWidth={3.5} />}
              </span>
              <span className={clsx("min-w-0", b.checked && "text-ink-3")}>
                <Rich rich={b.rich} />
              </span>
            </div>
            {b.children && (
              <div className="ml-7">
                <Blocks blocks={b.children} />
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  }
  const Tag = type === "ol" ? "ol" : "ul";
  return (
    <Tag className={clsx("my-2 space-y-1 pl-5", type === "ol" ? "list-decimal" : "list-disc marker:text-ink-3")}>
      {items.map((b, i) => (
        <li key={i} className="pl-0.5">
          <Rich rich={b.rich} />
          {b.children && <Blocks blocks={b.children} />}
        </li>
      ))}
    </Tag>
  );
}

function BlockView({ block: b }: { block: Block }) {
  switch (b.type) {
    case "h1":
      return (
        <h2 className="mt-6 mb-2 font-display text-xl font-bold">
          <Rich rich={b.rich} />
        </h2>
      );
    case "h2":
      return (
        <h3 className="mt-5 mb-2 font-display text-lg font-bold">
          <Rich rich={b.rich} />
        </h3>
      );
    case "h3":
      return (
        <h4 className="mt-4 mb-1.5 text-[15px] font-bold text-ink-2">
          <Rich rich={b.rich} />
        </h4>
      );
    case "p":
      return b.rich?.length ? (
        <p className="my-2">
          <Rich rich={b.rich} />
        </p>
      ) : (
        <div className="h-2" />
      );
    case "quote":
      return (
        <blockquote className="my-3 border-l-4 border-line pl-3 text-ink-2">
          <Rich rich={b.rich} />
          {b.children && <Blocks blocks={b.children} />}
        </blockquote>
      );
    case "callout":
      return (
        <div className="my-3 flex gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3">
          {b.icon && <span aria-hidden>{b.icon}</span>}
          <div className="min-w-0">
            <Rich rich={b.rich} />
            {b.children && <Blocks blocks={b.children} />}
          </div>
        </div>
      );
    case "toggle":
      return (
        <details className="group my-2">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium">
            <ChevronDown className="size-4 -rotate-90 text-ink-3 transition-transform group-open:rotate-0" />
            <Rich rich={b.rich} />
          </summary>
          <div className="ml-5">{b.children && <Blocks blocks={b.children} />}</div>
        </details>
      );
    case "divider":
      return <hr className="my-4 border-line" />;
    case "code":
      return (
        <pre className="my-3 overflow-x-auto rounded-xl bg-surface-3 p-3 text-[13px]">
          <Rich rich={b.rich} />
        </pre>
      );
    case "table":
      return (
        <div className="my-3 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-[13px]">
            <tbody>
              {(b.rows ?? []).map((row, ri) => (
                <tr key={ri} className={clsx("border-b border-line last:border-0", b.header && ri === 0 && "bg-surface-2 font-bold")}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 align-top">
                      <Rich rich={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "page":
    case "database":
      return (
        <p className="my-2 text-ink-3">
          📄 <Rich rich={b.rich} />
        </p>
      );
    default:
      return null;
  }
}

/** 見出し2ごとに区切り、折りたためるセクションにする */
export function splitSections(blocks: Block[]): { title: RichText[] | null; blocks: Block[] }[] {
  const sections: { title: RichText[] | null; blocks: Block[] }[] = [];
  for (const b of blocks) {
    if (b.type === "h2" || b.type === "h1") sections.push({ title: b.rich ?? [], blocks: [] });
    else {
      if (!sections.length) sections.push({ title: null, blocks: [] });
      sections[sections.length - 1].blocks.push(b);
    }
  }
  return sections;
}

export const richToText = (rich: RichText[] | null) => (rich ?? []).map((r) => r.t).join("");
