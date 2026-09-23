import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  buildHeatmap,
  buildReviewSchedule,
  calculateStreak,
  getDueReviews,
} from "./scheduler.js";

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
