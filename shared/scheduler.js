export function toDateKey(date) {
  const localDate = new Date(date);
  return `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;
}

export const intervals = [1, 3, 7, 14, 30, 60];

export function getNextReviewDate(today, repetitions) {
  const step = Math.min(Math.max(0, repetitions), intervals.length - 1);
  return addDays(today, intervals[step]);
}

export function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/**
 * Compares two due problems to ensure fair, equal revision priority.
 * Prevents starvation and prevents repeatedly revising the same problems:
 * 1. Earliest due date (overdue urgency)
 * 2. Least recently touched/reviewed (problems not seen in longest time get priority)
 * 3. Lowest repetitions (problems with fewer reviews get reinforced first)
 * 4. Stable catalog ID order (prevents alphabetical starvation of problems)
 */
export function compareDueProblems(left, right, today = null) {
  // 1. Due date / overdue urgency
  const leftDue = left.nextReview || (today || "9999-12-31");
  const rightDue = right.nextReview || (today || "9999-12-31");
  const dueDiff = leftDue.localeCompare(rightDue);
  if (dueDiff !== 0) return dueDiff;

  // 2. Least recently reviewed / touched (oldest date first)
  const leftTouched =
    left.lastReviewed || left.lastSolvedAt || left.solvedAt || "1970-01-01";
  const rightTouched =
    right.lastReviewed || right.lastSolvedAt || right.solvedAt || "1970-01-01";
  const touchDiff = leftTouched.localeCompare(rightTouched);
  if (touchDiff !== 0) return touchDiff;

  // 3. Lowest repetitions first
  const leftReps = typeof left.repetitions === "number" ? left.repetitions : 0;
  const rightReps =
    typeof right.repetitions === "number" ? right.repetitions : 0;
  if (leftReps !== rightReps) return leftReps - rightReps;

  // 4. Stable ID order
  const leftId = Number(left.id) || 0;
  const rightId = Number(right.id) || 0;
  if (leftId !== rightId) return leftId - rightId;

  return (left.title || "").localeCompare(right.title || "");
}

export function getDueReviews(problems, today, limit = 2) {
  if (limit <= 0) return [];
  return problems
    .filter(
      (problem) =>
        problem.status !== "new" &&
        problem.nextReview &&
        problem.nextReview <= today,
    )
    .sort((left, right) => compareDueProblems(left, right, today))
    .slice(0, limit);
}

/**
 * Builds the review schedule synchronized with the dashboard:
 * - Today's schedule includes problems already reviewed today (up to dailyLimit).
 * - Any remaining slots today are filled with the top due problems.
 * - Remaining overdue problems roll forward to tomorrow and subsequent days, capped at dailyLimit.
 * - Future problems are scheduled starting on their nextReview date, rolling forward when full.
 */
export function buildReviewSchedule(
  problems,
  today,
  days = 42,
  dailyLimit = 2,
) {
  const endDate = addDays(today, days - 1);
  const schedule = {};

  // 1. Seed today with problems already reviewed today
  const reviewedToday = problems.filter((p) => p.lastReviewed === today);
  if (reviewedToday.length > 0) {
    schedule[today] = [...reviewedToday.slice(0, dailyLimit)];
  }

  const remainingTodaySlots = Math.max(
    0,
    dailyLimit - (schedule[today]?.length ?? 0),
  );

  // 2. Candidates not reviewed today
  const candidates = problems.filter(
    (problem) =>
      problem.status !== "new" &&
      problem.nextReview &&
      problem.lastReviewed !== today,
  );

  // Overdue candidates (<= today)
  const overdueCandidates = candidates
    .filter((p) => p.nextReview <= today)
    .sort((left, right) => compareDueProblems(left, right, today));

  // Future candidates (> today)
  const futureCandidates = candidates
    .filter((p) => p.nextReview > today)
    .sort((left, right) => compareDueProblems(left, right, today));

  // 3. Fill today's remaining slots with the highest-priority overdue problems
  if (remainingTodaySlots > 0 && overdueCandidates.length > 0) {
    const dueForToday = overdueCandidates.slice(0, remainingTodaySlots);
    schedule[today] = [...(schedule[today] ?? []), ...dueForToday];
  }

  // 4. Roll remaining overdue problems forward starting tomorrow
  const remainingOverdue = overdueCandidates.slice(remainingTodaySlots);
  for (const problem of remainingOverdue) {
    let scheduledFor = addDays(today, 1);
    while ((schedule[scheduledFor]?.length ?? 0) >= dailyLimit) {
      scheduledFor = addDays(scheduledFor, 1);
    }
    if (scheduledFor <= endDate) {
      schedule[scheduledFor] = [...(schedule[scheduledFor] ?? []), problem];
    }
  }

  // 5. Future candidates placed on their nextReview date, rolling forward when full
  for (const problem of futureCandidates) {
    let scheduledFor = problem.nextReview;
    while ((schedule[scheduledFor]?.length ?? 0) >= dailyLimit) {
      scheduledFor = addDays(scheduledFor, 1);
    }
    if (scheduledFor <= endDate) {
      schedule[scheduledFor] = [...(schedule[scheduledFor] ?? []), problem];
    }
  }

  return schedule;
}

export function calculateStreak(activity, today) {
  let offset = activity[today] > 0 ? 0 : 1;
  let streak = 0;
  while (activity[addDays(today, -offset)] > 0) {
    streak += 1;
    offset += 1;
  }
  return streak;
}

export function buildHeatmap(activity, today, days = 84) {
  const entries = Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index - days + 1);
    return { date, count: activity[date] ?? 0 };
  });
  const maxCount = Math.max(...entries.map((entry) => entry.count), 1);
  return entries.map((entry, index) => ({
    ...entry,
    index,
    level:
      entry.count === 0
        ? 0
        : Math.min(4, Math.ceil((entry.count / maxCount) * 4)),
  }));
}
