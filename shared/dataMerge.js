/**
 * Determines whether a problem has been solved or touched by the user.
 */
export function isProblemSolved(p) {
  if (!p) return false;
  return Boolean(
    (p.status && p.status !== "new") ||
      p.solvedAt ||
      p.lastSolvedAt ||
      (Array.isArray(p.solveHistory) && p.solveHistory.length > 0) ||
      (typeof p.repetitions === "number" && p.repetitions > 0)
  );
}

/**
 * Determines whether a problem has any user-entered notes, solution code, or planned status.
 */
export function hasUserContent(p) {
  if (!p) return false;
  return Boolean(
    (p.notes && p.notes.trim()) ||
      (p.sqlCode && p.sqlCode.trim()) ||
      (p.pythonCode && p.pythonCode.trim()) ||
      (p.timeComplexity && p.timeComplexity.trim()) ||
      (p.spaceComplexity && p.spaceComplexity.trim()) ||
      p.plannedDate
  );
}

/**
 * Merges a single problem from server and local storage against the default starter problem.
 * Ensures that if local storage has solves or user notes, they are NEVER overwritten by an
 * untouched starter problem from a fresh server restart or redeploy.
 */
export function mergeSingleProblem(serverProb, localProb, defaultProb) {
  const isServerSolved = isProblemSolved(serverProb);
  const isLocalSolved = isProblemSolved(localProb);

  const localHasContent = hasUserContent(localProb);
  const serverHasContent = hasUserContent(serverProb);

  // If local has solved data or user content, but server is just default untouched starter:
  // LOCAL ALWAYS WINS!
  if ((isLocalSolved || localHasContent) && !isServerSolved && !serverHasContent) {
    const history =
      Array.isArray(localProb.solveHistory) && localProb.solveHistory.length > 0
        ? localProb.solveHistory
        : localProb.solvedAt
          ? [localProb.solvedAt]
          : [];
    return {
      ...defaultProb,
      ...localProb,
      track:
        defaultProb.track ||
        localProb.track ||
        (defaultProb.id > 1000 ? "sql" : "dsa"),
      url: defaultProb.url || localProb.url,
      solveHistory: history,
      solvedAt:
        localProb.solvedAt || (history.length > 0 ? history[history.length - 1] : null),
      lastSolvedAt:
        localProb.lastSolvedAt ||
        localProb.solvedAt ||
        (history.length > 0 ? history[history.length - 1] : null),
      status: localProb.status || (history.length > 0 ? "learning" : "new"),
      repetitions: localProb.repetitions || 0,
      nextReview: localProb.nextReview || null,
      lastReviewed: localProb.lastReviewed || null,
      lastReviewQuality: localProb.lastReviewQuality || null,
      plannedDate: localProb.plannedDate || null,
      sqlCode: localProb.sqlCode || serverProb?.sqlCode || "",
      pythonCode: localProb.pythonCode || serverProb?.pythonCode || "",
      timeComplexity: localProb.timeComplexity || serverProb?.timeComplexity || "",
      spaceComplexity:
        localProb.spaceComplexity || serverProb?.spaceComplexity || "",
      notes: localProb.notes || serverProb?.notes || "",
    };
  }

  // If server has solved data or content, but local has neither (e.g. fresh device or cleared local storage):
  // SERVER WINS!
  if ((isServerSolved || serverHasContent) && !isLocalSolved && !localHasContent) {
    const history =
      Array.isArray(serverProb.solveHistory) && serverProb.solveHistory.length > 0
        ? serverProb.solveHistory
        : serverProb.solvedAt
          ? [serverProb.solvedAt]
          : [];
    return {
      ...defaultProb,
      ...serverProb,
      track:
        defaultProb.track ||
        serverProb.track ||
        (defaultProb.id > 1000 ? "sql" : "dsa"),
      url: defaultProb.url || serverProb.url,
      solveHistory: history,
      solvedAt:
        serverProb.solvedAt || (history.length > 0 ? history[history.length - 1] : null),
      lastSolvedAt:
        serverProb.lastSolvedAt ||
        serverProb.solvedAt ||
        (history.length > 0 ? history[history.length - 1] : null),
      status: serverProb.status || (history.length > 0 ? "learning" : "new"),
      repetitions: serverProb.repetitions || 0,
      nextReview: serverProb.nextReview || null,
      lastReviewed: serverProb.lastReviewed || null,
      lastReviewQuality: serverProb.lastReviewQuality || null,
      plannedDate: serverProb.plannedDate || null,
      sqlCode: serverProb.sqlCode || localProb?.sqlCode || "",
      pythonCode: serverProb.pythonCode || localProb?.pythonCode || "",
      timeComplexity: serverProb.timeComplexity || localProb?.timeComplexity || "",
      spaceComplexity:
        serverProb.spaceComplexity || localProb?.spaceComplexity || "",
      notes: serverProb.notes || localProb?.notes || "",
    };
  }

  // If BOTH have data: union their solve history, preserve highest repetition & latest review
  const sHistory = Array.isArray(serverProb?.solveHistory)
    ? serverProb.solveHistory
    : serverProb?.solvedAt
      ? [serverProb.solvedAt]
      : [];
  const lHistory = Array.isArray(localProb?.solveHistory)
    ? localProb.solveHistory
    : localProb?.solvedAt
      ? [localProb.solvedAt]
      : [];
  const combinedHistory = Array.from(new Set([...sHistory, ...lHistory])).sort();
  const lastSolved =
    combinedHistory[combinedHistory.length - 1] ||
    serverProb?.lastSolvedAt ||
    localProb?.lastSolvedAt ||
    null;

  const maxReps = Math.max(serverProb?.repetitions || 0, localProb?.repetitions || 0);

  // Status: if repetitions >= 4, mastered. Otherwise if either is review/learning, preserve it
  let status = defaultProb.status || "new";
  if (combinedHistory.length > 0 || isServerSolved || isLocalSolved) {
    if (
      maxReps >= 4 ||
      serverProb?.status === "mastered" ||
      localProb?.status === "mastered"
    ) {
      status = "mastered";
    } else if (
      serverProb?.status === "review" ||
      localProb?.status === "review"
    ) {
      status = "review";
    } else {
      status = "learning";
    }
  }

  // Last reviewed date: keep whichever is more recent or non-null
  const lastReviewed =
    (serverProb?.lastReviewed && localProb?.lastReviewed
      ? serverProb.lastReviewed > localProb.lastReviewed
        ? serverProb.lastReviewed
        : localProb.lastReviewed
      : localProb?.lastReviewed || serverProb?.lastReviewed) || null;

  const lastReviewQuality =
    localProb?.lastReviewQuality || serverProb?.lastReviewQuality || null;
  const nextReview = localProb?.nextReview || serverProb?.nextReview || null;
  const plannedDate = localProb?.plannedDate || serverProb?.plannedDate || null;

  return {
    ...defaultProb,
    ...serverProb,
    ...localProb,
    status,
    repetitions: maxReps,
    solvedAt: lastSolved,
    lastSolvedAt: lastSolved,
    solveHistory: combinedHistory,
    lastReviewed,
    lastReviewQuality,
    nextReview,
    plannedDate,
    track:
      defaultProb.track ||
      localProb?.track ||
      serverProb?.track ||
      (defaultProb.id > 1000 ? "sql" : "dsa"),
    url: defaultProb.url || localProb?.url || serverProb?.url,
    sqlCode: localProb?.sqlCode || serverProb?.sqlCode || defaultProb.sqlCode || "",
    pythonCode:
      localProb?.pythonCode || serverProb?.pythonCode || defaultProb.pythonCode || "",
    timeComplexity:
      localProb?.timeComplexity ||
      serverProb?.timeComplexity ||
      defaultProb.timeComplexity ||
      "",
    spaceComplexity:
      localProb?.spaceComplexity ||
      serverProb?.spaceComplexity ||
      defaultProb.spaceComplexity ||
      "",
    notes: localProb?.notes || serverProb?.notes || defaultProb.notes || "",
  };
}

/**
 * Merges server problems, local problems, and starter problems without data loss.
 */
export function mergeProblems(serverProblems, localProblems, starterProblems) {
  const serverMap = new Map((serverProblems || []).map((p) => [p.title, p]));
  const localMap = new Map((localProblems || []).map((p) => [p.title, p]));

  return starterProblems.map((prob) => {
    const sProb = serverMap.get(prob.title);
    const lProb = localMap.get(prob.title);
    return mergeSingleProblem(sProb, lProb, prob);
  });
}

/**
 * Merges server and local activity safely by taking the max actions per date.
 */
export function mergeActivity(serverActivity, localActivity) {
  const merged = { ...(localActivity || {}) };
  for (const [date, count] of Object.entries(serverActivity || {})) {
    merged[date] = Math.max(
      merged[date] || 0,
      typeof count === "number" ? count : 0,
    );
  }
  return merged;
}

/**
 * Checks if merged data contains progress that the server is missing.
 */
export function isServerMissingProgress(serverProblems, mergedProblems) {
  if (!serverProblems || serverProblems.length === 0) return true;
  const serverMap = new Map(serverProblems.map((p) => [p.title, p]));
  for (const m of mergedProblems) {
    if (isProblemSolved(m) || hasUserContent(m)) {
      const s = serverMap.get(m.title);
      if (!s || !isProblemSolved(s)) return true;
      if (m.solveHistory?.length > (s.solveHistory?.length || 0)) return true;
      if (m.repetitions > (s.repetitions || 0)) return true;
      if ((m.notes && !s.notes) || (m.sqlCode && !s.sqlCode) || (m.pythonCode && !s.pythonCode)) return true;
    }
  }
  return false;
}
