import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInline, parseMarkdown } from "./markdown.ts";

test("見出し・チェック・入れ子・引用・表・段落を Block にする", () => {
  const blocks = parseMarkdown(
    "## 予算\n- [x] 卵 **200円**\n\t- 6個入り\n- [ ] 納豆\n\n> 千切りキャベツは早めに\n\n| 回 | 金額 |\n|---|---|\n| ① | 3,010円 |\n\n補足の文\n2行目\n---",
  );
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["h2", "todo", "todo", "quote", "table", "p", "divider"],
  );
  assert.equal(blocks[1].checked, true);
  assert.equal(blocks[1].children?.[0].type, "ul");
  assert.equal(blocks[2].checked, false);
  assert.equal(blocks[4].header, true);
  assert.equal(blocks[4].rows?.length, 2);
});

test("太字・取り消し線・コード・リンクを読み分ける", () => {
  assert.deepEqual(parseInline("~~豚こま~~ → **豚バラ** `264g` [店](https://example.com)"), [
    { t: "豚こま", s: true },
    { t: " → " },
    { t: "豚バラ", b: true },
    { t: " " },
    { t: "264g", c: true },
    { t: " " },
    { t: "店", href: "https://example.com" },
  ]);
});

test("リストのない字下げや空行だけの文書でも落ちない", () => {
  assert.deepEqual(parseMarkdown("\n\n"), []);
  assert.equal(parseMarkdown("\tただの文")[0].type, "p");
});
