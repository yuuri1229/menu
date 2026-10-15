"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, NotebookText } from "lucide-react";
import { Blocks, Rich, richToText, splitSections } from "@/components/NoteBlocks";
import { PageHeader } from "@/components/PageHeader";
import { Empty, LoadingCards, Pill } from "@/components/ui";
import { useData } from "@/lib/data";
import { md, timeAgo, todayJST } from "@/lib/date";
import type { Note } from "@/lib/types";

export default function NotesPage() {
  return (
    <Suspense fallback={<LoadingCards />}>
      <Notes />
    </Suspense>
  );
}

function Notes() {
  const params = useSearchParams();
  const { notes, status } = useData();
  const id = params.get("id");
  const note = id ? notes.find((n) => n.id === id) : null;

  if (status === "loading") return <LoadingCards />;
  if (id && note) return <NoteView note={note} />;
  return <NoteList notes={notes} />;
}

function NoteList({ notes }: { notes: Note[] }) {
  const today = todayJST();
  const sorted = useMemo(() => {
    const rank = { rules: 0, week: 1, page: 2 } as const;
    return [...notes].sort((a, b) => rank[a.kind] - rank[b.kind] || (b.start ?? "").localeCompare(a.start ?? ""));
  }, [notes]);

  return (
    <>
      <PageHeader eyebrow="Notion のページ" title="ノート" />
      {sorted.length === 0 ? (
        <Empty icon={<NotebookText className="size-6" />} title="ノートはまだありません" />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {sorted.map((n) => {
            const current = n.kind === "week" && n.start && n.end && n.start <= today && today <= n.end;
            return (
              <li key={n.id}>
                <Link href={`/notes?id=${n.id}`} className="tap flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-lg" aria-hidden>
                    {n.icon ?? (n.kind === "rules" ? "📋" : "📄")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{n.kind === "week" && n.start && n.end ? `${md(n.start)} – ${md(n.end)} の買い物・予算` : n.title}</span>
                    <span className="block text-[12px] text-ink-3">
                      {n.kind === "rules" ? "献立づくりのルール" : n.kind === "week" ? "週ごとの予算と実績" : "メモ"}
                      {n.editedAt && `・${timeAgo(n.editedAt)}に更新`}
                    </span>
                  </span>
                  {current && <Pill tone="accent">今週</Pill>}
                  <ChevronRight className="size-5 shrink-0 text-ink-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function NoteView({ note }: { note: Note }) {
  const sections = useMemo(() => splitSections(note.blocks), [note.blocks]);
  const [closed, setClosed] = useState<Set<number>>(new Set());
  useEffect(() => window.scrollTo(0, 0), [note.id]);

  return (
    <>
      <div className="pt-4">
        <Link href="/notes" className="tap -ml-2 inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[14px] text-ink-2">
          <ChevronLeft className="size-[18px]" />
          ノート
        </Link>
      </div>
      <PageHeader eyebrow={note.icon ? `${note.icon} Notion` : "Notion"} title={note.title} />

      {sections.length > 2 && (
        <nav aria-label="目次" className="no-scrollbar sticky top-0 z-10 -mx-4 mb-3 flex gap-2 overflow-x-auto bg-bg/90 px-4 py-2 backdrop-blur pt-safe">
          {sections.map((s, i) =>
            s.title ? (
              <a
                key={i}
                href={`#s${i}`}
                onClick={() => setClosed((c) => { const n = new Set(c); n.delete(i); return n; })}
                className="tap shrink-0 rounded-full bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-2 shadow-card"
              >
                {richToText(s.title)}
              </a>
            ) : null,
          )}
        </nav>
      )}

      <article className="space-y-3 text-[15px] leading-relaxed">
        {sections.map((s, i) =>
          s.title ? (
            <section key={i} id={`s${i}`} className="card scroll-mt-16 overflow-hidden">
              <button
                type="button"
                aria-expanded={!closed.has(i)}
                onClick={() =>
                  setClosed((c) => {
                    const n = new Set(c);
                    if (n.has(i)) n.delete(i);
                    else n.add(i);
                    return n;
                  })
                }
                className="flex w-full items-center gap-2 px-4 py-3.5 text-left"
              >
                <h2 className="min-w-0 flex-1 font-display text-[17px] font-bold">
                  <Rich rich={s.title} />
                </h2>
                <ChevronDown className={`size-5 shrink-0 text-ink-3 transition-transform ${closed.has(i) ? "-rotate-90" : ""}`} />
              </button>
              {!closed.has(i) && (
                <div className="border-t border-line px-4 pt-1 pb-4">
                  <Blocks blocks={s.blocks} />
                </div>
              )}
            </section>
          ) : (
            <div key={i} className="card px-4 py-3">
              <Blocks blocks={s.blocks} />
            </div>
          ),
        )}
      </article>
    </>
  );
}
