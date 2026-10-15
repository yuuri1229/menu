import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="font-display text-5xl font-bold text-ink-3">404</p>
      <p className="mt-3 text-ink-2">ページが見つかりませんでした</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-accent px-5 py-2.5 font-bold text-accent-ink">
        今日の献立へ
      </Link>
    </div>
  );
}
