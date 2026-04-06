const test = require("node:test");
const assert = require("node:assert/strict");

const { computeDelta, formatDelta } = require("../lib/dates.js");
const { mergeWorkHistory } = require("../background/background.js");

function snapshot(capturedAt, values) {
  return {
    capturedAt,
    hits: values.hits,
    kudos: values.kudos,
    bookmarks: values.bookmarks,
    comments: values.comments
  };
}

function buildHistory(entries) {
  return entries.map(([capturedAt, hits, kudos = 0, bookmarks = 0, comments = 0]) =>
    snapshot(capturedAt, { hits, kudos, bookmarks, comments })
  );
}

function work(values = {}) {
  return {
    workId: values.workId || "42",
    title: values.title || "Example Work",
    url: values.url || "https://archiveofourown.org/works/42",
    fandom: values.fandom || "Example Fandom",
    updatedAt: values.updatedAt || "",
    hits: values.hits ?? 0,
    kudos: values.kudos ?? 0,
    bookmarks: values.bookmarks ?? 0,
    comments: values.comments ?? 0
  };
}

test("computeDelta returns null for empty or single-snapshot history", () => {
  assert.equal(computeDelta([], "hits", 1), null);
  assert.equal(computeDelta(buildHistory([["2026-04-06T12:00:00.000Z", 10]]), "hits", 1), null);
});

test("computeDelta uses the snapshot at or before the 24h boundary", () => {
  const history = buildHistory([
    ["2026-04-01T12:00:00.000Z", 70],
    ["2026-04-05T11:00:00.000Z", 80],
    ["2026-04-05T12:00:00.000Z", 81],
    ["2026-04-05T18:00:00.000Z", 82],
    ["2026-04-06T12:00:00.000Z", 84]
  ]);

  assert.equal(computeDelta(history, "hits", 1), 3);
});

test("computeDelta uses different baselines for 24h and 7d when history supports it", () => {
  const history = buildHistory([
    ["2026-03-29T12:00:00.000Z", 50, 1, 0, 0],
    ["2026-04-03T12:00:00.000Z", 77, 4, 0, 32],
    ["2026-04-05T12:00:00.000Z", 81, 4, 0, 32],
    ["2026-04-06T12:00:00.000Z", 84, 5, 0, 33]
  ]);

  assert.equal(computeDelta(history, "hits", 1), 3);
  assert.equal(computeDelta(history, "hits", 7), 34);
  assert.equal(computeDelta(history, "kudos", 7), 4);
  assert.equal(computeDelta(history, "comments", 7), 33);
});

test("computeDelta falls back to the earliest previous snapshot if the full window is not available yet", () => {
  const history = buildHistory([
    ["2026-04-06T10:00:00.000Z", 77],
    ["2026-04-06T12:00:00.000Z", 78]
  ]);

  assert.equal(computeDelta(history, "hits", 1), 1);
  assert.equal(computeDelta(history, "hits", 7), 1);
});

test("computeDelta returns zero when snapshots exist but the metric did not change", () => {
  const history = buildHistory([
    ["2026-04-05T12:00:00.000Z", 84, 5, 0, 33],
    ["2026-04-06T12:00:00.000Z", 84, 5, 0, 33]
  ]);

  assert.equal(computeDelta(history, "hits", 1), 0);
  assert.equal(computeDelta(history, "kudos", 1), 0);
  assert.equal(computeDelta(history, "comments", 1), 0);
});

test("mergeWorkHistory appends a new refresh even when stats are unchanged", () => {
  const existingWork = {
    history: buildHistory([
      ["2026-04-05T12:00:00.000Z", 84, 5, 0, 33]
    ])
  };

  const merged = mergeWorkHistory(
    existingWork,
    work({ hits: 84, kudos: 5, bookmarks: 0, comments: 33 }),
    "2026-04-06T12:00:00.000Z"
  );

  assert.equal(merged.history.length, 2);
  assert.deepEqual(merged.history[1], snapshot("2026-04-06T12:00:00.000Z", { hits: 84, kudos: 5, bookmarks: 0, comments: 33 }));
});

test("mergeWorkHistory does not duplicate a snapshot with the exact same capturedAt", () => {
  const existingWork = {
    history: buildHistory([
      ["2026-04-06T12:00:00.000Z", 84, 5, 0, 33]
    ])
  };

  const merged = mergeWorkHistory(
    existingWork,
    work({ hits: 84, kudos: 5, bookmarks: 0, comments: 33 }),
    "2026-04-06T12:00:00.000Z"
  );

  assert.equal(merged.history.length, 1);
});

test("formatDelta handles null, zero, and positive values consistently", () => {
  assert.equal(formatDelta(null), "-");
  assert.equal(formatDelta(0), "0");
  assert.equal(formatDelta(7), "+7");
});
