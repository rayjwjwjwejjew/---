import assert from "node:assert/strict";
import test from "node:test";
import { assertBackupHeader } from "../src/vnBackupSchema.ts";

test("backup validation rejects unrelated and future files", () => {
  assert.throws(() => assertBackupHeader({ format: "other", schemaVersion: 3 }, 3), /不是本项目/);
  assert.throws(() => assertBackupHeader({ format: "soul-returns-vn-backup", schemaVersion: 99, saveSlots: [] }, 3), /版本高于/);
});

test("backup validation accepts compatible versioned data", () => {
  const backup = assertBackupHeader({
    format: "soul-returns-vn-backup",
    schemaVersion: 2,
    saveSlots: [],
    settings: { typeMs: 25 },
  }, 3);
  assert.equal(backup.schemaVersion, 2);
  assert.deepEqual(backup.saveSlots, []);
});

test("backup validation rejects malformed saves and bindings before import", () => {
  assert.throws(() => assertBackupHeader({
    format: "soul-returns-vn-backup",
    schemaVersion: 3,
    saveSlots: [{ index: "bad", log: [] }],
  }, 3), /存档结构损坏/);
  assert.throws(() => assertBackupHeader({
    format: "soul-returns-vn-backup",
    schemaVersion: 3,
    saveSlots: [],
    voiceBindings: { "line-a": 42 },
  }, 3), /voiceBindings/);
});
