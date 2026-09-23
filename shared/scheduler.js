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

export function getDueReviews(problems, today, limit = 2) {
  return problems
    .filter(
      (problem) =>
        problem.status !== "new" &&
        problem.nextReview &&
        problem.nextReview <= today,
    )
    .sort(
      (left, right) =>
        left.nextReview.localeCompare(right.nextReview) ||
        left.title.localeCompare(right.title),
    )
    .slice(0, limit);
}

export function buildReviewSchedule(
  problems,
  today,
  days = 42,
  dailyLimit = 2,
) {
  const endDate = addDays(today, days - 1);
  const schedule = {};
  const candidates = problems
    .filter((problem) => problem.status !== "new" && problem.nextReview)
    .sort(
      (left, right) =>
        left.nextReview.localeCompare(right.nextReview) ||
        left.title.localeCompare(right.title),
    );

  for (const problem of candidates) {
    let scheduledFor = problem.nextReview < today ? today : problem.nextReview;
    while ((schedule[scheduledFor]?.length ?? 0) >= dailyLimit)
      scheduledFor = addDays(scheduledFor, 1);
    if (scheduledFor > endDate) continue;
    schedule[scheduledFor] = [...(schedule[scheduledFor] ?? []), problem];
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
