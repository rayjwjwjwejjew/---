import assert from "node:assert/strict";
import test from "node:test";
import {
  RollbackStack,
  applyRouteCommand,
  attachStableIds,
  canSkipLine,
  createDefaultProgress,
  createEmptyRouteState,
  markProgress,
  mergeProgress,
  migrateProgress,
  parseRouteCommand,
} from "../src/vnState.ts";

test("stable IDs survive unrelated insertions", () => {
  const line = { kind: "line", chapterId: "chapter-01", act: "第一幕：黎明", speaker: "锐", text: "你好" };
  const first = attachStableIds([line])[0];
  const second = attachStableIds([{ kind: "line", act: "序章", text: "新增" }, line])[1];
  assert.equal(first.lineId, second.lineId);
  assert.equal(first.chapterId, second.chapterId);
  assert.equal(first.lineId, attachStableIds([{ ...line, act: "第一幕：标题已修改" }])[0].lineId);
  assert.notEqual(first.lineId, attachStableIds([{ ...line, text: "内容已修改" }])[0].lineId);
});

test("skip always stops at unread, choice, chapter and CG boundaries", () => {
  assert.equal(canSkipLine({ kind: "line" }, false, false), false);
  assert.equal(canSkipLine({ kind: "line" }, true, false), true);
  assert.equal(canSkipLine({ kind: "line" }, false, true), true);
  assert.equal(canSkipLine({ kind: "title" }, true, true), false);
  assert.equal(canSkipLine({ kind: "choice" }, true, true), false);
  assert.equal(canSkipLine({ kind: "line", cg: "关键画面" }, true, true), false);
});

test("progress migration and merge never discard permanent unlocks", () => {
  const migrated = migrateProgress({ schemaVersion: 1, readLineIds: ["line-a"], unlockedCgs: ["cg-a"] }, "chapter-a");
  const marked = markProgress(migrated, { lineId: "line-b", chapterId: "chapter-b", cgId: "cg-b" });
  const merged = mergeProgress(marked, createDefaultProgress("chapter-c"));
  assert.deepEqual(new Set(merged.seenLineIds), new Set(["line-a", "line-b"]));
  assert.deepEqual(new Set(merged.unlockedChapterIds), new Set(["chapter-a", "chapter-b", "chapter-c"]));
  assert.deepEqual(new Set(merged.unlockedCgIds), new Set(["cg-a", "cg-b"]));
});

test("route commands change flags and produce jumps", () => {
  let state = createEmptyRouteState();
  const set = parseRouteCommand("@set trust=2");
  assert.ok(set);
  state = applyRouteCommand(state, set).routeState;
  const inc = parseRouteCommand("@inc trust=3");
  assert.ok(inc);
  state = applyRouteCommand(state, inc).routeState;
  assert.equal(state.flags.trust, 5);
  const condition = parseRouteCommand("@if trust=5 -> good_end");
  assert.ok(condition);
  assert.equal(applyRouteCommand(state, condition).jumpLabel, "good_end");
});

test("rollback is capped and restores choice state without touching progress", () => {
  const stack = new RollbackStack(2);
  stack.push({ index: 1, logLength: 1, act: "A", bgmName: "one", routeState: createEmptyRouteState() });
  stack.push({ index: 2, logLength: 2, act: "A", bgmName: "two", routeState: { flags: { chose: true }, choices: [] } });
  stack.push({ index: 3, logLength: 3, act: "A", bgmName: "three", routeState: { flags: { chose: false }, choices: [] } });
  assert.equal(stack.size, 2);
  assert.equal(stack.pop()?.index, 3);
  assert.equal(stack.pop()?.index, 2);
});
