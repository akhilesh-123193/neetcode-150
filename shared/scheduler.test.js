import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  buildHeatmap,
  buildReviewSchedule,
  calculateStreak,
  getDueReviews,
  getNextReviewDate,
  intervals,
} from "./scheduler.js";
import {
  mergeProblems,
  mergeActivity,
  isServerMissingProgress,
} from "./dataMerge.js";

const today = "2026-09-23";
const problem = (id, nextReview, status = "review") => ({
  id,
  title: `Problem ${id}`,
  status,
  nextReview,
});

test("prioritizes only the two oldest due reviews", () => {
  const due = getDueReviews(
    [
      problem(1, "2026-09-21"),
      problem(2, "2026-09-22"),
      problem(3, today),
      problem(4, today, "new"),
    ],
    today,
  );
  assert.deepEqual(
    due.map((item) => item.id),
    [1, 2],
  );
});

test("includes a first scheduled review after a problem is solved", () => {
  const due = getDueReviews([problem(1, today, "learning")], today);
  assert.equal(due[0].id, 1);
});

test("schedules overdue and future reviews within a two-item daily cap", () => {
  const schedule = buildReviewSchedule(
    [
      problem(1, "2026-09-20"),
      problem(2, "2026-09-20"),
      problem(3, "2026-09-21"),
      problem(4, "2026-09-24"),
    ],
    today,
    4,
  );
  assert.deepEqual(
    schedule[today].map((item) => item.id),
    [1, 2],
  );
  assert.deepEqual(
    schedule[addDays(today, 1)].map((item) => item.id),
    [3, 4],
  );
  assert.ok(Object.values(schedule).every((items) => items.length <= 2));
});

test("counts a streak from saved activity instead of a placeholder", () => {
  assert.equal(
    calculateStreak(
      { "2026-09-23": 3, "2026-09-22": 1, "2026-09-21": 2 },
      today,
    ),
    3,
  );
  assert.equal(calculateStreak({ "2026-09-22": 1, "2026-09-20": 1 }, today), 1);
});

test("uses actual activity values for heatmap intensity", () => {
  const heatmap = buildHeatmap({ "2026-09-22": 1, "2026-09-23": 4 }, today, 2);
  assert.deepEqual(
    heatmap.map((item) => item.level),
    [1, 4],
  );
});

test("calculates accurate next review dates without UTC timezone shift", () => {
  assert.equal(getNextReviewDate(today, 0), "2026-09-24"); // 1d
  assert.equal(getNextReviewDate(today, 1), "2026-09-26"); // 3d
  assert.equal(getNextReviewDate(today, 2), "2026-09-30"); // 7d
  assert.equal(getNextReviewDate(today, 3), "2026-10-07"); // 14d
  assert.equal(getNextReviewDate(today, 4), "2026-10-23"); // 30d
});

test("caps maximum interval at the last defined repetition interval", () => {
  const maxInterval = intervals[intervals.length - 1];
  assert.equal(getNextReviewDate(today, 10), addDays(today, maxInterval));
});

test("accurately retrieves solve history and last solved date", async () => {
  const { getSolveHistory, getLastSolvedDate } = await import(
    "./neetcode150.js"
  );
  assert.deepEqual(getSolveHistory({}), []);
  assert.equal(getLastSolvedDate({}), null);

  // Backward-compatibility: problem has solvedAt but no solveHistory array
  const legacyProb = { solvedAt: "2026-09-20" };
  assert.deepEqual(getSolveHistory(legacyProb), ["2026-09-20"]);
  assert.equal(getLastSolvedDate(legacyProb), "2026-09-20");

  // Modern problem with multiple solve dates
  const multiProb = {
    solveHistory: ["2026-09-15", "2026-09-20", "2026-09-28"],
  };
  assert.deepEqual(getSolveHistory(multiProb), [
    "2026-09-15",
    "2026-09-20",
    "2026-09-28",
  ]);
  assert.equal(getLastSolvedDate(multiProb), "2026-09-28");
});

test("provides full NeetCode 150 and SQL 50 catalogs with distinct tracks", async () => {
  const { starterProblems, dsaStarterProblems } = await import("./neetcode150.js");
  const { sql50StarterProblems } = await import("./sql50.js");

  assert.equal(dsaStarterProblems.length, 150);
  assert.equal(sql50StarterProblems.length, 50);
  assert.equal(starterProblems.length, 200);

  assert.ok(dsaStarterProblems.every((p) => p.track === "dsa"));
  assert.ok(sql50StarterProblems.every((p) => p.track === "sql"));
  assert.ok(sql50StarterProblems.every((p) => p.id >= 1001 && p.id <= 1050));
});

test("supports independent 2-problem daily revision caps for DSA and SQL tracks", () => {
  const dsaUnreviewed = [
    { id: 1, track: "dsa", nextReview: "2026-09-20", status: "review" },
    { id: 2, track: "dsa", nextReview: "2026-09-21", status: "review" },
    { id: 3, track: "dsa", nextReview: "2026-09-22", status: "review" },
  ];
  const sqlUnreviewed = [
    { id: 1001, track: "sql", nextReview: "2026-09-20", status: "review" },
    { id: 1002, track: "sql", nextReview: "2026-09-21", status: "review" },
    { id: 1003, track: "sql", nextReview: "2026-09-22", status: "review" },
  ];

  const dueDsa = getDueReviews(dsaUnreviewed, today, 2);
  const dueSql = getDueReviews(sqlUnreviewed, today, 2);

  assert.equal(dueDsa.length, 2);
  assert.deepEqual(dueDsa.map((p) => p.id), [1, 2]);

  assert.equal(dueSql.length, 2);
  assert.deepEqual(dueSql.map((p) => p.id), [1001, 1002]);
});

test("preserves local solves and notes when server returns blank starter problems after git push / redeploy", async () => {
  const { starterProblems } = await import("./neetcode150.js");

  // User has solved "Two Sum" and added notes in their browser localStorage
  const localProblems = [
    {
      id: 1,
      title: "Two Sum",
      track: "dsa",
      status: "review",
      repetitions: 2,
      solvedAt: "2026-09-28",
      solveHistory: ["2026-09-25", "2026-09-28"],
      lastReviewed: "2026-09-28",
      nextReview: "2026-10-05",
      pythonCode: "class Solution: def twoSum(self, nums, target): return [0, 1]",
      notes: "Hash map lookup",
    },
    {
      id: 1001,
      title: "Recyclable and Low Fat Products",
      track: "sql",
      status: "learning",
      repetitions: 0,
      solvedAt: "2026-09-28",
      solveHistory: ["2026-09-28"],
      nextReview: "2026-09-29",
      sqlCode: "SELECT product_id FROM Products WHERE low_fats = 'Y' AND recyclable = 'Y';",
      notes: "Simple filter",
    },
  ];

  // A fresh server restart / git push / redeploy returns untouched starter problems (all "new", solvedAt: null)
  const serverProblems = starterProblems;

  // Merge must preserve the user's progress
  const merged = mergeProblems(serverProblems, localProblems, starterProblems);

  const twoSum = merged.find((p) => p.title === "Two Sum");
  assert.equal(twoSum.status, "review");
  assert.equal(twoSum.repetitions, 2);
  assert.equal(twoSum.solvedAt, "2026-09-28");
  assert.deepEqual(twoSum.solveHistory, ["2026-09-25", "2026-09-28"]);
  assert.equal(twoSum.lastReviewed, "2026-09-28");
  assert.equal(twoSum.nextReview, "2026-10-05");
  assert.equal(twoSum.notes, "Hash map lookup");
  assert.ok(twoSum.pythonCode.includes("twoSum"));

  const sqlProb = merged.find((p) => p.title === "Recyclable and Low Fat Products");
  assert.equal(sqlProb.status, "learning");
  assert.equal(sqlProb.solvedAt, "2026-09-28");
  assert.equal(sqlProb.nextReview, "2026-09-29");
  assert.ok(sqlProb.sqlCode.includes("SELECT product_id"));

  // Detect that server is missing this progress so client knows to heal server
  assert.equal(isServerMissingProgress(serverProblems, merged), true);

  // Activity merge test: empty server activity must not wipe local activity
  const mergedAct = mergeActivity({}, { "2026-09-28": 3, "2026-09-29": 1 });
  assert.equal(mergedAct["2026-09-28"], 3);
  assert.equal(mergedAct["2026-09-29"], 1);
});
