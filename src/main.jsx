import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  Bell,
  BrainCircuit,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleHelp,
  Clock,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  Filter,
  Flame,
  Grid2X2,
  History,
  Home,
  Layers3,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Trophy,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import {
  addDays,
  buildHeatmap,
  buildReviewSchedule,
  calculateStreak,
  getDueReviews,
  getNextReviewDate,
  intervals,
} from "../shared/scheduler.js";
import {
  dsaCatalog,
  dsaStarterProblems,
  getLastSolvedDate,
  getLeetCodeUrl,
  getSolveHistory,
  starterProblems,
} from "../shared/neetcode150.js";
import {
  getSqlLeetCodeUrl,
  sql50Catalog,
  sql50StarterProblems,
  sqlTopics,
} from "../shared/sql50.js";
import {
  mergeProblems,
  mergeActivity,
  isServerMissingProgress,
} from "../shared/dataMerge.js";
import "./styles.css";

function loadInitialProblems() {
  try {
    const saved = localStorage.getItem("recall-problems-v1");
    const backup = localStorage.getItem("recall-problems-backup-v1");
    const toParse = saved || backup;
    if (toParse) {
      const parsed = JSON.parse(toParse);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return mergeProblems([], parsed, starterProblems);
      }
    }
  } catch {}
  return starterProblems;
}

function loadInitialActivity() {
  try {
    const saved = localStorage.getItem("recall-activity-v1");
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return {};
}

const dsaTopics = [
  "All topics",
  "Arrays & Hashing",
  "Two Pointers",
  "Sliding Window",
  "Stack",
  "Binary Search",
  "Linked List",
  "Trees",
  "Tries",
  "Heap / Priority Queue",
  "Backtracking",
  "Graphs",
  "Advanced Graphs",
  "1-D Dynamic Programming",
  "2-D Dynamic Programming",
  "Greedy",
  "Intervals",
  "Math & Geometry",
  "Bit Manipulation",
];

const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const displayToday = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
})
  .format(new Date())
  .toUpperCase();

const formatDate = (date) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(`${date}T12:00:00`),
  );
};

const formatFullDate = (date) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
};

const formatRelativeDays = (dateStr, refDateStr) => {
  if (!dateStr) return "";
  const d1 = new Date(`${dateStr}T12:00:00`);
  const d2 = new Date(`${refDateStr}T12:00:00`);
  const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1) return `${diffDays} days ago`;
  if (diffDays === -1) return "Tomorrow";
  return `in ${Math.abs(diffDays)} days`;
};

function App() {
  const [problems, setProblems] = useState(loadInitialProblems);
  const [activity, setActivity] = useState(loadInitialActivity);
  const [activePage, setActivePage] = useState("Dashboard");
  const [dsaTopicFilter, setDsaTopicFilter] = useState("All topics");
  const [sqlTopicFilter, setSqlTopicFilter] = useState("All topics");
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dashboardTrack, setDashboardTrack] = useState("all");
  const [calendarTrack, setCalendarTrack] = useState("all");
  const [activeNotesProblem, setActiveNotesProblem] = useState(null);
  const [historyModalProblem, setHistoryModalProblem] = useState(null);
  const [expandedNotesId, setExpandedNotesId] = useState(null);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [dark, setDark] = useState(
    () => localStorage.getItem("recall-theme") === "dark",
  );

  const toastTimer = useRef(null);

  function showToast(message, action = null, duration = 6000) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, action });
    toastTimer.current = setTimeout(() => setToast(null), duration);
  }

  // Resilient, non-destructive initial state sync
  useEffect(() => {
    fetch("/api/state")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load your study data");
        return response.json();
      })
      .then((data) => {
        if (Array.isArray(data.problems) && data.problems.length > 0) {
          setProblems((currentLocalItems) => {
            // Merge without ever wiping local solved progress with untouched server problems
            const merged = mergeProblems(data.problems, currentLocalItems, starterProblems);
            try {
              localStorage.setItem("recall-problems-v1", JSON.stringify(merged));
              localStorage.setItem("recall-problems-backup-v1", JSON.stringify(merged));
            } catch {}

            // Self-healing: if the server was restarted or deployed fresh, restore data to server
            if (isServerMissingProgress(data.problems, merged)) {
              const currentLocalAct = loadInitialActivity();
              const mergedAct = mergeActivity(data.activity, currentLocalAct);
              fetch("/api/state", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  problems: merged,
                  activity: mergedAct,
                }),
              }).catch(() => {});
            }

            return merged;
          });
        }
        if (data.activity && typeof data.activity === "object") {
          setActivity((currentLocalActivity) => {
            const mergedAct = mergeActivity(data.activity, currentLocalActivity);
            try {
              localStorage.setItem("recall-activity-v1", JSON.stringify(mergedAct));
            } catch {}
            return mergedAct;
          });
        }
      })
      .catch(() => {
        // Offline fallback: keep local storage seamlessly
      });
  }, []);

  useEffect(() => {
    localStorage.setItem("recall-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const searchInput = document.querySelector(".search input");
        if (searchInput) searchInput.focus();
      } else if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "z" &&
        !event.shiftKey
      ) {
        if (undoStack.length > 0) {
          event.preventDefault();
          undoSpecificAction(undoStack[0]);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoStack]);

  const dailyCap = 2;

  // Separate track partitions
  const dsaProblems = useMemo(
    () => problems.filter((p) => p.track !== "sql"),
    [problems],
  );
  const sqlProblems = useMemo(
    () => problems.filter((p) => p.track === "sql"),
    [problems],
  );

  // Independent DSA revision metrics (2/day cap)
  const reviewedTodayDsa = useMemo(
    () => dsaProblems.filter((p) => p.lastReviewed === today),
    [dsaProblems],
  );
  const completedTodayCountDsa = reviewedTodayDsa.length;
  const remainingSlotsDsa = Math.max(0, dailyCap - completedTodayCountDsa);
  const dueDsa = useMemo(() => {
    const unreviewed = dsaProblems.filter((p) => p.lastReviewed !== today);
    return getDueReviews(unreviewed, today, remainingSlotsDsa);
  }, [dsaProblems, remainingSlotsDsa]);
  const todayPlanDsa = useMemo(
    () =>
      dsaProblems.filter(
        (p) => p.status === "new" && p.plannedDate && p.plannedDate <= today,
      ),
    [dsaProblems],
  );
  const solvedTodayDsa = useMemo(
    () => dsaProblems.filter((p) => p.solvedAt === today),
    [dsaProblems],
  );
  const masteredDsa = useMemo(
    () => dsaProblems.filter((p) => p.status === "mastered").length,
    [dsaProblems],
  );

  // Independent SQL revision metrics (2/day cap)
  const reviewedTodaySql = useMemo(
    () => sqlProblems.filter((p) => p.lastReviewed === today),
    [sqlProblems],
  );
  const completedTodayCountSql = reviewedTodaySql.length;
  const remainingSlotsSql = Math.max(0, dailyCap - completedTodayCountSql);
  const dueSql = useMemo(() => {
    const unreviewed = sqlProblems.filter((p) => p.lastReviewed !== today);
    return getDueReviews(unreviewed, today, remainingSlotsSql);
  }, [sqlProblems, remainingSlotsSql]);
  const todayPlanSql = useMemo(
    () =>
      sqlProblems.filter(
        (p) => p.status === "new" && p.plannedDate && p.plannedDate <= today,
      ),
    [sqlProblems],
  );
  const solvedTodaySql = useMemo(
    () => sqlProblems.filter((p) => p.solvedAt === today),
    [sqlProblems],
  );
  const masteredSql = useMemo(
    () => sqlProblems.filter((p) => p.status === "mastered").length,
    [sqlProblems],
  );

  const totalMastered = masteredDsa + masteredSql;

  // Track-specific filtered problem lists
  const filteredDsa = useMemo(() => {
    return dsaProblems.filter((problem) => {
      const matchesTopic =
        dsaTopicFilter === "All topics" || problem.category === dsaTopicFilter;
      const matchesDifficulty =
        difficultyFilter === "All" || problem.difficulty === difficultyFilter;
      const matchesSearch = problem.title
        .toLowerCase()
        .includes(query.toLowerCase());
      const isSolved = Boolean(problem.solvedAt);
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Solved" && isSolved) ||
        (statusFilter === "Unsolved" && !isSolved);

      return matchesTopic && matchesDifficulty && matchesSearch && matchesStatus;
    });
  }, [dsaProblems, dsaTopicFilter, difficultyFilter, statusFilter, query]);

  const filteredSql = useMemo(() => {
    return sqlProblems.filter((problem) => {
      const matchesTopic =
        sqlTopicFilter === "All topics" || problem.category === sqlTopicFilter;
      const matchesDifficulty =
        difficultyFilter === "All" || problem.difficulty === difficultyFilter;
      const matchesSearch = problem.title
        .toLowerCase()
        .includes(query.toLowerCase());
      const isSolved = Boolean(problem.solvedAt);
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Solved" && isSolved) ||
        (statusFilter === "Unsolved" && !isSolved);

      return matchesTopic && matchesDifficulty && matchesSearch && matchesStatus;
    });
  }, [sqlProblems, sqlTopicFilter, difficultyFilter, statusFilter, query]);

  const streak = useMemo(() => calculateStreak(activity, today), [activity]);

  const reviewScheduleDsa = useMemo(
    () => buildReviewSchedule(dsaProblems, today),
    [dsaProblems],
  );
  const reviewScheduleSql = useMemo(
    () => buildReviewSchedule(sqlProblems, today),
    [sqlProblems],
  );
  const reviewScheduleAll = useMemo(
    () => buildReviewSchedule(problems, today),
    [problems],
  );

  async function updateProblem(problem, patch) {
    const updated = { ...problem, ...patch };
    setProblems((items) => {
      const next = items.map((item) =>
        item.id === problem.id ? updated : item,
      );
      try {
        localStorage.setItem("recall-problems-v1", JSON.stringify(next));
        localStorage.setItem("recall-problems-backup-v1", JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await fetch(`/api/problems/${problem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      // Offline fallback: state and localStorage already updated
    }
  }

  function recordActivity(delta = 1) {
    setActivity((current) => {
      const next = { ...current };
      const currentCount = next[today] || 0;
      const nextCount = Math.max(0, currentCount + delta);
      if (nextCount === 0) {
        delete next[today];
      } else {
        next[today] = nextCount;
      }
      try {
        localStorage.setItem("recall-activity-v1", JSON.stringify(next));
      } catch {}
      return next;
    });

    fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, delta }),
    }).catch(() => {});
  }

  function undoSpecificAction(action) {
    if (!action) return;
    const { problemId, previousProblem, recordedActivity, description } = action;

    setProblems((items) =>
      items.map((item) =>
        item.id === problemId ? { ...previousProblem } : item,
      ),
    );

    fetch(`/api/problems/${problemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(previousProblem),
    }).catch(() => {});

    if (recordedActivity) {
      recordActivity(-1);
    }

    setUndoStack((prev) => prev.filter((item) => item.id !== action.id));
    showToast(`Undid ${description}.`);
  }

  function planProblem(problem) {
    const previousProblem = { ...problem };
    const isPlanned = Boolean(
      problem.plannedDate && problem.plannedDate <= today,
    );
    const patch = { plannedDate: isPlanned ? null : today };
    updateProblem(problem, patch);

    const action = {
      id: Date.now(),
      type: "plan",
      problemId: problem.id,
      previousProblem,
      description: `${isPlanned ? "removing" : "planning"} "${problem.title}"`,
      recordedActivity: false,
    };
    setUndoStack((prev) => [action, ...prev.slice(0, 19)]);
    showToast(
      isPlanned
        ? `Removed "${problem.title}" from today’s solve list.`
        : `Added "${problem.title}" to today’s solve list.`,
      {
        label: "Undo",
        onClick: () => undoSpecificAction(action),
      },
    );
  }

  function markSolved(problem) {
    const previousProblem = { ...problem };
    const nextReview = getNextReviewDate(today, 0); // 1 day out
    const currentHistory = getSolveHistory(problem);
    const updatedHistory = [...currentHistory, today];
    const patch = {
      status: "learning",
      repetitions: 0,
      plannedDate: null,
      solvedAt: today,
      lastSolvedAt: today,
      solveHistory: updatedHistory,
      nextReview,
    };
    updateProblem(problem, patch);
    recordActivity(1);

    const action = {
      id: Date.now(),
      type: "solve",
      problemId: problem.id,
      previousProblem,
      description: `solve for "${problem.title}"`,
      recordedActivity: true,
    };
    setUndoStack((prev) => [action, ...prev.slice(0, 19)]);
    showToast(
      `Solved! First recall for "${problem.title}" scheduled for ${formatDate(nextReview)}.`,
      {
        label: "Undo",
        onClick: () => undoSpecificAction(action),
      },
    );
  }

  function review(problem, quality) {
    const previousProblem = { ...problem };
    let patch;

    if (quality === "again") {
      patch = {
        repetitions: 0,
        status: "review",
        nextReview: addDays(today, 1),
        lastReviewed: today,
        lastReviewQuality: "again",
      };
    } else {
      const nextReps = (problem.repetitions ?? 0) + 1;
      patch = {
        repetitions: nextReps,
        status: nextReps >= 4 ? "mastered" : "review",
        nextReview: getNextReviewDate(today, nextReps),
        lastReviewed: today,
        lastReviewQuality: "good",
      };
    }

    updateProblem(problem, patch);
    recordActivity(1);

    const action = {
      id: Date.now(),
      type: "review",
      problemId: problem.id,
      previousProblem,
      description: `review (${quality === "again" ? "Again 1d" : "Remembered"}) for "${problem.title}"`,
      recordedActivity: true,
    };
    setUndoStack((prev) => [action, ...prev.slice(0, 19)]);

    showToast(
      quality === "again"
        ? `Marked "${problem.title}" for review tomorrow (1d).`
        : `Nice! "${problem.title}" next review ${formatDate(patch.nextReview)}.`,
      {
        label: "Undo",
        onClick: () => undoSpecificAction(action),
      },
    );
  }

  function undoReview(problem) {
    const matchingAction = undoStack.find(
      (action) => action.type === "review" && action.problemId === problem.id,
    );
    if (matchingAction) {
      undoSpecificAction(matchingAction);
    } else {
      const patch = {
        lastReviewed: null,
        lastReviewQuality: null,
        nextReview: today,
        repetitions: Math.max(0, (problem.repetitions || 1) - 1),
        status: "review",
      };
      updateProblem(problem, patch);
      recordActivity(-1);
      showToast(`Undid review for "${problem.title}".`);
    }
  }

  function undoSolve(problem) {
    const matchingAction = undoStack.find(
      (action) => action.type === "solve" && action.problemId === problem.id,
    );
    if (matchingAction) {
      undoSpecificAction(matchingAction);
    } else {
      const currentHistory = getSolveHistory(problem);
      const updatedHistory = currentHistory.slice(0, -1);
      const lastSolved = updatedHistory[updatedHistory.length - 1] || null;
      const patch = {
        status: lastSolved ? "learning" : "new",
        repetitions: 0,
        solvedAt: lastSolved,
        lastSolvedAt: lastSolved,
        solveHistory: updatedHistory,
        nextReview: null,
        plannedDate: today,
      };
      updateProblem(problem, patch);
      recordActivity(-1);
      showToast(`Restored "${problem.title}" to today’s solve list.`);
    }
  }

  function resetProblem(problem) {
    const previousProblem = { ...problem };
    const patch = {
      status: "new",
      repetitions: 0,
      nextReview: null,
      plannedDate: null,
      solvedAt: null,
      lastSolvedAt: null,
      solveHistory: [],
      lastReviewed: null,
      lastReviewQuality: null,
    };
    updateProblem(problem, patch);

    const action = {
      id: Date.now(),
      type: "reset",
      problemId: problem.id,
      previousProblem,
      description: `reset for "${problem.title}"`,
      recordedActivity: false,
    };
    setUndoStack((prev) => [action, ...prev.slice(0, 19)]);
    showToast(`Reset progress for "${problem.title}".`, {
      label: "Undo",
      onClick: () => undoSpecificAction(action),
    });
  }

  function handleAddSolveDate(problem, dateStr) {
    const targetDate = dateStr || today;
    const currentHistory = getSolveHistory(problem);
    const updatedHistory = [...currentHistory, targetDate].sort();
    const lastSolved = updatedHistory[updatedHistory.length - 1];
    const patch = {
      solvedAt: lastSolved,
      lastSolvedAt: lastSolved,
      solveHistory: updatedHistory,
      status: problem.status === "new" ? "learning" : problem.status,
    };
    updateProblem(problem, patch);
    if (historyModalProblem && historyModalProblem.id === problem.id) {
      setHistoryModalProblem((prev) => ({ ...prev, ...patch }));
    }
    showToast(`Added solve date (${formatDate(targetDate)}) for "${problem.title}".`);
  }

  function handleRemoveSolveDate(problem, indexToRemove) {
    const currentHistory = getSolveHistory(problem);
    const updatedHistory = currentHistory.filter((_, idx) => idx !== indexToRemove);
    const lastSolved = updatedHistory[updatedHistory.length - 1] || null;
    const patch = {
      solvedAt: lastSolved,
      lastSolvedAt: lastSolved,
      solveHistory: updatedHistory,
      status: updatedHistory.length === 0 ? "new" : problem.status,
    };
    updateProblem(problem, patch);
    if (historyModalProblem && historyModalProblem.id === problem.id) {
      setHistoryModalProblem((prev) => ({ ...prev, ...patch }));
    }
    showToast(`Removed solve date entry for "${problem.title}".`);
  }

  async function addProblem(form) {
    const isSql = form.track === "sql";
    const newProblem = {
      ...form,
      track: isSql ? "sql" : "dsa",
      url: form.url || (isSql ? getSqlLeetCodeUrl(form.title) : getLeetCodeUrl(form.title)),
      sqlCode: isSql ? form.code || "" : "",
      pythonCode: !isSql ? form.code || "" : "",
    };

    try {
      const created = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProblem),
      }).then((response) => response.json());
      setProblems((items) => [...items, created]);
    } catch {
      const localCreated = {
        id: Date.now(),
        status: "new",
        repetitions: 0,
        nextReview: null,
        plannedDate: null,
        solvedAt: null,
        lastReviewed: null,
        solveHistory: [],
        timeComplexity: "",
        spaceComplexity: "",
        notes: "",
        ...newProblem,
      };
      setProblems((items) => [...items, localCreated]);
    }
    setModalOpen(false);
    showToast(`Added "${form.title}" to your ${isSql ? "SQL 50" : "DSA"} library.`);
  }

  const content =
    activePage === "Dashboard" ? (
      <Dashboard
        problems={problems}
        dsaProblems={dsaProblems}
        sqlProblems={sqlProblems}
        dueDsa={dueDsa}
        dueSql={dueSql}
        todayPlanDsa={todayPlanDsa}
        todayPlanSql={todayPlanSql}
        reviewedTodayDsa={reviewedTodayDsa}
        reviewedTodaySql={reviewedTodaySql}
        solvedTodayDsa={solvedTodayDsa}
        solvedTodaySql={solvedTodaySql}
        masteredDsa={masteredDsa}
        masteredSql={masteredSql}
        totalMastered={totalMastered}
        streak={streak}
        dailyCap={dailyCap}
        completedTodayCountDsa={completedTodayCountDsa}
        completedTodayCountSql={completedTodayCountSql}
        dashboardTrack={dashboardTrack}
        setDashboardTrack={setDashboardTrack}
        review={review}
        undoReview={undoReview}
        undoSolve={undoSolve}
        planProblem={planProblem}
        markSolved={markSolved}
        setModalOpen={setModalOpen}
        setActivePage={setActivePage}
        activity={activity}
        onOpenHistory={(prob) => setHistoryModalProblem(prob)}
        today={today}
      />
    ) : activePage === "Review calendar" ? (
      <ReviewCalendar
        scheduleDsa={reviewScheduleDsa}
        scheduleSql={reviewScheduleSql}
        scheduleAll={reviewScheduleAll}
        calendarTrack={calendarTrack}
        setCalendarTrack={setCalendarTrack}
        setActivePage={setActivePage}
        today={today}
      />
    ) : activePage === "Learning path" ? (
      <LearningPath
        dsaProblems={dsaProblems}
        sqlProblems={sqlProblems}
        setActivePage={setActivePage}
        setDsaTopicFilter={setDsaTopicFilter}
        setSqlTopicFilter={setSqlTopicFilter}
      />
    ) : activePage === "SQL 50" ? (
      <ProblemsPage
        track="sql"
        trackTitle="LeetCode SQL 50"
        trackEyebrow="DATABASE STUDY PLAN"
        trackDescription="Browse all 50 essential SQL problems across 7 core database categories. Practice joins, window functions, and subqueries with dedicated SQL solution notes and spaced repetition."
        topics={sqlTopics}
        topicFilter={sqlTopicFilter}
        setTopicFilter={setSqlTopicFilter}
        difficultyFilter={difficultyFilter}
        setDifficultyFilter={setDifficultyFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        problems={filteredSql}
        allProblems={sqlProblems}
        totalCount={sqlProblems.length}
        expandedNotesId={expandedNotesId}
        setExpandedNotesId={setExpandedNotesId}
        query={query}
        setModalOpen={setModalOpen}
        onOpenNotes={(problem) => setActiveNotesProblem(problem)}
        review={review}
        undoReview={undoReview}
        planProblem={planProblem}
        markSolved={markSolved}
        resetProblem={resetProblem}
        today={today}
        onOpenHistory={(prob) => setHistoryModalProblem(prob)}
      />
    ) : (
      <ProblemsPage
        track="dsa"
        trackTitle="DSA Problems (NeetCode 150)"
        trackEyebrow="CURATED CURRICULUM"
        trackDescription="Browse all 150 curated NeetCode problems across 18 core topics. Filter by difficulty, topic, or solved status. Click any problem to open it directly on LeetCode, or expand notes for Python solutions."
        topics={dsaTopics}
        topicFilter={dsaTopicFilter}
        setTopicFilter={setDsaTopicFilter}
        difficultyFilter={difficultyFilter}
        setDifficultyFilter={setDifficultyFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        problems={filteredDsa}
        allProblems={dsaProblems}
        totalCount={dsaProblems.length}
        expandedNotesId={expandedNotesId}
        setExpandedNotesId={setExpandedNotesId}
        query={query}
        setModalOpen={setModalOpen}
        onOpenNotes={(problem) => setActiveNotesProblem(problem)}
        review={review}
        undoReview={undoReview}
        planProblem={planProblem}
        markSolved={markSolved}
        resetProblem={resetProblem}
        today={today}
        onOpenHistory={(prob) => setHistoryModalProblem(prob)}
      />
    );

  return (
    <div className={`app-shell ${dark ? "dark" : ""}`}>
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        dsaCount={dsaProblems.length}
        sqlCount={sqlProblems.length}
        setHelpOpen={setHelpOpen}
        setSettingsOpen={setSettingsOpen}
      />
      <main>
        <header className="topbar">
          <div className="mobile-brand">
            <BrainCircuit size={22} />
            <span>recall</span>
          </div>
          <div className="search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (
                  event.target.value.trim() &&
                  activePage !== "DSA Problems" &&
                  activePage !== "SQL 50" &&
                  activePage !== "My problems"
                ) {
                  setActivePage("DSA Problems");
                }
              }}
              placeholder="Search problems across DSA & SQL 50..."
            />
            <span>⌘ K</span>
          </div>
          <div className="top-actions">
            {undoStack.length > 0 && (
              <button
                className="icon-button"
                onClick={() => undoSpecificAction(undoStack[0])}
                title="Undo last action (⌘Z)"
                aria-label="Undo last action"
              >
                <Undo2 size={18} />
              </button>
            )}
            <button
              className="icon-button theme-toggle"
              onClick={() => setDark((value) => !value)}
              aria-label="Toggle theme"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button"
              onClick={() =>
                showToast("All recall schedules and notes are synced.")
              }
              aria-label="Notifications"
            >
              <Bell size={19} />
              <i />
            </button>
            <button
              className="avatar"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              AK
            </button>
          </div>
        </header>
        {content}
      </main>

      {modalOpen && (
        <AddProblem onClose={() => setModalOpen(false)} onAdd={addProblem} />
      )}

      {historyModalProblem && (
        <SolveHistoryModal
          problem={historyModalProblem}
          onClose={() => setHistoryModalProblem(null)}
          onAddDate={handleAddSolveDate}
          onRemoveDate={handleRemoveSolveDate}
          today={today}
        />
      )}

      {activeNotesProblem && (
        <ProblemNotesModal
          problem={activeNotesProblem}
          onClose={() => setActiveNotesProblem(null)}
          onSave={(problemId, updates) => {
            const p = problems.find((item) => item.id === problemId);
            if (p) {
              updateProblem(p, updates);
              showToast(`Saved notes & solution for "${p.title}".`);
            }
            setActiveNotesProblem(null);
          }}
        />
      )}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          problems={problems}
          activity={activity}
          setProblems={setProblems}
          setActivity={setActivity}
          dsaCount={dsaProblems.length}
          sqlCount={sqlProblems.length}
          masteredDsa={masteredDsa}
          masteredSql={masteredSql}
          dark={dark}
          setDark={setDark}
          showToast={showToast}
        />
      )}

      {toast && (
        <div className="toast">
          <Check size={17} />
          <span>{toast.message}</span>
          {toast.action && (
            <button
              className="toast-undo"
              onClick={() => {
                toast.action.onClick();
                setToast(null);
              }}
            >
              <Undo2 size={13} />
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Sidebar({
  activePage,
  setActivePage,
  dsaCount,
  sqlCount,
  setHelpOpen,
  setSettingsOpen,
}) {
  const items = [
    [Home, "Dashboard", null],
    [Code2, "DSA Problems", dsaCount],
    [Database, "SQL 50", sqlCount],
    [CalendarDays, "Review calendar", null],
    [Target, "Learning path", null],
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <BrainCircuit size={23} />
        </div>
        <span>
          recall<span className="brand-dot">.</span>
        </span>
      </div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        {items.map(([Icon, label, count]) => {
          const isActive =
            activePage === label ||
            (label === "DSA Problems" && activePage === "My problems");
          return (
            <button
              key={label}
              className={isActive ? "nav-item active" : "nav-item"}
              onClick={() => setActivePage(label)}
            >
              <Icon size={19} />
              {label}
              {count !== null && <b>{count}</b>}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => setHelpOpen(true)}>
          <CircleHelp size={19} />
          Help center
        </button>
        <button className="nav-item" onClick={() => setSettingsOpen(true)}>
          <Settings size={19} />
          Settings
        </button>
        <div className="upgrade" onClick={() => setActivePage("Learning path")}>
          <Sparkles size={18} />
          <div>
            <strong>Dual Mastery</strong>
            <span>DSA 150 + SQL 50</span>
          </div>
          <ChevronRight size={17} />
        </div>
      </div>
    </aside>
  );
}

function Dashboard({
  problems,
  dsaProblems,
  sqlProblems,
  dueDsa,
  dueSql,
  todayPlanDsa,
  todayPlanSql,
  reviewedTodayDsa,
  reviewedTodaySql,
  solvedTodayDsa,
  solvedTodaySql,
  masteredDsa,
  masteredSql,
  totalMastered,
  streak,
  dailyCap,
  completedTodayCountDsa,
  completedTodayCountSql,
  dashboardTrack,
  setDashboardTrack,
  review,
  undoReview,
  undoSolve,
  planProblem,
  markSolved,
  setModalOpen,
  setActivePage,
  activity,
  onOpenHistory,
  today,
}) {
  const totalCount = problems.length;
  const totalDueCount = dueDsa.length + dueSql.length;
  const totalCompletedCount = completedTodayCountDsa + completedTodayCountSql;
  const bothCapsCompleted =
    completedTodayCountDsa >= dailyCap && completedTodayCountSql >= dailyCap;

  return (
    <section className="page dashboard">
      <div className="greeting-row">
        <div>
          <p className="eyebrow">{displayToday}</p>
          <h1>
            Good morning, Akhilesh <span>✦</span>
          </h1>
          <p className="muted">
            Independent revision queues: {dailyCap} DSA problems/day + {dailyCap} SQL 50 problems/day.
          </p>
        </div>
        <button className="primary" onClick={() => setModalOpen(true)}>
          <Plus size={18} />
          Add problem
        </button>
      </div>

      <div className="overview-grid">
        <div className="review-hero">
          <div className="hero-copy">
            <div className="section-kicker">
              <Sparkles size={16} />
              YOUR DUAL REVISION FOCUS
            </div>
            <h2>
              {bothCapsCompleted
                ? "All daily review goals achieved!"
                : totalDueCount > 0
                  ? `${totalDueCount} review${totalDueCount === 1 ? "" : "s"} ready today`
                  : "Daily queues clear"}
            </h2>
            <p>
              {bothCapsCompleted
                ? `Completed ${completedTodayCountDsa}/${dailyCap} DSA and ${completedTodayCountSql}/${dailyCap} SQL reviews today! Extra recalls roll forward cleanly.`
                : `DSA: ${completedTodayCountDsa}/${dailyCap} reviewed • SQL: ${completedTodayCountSql}/${dailyCap} reviewed. Reviews are capped at ${dailyCap}/day per track to prevent burnout.`}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              {dueDsa.length > 0 && (
                <button
                  className="dark-button"
                  onClick={() => {
                    setDashboardTrack("all");
                    setTimeout(() => {
                      document
                        .getElementById("dsa-revision-section")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 50);
                  }}
                >
                  <Code2 size={16} /> Review DSA ({dueDsa.length}) <ArrowUpRight size={15} />
                </button>
              )}
              {dueSql.length > 0 && (
                <button
                  className="dark-button"
                  onClick={() => {
                    setDashboardTrack("all");
                    setTimeout(() => {
                      document
                        .getElementById("sql-revision-section")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 50);
                  }}
                >
                  <Database size={16} /> Review SQL 50 ({dueSql.length}) <ArrowUpRight size={15} />
                </button>
              )}
              {totalDueCount === 0 && (
                <button
                  className="dark-button"
                  onClick={() => setActivePage("DSA Problems")}
                >
                  Browse libraries <ArrowUpRight size={16} />
                </button>
              )}
            </div>
          </div>
          <div className="orbit">
            <div className="orbit-ring ring-one" />
            <div className="orbit-ring ring-two" />
            <div className="orbit-core">
              <BrainCircuit size={44} />
            </div>
            <span className="float-card card-a">
              <Code2 size={15} />
              DSA (150)
            </span>
            <span className="float-card card-b">
              <Database size={15} />
              SQL 50
            </span>
          </div>
        </div>
        <StatCards
          masteredDsa={masteredDsa}
          masteredSql={masteredSql}
          totalMastered={totalMastered}
          streak={streak}
          totalCount={totalCount}
        />
      </div>

      {/* Track Selection Switcher for Dashboard */}
      <div className="dashboard-track-bar">
        <button
          className={`dashboard-track-tab ${dashboardTrack === "all" ? "active" : ""}`}
          onClick={() => setDashboardTrack("all")}
        >
          All Revision Tracks <small>({totalCompletedCount}/4 done)</small>
        </button>
        <button
          className={`dashboard-track-tab ${dashboardTrack === "dsa" ? "active" : ""}`}
          onClick={() => setDashboardTrack("dsa")}
        >
          <Code2 size={14} /> DSA Revision <small>({completedTodayCountDsa}/{dailyCap})</small>
        </button>
        <button
          className={`dashboard-track-tab ${dashboardTrack === "sql" ? "active" : ""}`}
          onClick={() => setDashboardTrack("sql")}
        >
          <Database size={14} /> SQL 50 Revision <small>({completedTodayCountSql}/{dailyCap})</small>
        </button>
      </div>

      <div className="content-grid">
        <div className="due-section">
          {/* DSA REVISION SECTION */}
          {(dashboardTrack === "all" || dashboardTrack === "dsa") && (
            <div className="revision-track-card" id="dsa-revision-section">
              <div className="revision-track-header">
                <div className="revision-track-title">
                  <span className="track-kicker dsa">
                    <Code2 size={13} /> DSA Track • NeetCode 150
                  </span>
                  <h2>
                    DSA Spaced Repetition Focus
                  </h2>
                  <p>
                    Data structures & algorithms recall. Independent {dailyCap} problems/day cap.
                  </p>
                </div>
                <div className="revision-cap-status">
                  <span
                    className={`revision-cap-badge ${completedTodayCountDsa >= dailyCap ? "complete" : ""}`}
                  >
                    {completedTodayCountDsa >= dailyCap
                      ? "✓ Cap reached (2/2)"
                      : `${completedTodayCountDsa}/${dailyCap} completed today`}
                  </span>
                </div>
              </div>

              {/* DSA Today's Solve List */}
              <section className="today-section" style={{ marginBottom: 24 }}>
                <div className="section-heading">
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>
                      DSA Today’s solve list <span>{todayPlanDsa.length}</span>
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      Fresh DSA problems chosen for practice today.
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setActivePage("DSA Problems")}
                  >
                    Browse DSA library <ChevronRight size={15} />
                  </button>
                </div>

                <div className="problem-list">
                  {todayPlanDsa.length ? (
                    todayPlanDsa.map((problem) => (
                      <article className="problem-card plan-card" key={problem.id}>
                        <div className="problem-number">
                          {String(problem.id).padStart(2, "0")}
                        </div>
                        <div className="problem-info">
                          <h3>
                            <a
                              href={problem.url || getLeetCodeUrl(problem.title)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="problem-title-link"
                              title={`Open "${problem.title}" on LeetCode`}
                            >
                              {problem.title} <ArrowUpRight size={14} />
                            </a>
                          </h3>
                          <p>
                            {problem.category}
                            <span>•</span>
                            <b
                              className={`difficulty ${problem.difficulty.toLowerCase()}`}
                            >
                              {problem.difficulty}
                            </b>
                          </p>
                          {getSolveHistory(problem).length > 0 && onOpenHistory && (
                            <button
                              type="button"
                              className="card-solve-meta"
                              onClick={() => onOpenHistory(problem)}
                              title="Click to view solve timeline"
                            >
                              <History size={12} />
                              <span>
                                {getSolveHistory(problem).length}× (Last: {formatDate(getLastSolvedDate(problem))})
                              </span>
                            </button>
                          )}
                        </div>
                        <button
                          className="remove-plan"
                          onClick={() => planProblem(problem)}
                        >
                          Remove
                        </button>
                        <button
                          className="solve-button"
                          onClick={() => markSolved(problem)}
                        >
                          <Check size={16} />
                          Solved today
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="empty">
                      No DSA problems planned for today. Pick fresh problems from your DSA library.
                    </div>
                  )}
                </div>

                {solvedTodayDsa.length > 0 && (
                  <div className="reviewed-today-section">
                    <h3>
                      <Check size={15} /> DSA Solved today ({solvedTodayDsa.length})
                    </h3>
                    <div className="problem-list">
                      {solvedTodayDsa.map((problem) => (
                        <article
                          className="problem-card reviewed-card"
                          key={problem.id}
                        >
                          <div className="problem-number">
                            {String(problem.id).padStart(2, "0")}
                          </div>
                          <div className="problem-info">
                            <h3>
                              <a
                                href={problem.url || getLeetCodeUrl(problem.title)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="problem-title-link"
                                title={`Open "${problem.title}" on LeetCode`}
                              >
                                {problem.title} <ArrowUpRight size={14} />
                              </a>
                            </h3>
                            <p>
                              <span className="reviewed-badge">Solved</span>
                              Next recall scheduled: <b>{formatDate(problem.nextReview)}</b>
                            </p>
                            {onOpenHistory && (
                              <button
                                type="button"
                                className="card-solve-meta"
                                onClick={() => onOpenHistory(problem)}
                                title="Click to view solve timeline"
                              >
                                <History size={12} />
                                <span>
                                  {getSolveHistory(problem).length}× (Last: {formatDate(getLastSolvedDate(problem))})
                                </span>
                              </button>
                            )}
                          </div>
                          <button
                            className="undo-button"
                            onClick={() => undoSolve(problem)}
                          >
                            <Undo2 size={13} />
                            Undo solve
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* DSA Due for Review */}
              <section className="review-section">
                <div className="section-heading">
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>
                      DSA Due for review{" "}
                      <span>
                        {completedTodayCountDsa}/{dailyCap} completed
                      </span>
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      Capped at {dailyCap} DSA recalls per day. Overdue items roll forward automatically.
                    </p>
                  </div>
                </div>

                {completedTodayCountDsa >= dailyCap && (
                  <div className="daily-completed-banner">
                    <div>
                      <strong>🎉 DSA daily review target completed!</strong>
                      <p>
                        You reviewed {completedTodayCountDsa} DSA problems today.
                        Further recalls roll forward into tomorrow.
                      </p>
                    </div>
                    <button onClick={() => setActivePage("DSA Problems")}>
                      Practice more DSA
                    </button>
                  </div>
                )}

                <div className="problem-list">
                  {dueDsa.length ? (
                    dueDsa.map((problem) => (
                      <ProblemCard
                        key={problem.id}
                        problem={problem}
                        review={review}
                        onOpenHistory={onOpenHistory}
                      />
                    ))
                  ) : completedTodayCountDsa >= dailyCap ? null : (
                    <div className="empty">
                      No DSA recalls due today. Your next solved DSA problem will start its review cycle.
                    </div>
                  )}
                </div>

                {reviewedTodayDsa.length > 0 && (
                  <div className="reviewed-today-section">
                    <h3>
                      <Check size={15} /> DSA Reviewed today ({reviewedTodayDsa.length})
                    </h3>
                    <div className="problem-list">
                      {reviewedTodayDsa.map((problem) => (
                        <article
                          className="problem-card reviewed-card"
                          key={problem.id}
                        >
                          <div className="problem-number">
                            {String(problem.id).padStart(2, "0")}
                          </div>
                          <div className="problem-info">
                            <h3>
                              <a
                                href={problem.url || getLeetCodeUrl(problem.title)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="problem-title-link"
                                title={`Open "${problem.title}" on LeetCode`}
                              >
                                {problem.title} <ArrowUpRight size={14} />
                              </a>
                            </h3>
                            <p>
                              <span className="reviewed-badge">
                                {problem.lastReviewQuality === "again"
                                  ? "Again (1d)"
                                  : "Remembered"}
                              </span>
                              Next review: <b>{formatDate(problem.nextReview)}</b>
                            </p>
                            {getSolveHistory(problem).length > 0 && onOpenHistory && (
                              <button
                                type="button"
                                className="card-solve-meta"
                                onClick={() => onOpenHistory(problem)}
                                title="Click to view solve timeline"
                              >
                                <History size={12} />
                                <span>
                                  {getSolveHistory(problem).length}× (Last: {formatDate(getLastSolvedDate(problem))})
                                </span>
                              </button>
                            )}
                          </div>
                          <button
                            className="undo-button"
                            onClick={() => undoReview(problem)}
                          >
                            <Undo2 size={13} />
                            Undo review
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* SQL 50 REVISION SECTION */}
          {(dashboardTrack === "all" || dashboardTrack === "sql") && (
            <div className="revision-track-card" id="sql-revision-section">
              <div className="revision-track-header">
                <div className="revision-track-title">
                  <span className="track-kicker sql">
                    <Database size={13} /> Database Track • LeetCode SQL 50
                  </span>
                  <h2>
                    SQL 50 Spaced Repetition Focus
                  </h2>
                  <p>
                    SQL queries, joins, aggregates, and windows. Independent {dailyCap} problems/day cap.
                  </p>
                </div>
                <div className="revision-cap-status">
                  <span
                    className={`revision-cap-badge ${completedTodayCountSql >= dailyCap ? "complete" : ""}`}
                  >
                    {completedTodayCountSql >= dailyCap
                      ? "✓ Cap reached (2/2)"
                      : `${completedTodayCountSql}/${dailyCap} completed today`}
                  </span>
                </div>
              </div>

              {/* SQL Today's Solve List */}
              <section className="today-section" style={{ marginBottom: 24 }}>
                <div className="section-heading">
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>
                      SQL 50 Today’s solve list <span>{todayPlanSql.length}</span>
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      SQL problems planned for practice today.
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setActivePage("SQL 50")}
                  >
                    Browse SQL 50 library <ChevronRight size={15} />
                  </button>
                </div>

                <div className="problem-list">
                  {todayPlanSql.length ? (
                    todayPlanSql.map((problem) => (
                      <article className="problem-card plan-card" key={problem.id}>
                        <div className="problem-number">
                          {String(problem.id).padStart(2, "0")}
                        </div>
                        <div className="problem-info">
                          <h3>
                            <a
                              href={problem.url || getSqlLeetCodeUrl(problem.title)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="problem-title-link"
                              title={`Open "${problem.title}" on LeetCode`}
                            >
                              {problem.title} <ArrowUpRight size={14} />
                            </a>
                          </h3>
                          <p>
                            {problem.category}
                            <span>•</span>
                            <b
                              className={`difficulty ${problem.difficulty.toLowerCase()}`}
                            >
                              {problem.difficulty}
                            </b>
                          </p>
                          {getSolveHistory(problem).length > 0 && onOpenHistory && (
                            <button
                              type="button"
                              className="card-solve-meta"
                              onClick={() => onOpenHistory(problem)}
                              title="Click to view solve timeline"
                            >
                              <History size={12} />
                              <span>
                                {getSolveHistory(problem).length}× (Last: {formatDate(getLastSolvedDate(problem))})
                              </span>
                            </button>
                          )}
                        </div>
                        <button
                          className="remove-plan"
                          onClick={() => planProblem(problem)}
                        >
                          Remove
                        </button>
                        <button
                          className="solve-button"
                          onClick={() => markSolved(problem)}
                        >
                          <Check size={16} />
                          Solved today
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="empty">
                      No SQL problems planned for today. Pick fresh problems from your SQL 50 library.
                    </div>
                  )}
                </div>

                {solvedTodaySql.length > 0 && (
                  <div className="reviewed-today-section">
                    <h3>
                      <Check size={15} /> SQL 50 Solved today ({solvedTodaySql.length})
                    </h3>
                    <div className="problem-list">
                      {solvedTodaySql.map((problem) => (
                        <article
                          className="problem-card reviewed-card"
                          key={problem.id}
                        >
                          <div className="problem-number">
                            {String(problem.id).padStart(2, "0")}
                          </div>
                          <div className="problem-info">
                            <h3>
                              <a
                                href={problem.url || getSqlLeetCodeUrl(problem.title)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="problem-title-link"
                                title={`Open "${problem.title}" on LeetCode`}
                              >
                                {problem.title} <ArrowUpRight size={14} />
                              </a>
                            </h3>
                            <p>
                              <span className="reviewed-badge">Solved</span>
                              Next recall scheduled: <b>{formatDate(problem.nextReview)}</b>
                            </p>
                            {onOpenHistory && (
                              <button
                                type="button"
                                className="card-solve-meta"
                                onClick={() => onOpenHistory(problem)}
                                title="Click to view solve timeline"
                              >
                                <History size={12} />
                                <span>
                                  {getSolveHistory(problem).length}× (Last: {formatDate(getLastSolvedDate(problem))})
                                </span>
                              </button>
                            )}
                          </div>
                          <button
                            className="undo-button"
                            onClick={() => undoSolve(problem)}
                          >
                            <Undo2 size={13} />
                            Undo solve
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* SQL Due for Review */}
              <section className="review-section">
                <div className="section-heading">
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>
                      SQL 50 Due for review{" "}
                      <span>
                        {completedTodayCountSql}/{dailyCap} completed
                      </span>
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      Capped at {dailyCap} SQL recalls per day. Overdue items roll forward automatically.
                    </p>
                  </div>
                </div>

                {completedTodayCountSql >= dailyCap && (
                  <div className="daily-completed-banner">
                    <div>
                      <strong>🎉 SQL 50 daily review target completed!</strong>
                      <p>
                        You reviewed {completedTodayCountSql} SQL problems today.
                        Further recalls roll forward into tomorrow.
                      </p>
                    </div>
                    <button onClick={() => setActivePage("SQL 50")}>
                      Practice more SQL
                    </button>
                  </div>
                )}

                <div className="problem-list">
                  {dueSql.length ? (
                    dueSql.map((problem) => (
                      <ProblemCard
                        key={problem.id}
                        problem={problem}
                        review={review}
                        onOpenHistory={onOpenHistory}
                      />
                    ))
                  ) : completedTodayCountSql >= dailyCap ? null : (
                    <div className="empty">
                      No SQL recalls due today. Your next solved SQL problem will start its review cycle.
                    </div>
                  )}
                </div>

                {reviewedTodaySql.length > 0 && (
                  <div className="reviewed-today-section">
                    <h3>
                      <Check size={15} /> SQL 50 Reviewed today ({reviewedTodaySql.length})
                    </h3>
                    <div className="problem-list">
                      {reviewedTodaySql.map((problem) => (
                        <article
                          className="problem-card reviewed-card"
                          key={problem.id}
                        >
                          <div className="problem-number">
                            {String(problem.id).padStart(2, "0")}
                          </div>
                          <div className="problem-info">
                            <h3>
                              <a
                                href={problem.url || getSqlLeetCodeUrl(problem.title)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="problem-title-link"
                                title={`Open "${problem.title}" on LeetCode`}
                              >
                                {problem.title} <ArrowUpRight size={14} />
                              </a>
                            </h3>
                            <p>
                              <span className="reviewed-badge">
                                {problem.lastReviewQuality === "again"
                                  ? "Again (1d)"
                                  : "Remembered"}
                              </span>
                              Next review: <b>{formatDate(problem.nextReview)}</b>
                            </p>
                            {getSolveHistory(problem).length > 0 && onOpenHistory && (
                              <button
                                type="button"
                                className="card-solve-meta"
                                onClick={() => onOpenHistory(problem)}
                                title="Click to view solve timeline"
                              >
                                <History size={12} />
                                <span>
                                  {getSolveHistory(problem).length}× (Last: {formatDate(getLastSolvedDate(problem))})
                                </span>
                              </button>
                            )}
                          </div>
                          <button
                            className="undo-button"
                            onClick={() => undoReview(problem)}
                          >
                            <Undo2 size={13} />
                            Undo review
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        <ProgressCard
          problems={problems}
          dsaProblems={dsaProblems}
          sqlProblems={sqlProblems}
          activity={activity}
          setActivePage={setActivePage}
          today={today}
        />
      </div>
    </section>
  );
}

function StatCards({ masteredDsa, masteredSql, totalMastered, streak, totalCount }) {
  return (
    <>
      <div className="stat-card streak">
        <div className="stat-icon orange">
          <Flame size={21} />
        </div>
        <span>Current streak</span>
        <strong>
          {streak} <small>day{streak === 1 ? "" : "s"}</small>
        </strong>
        <div className="mini-bars">
          {Array.from({ length: 7 }, (_, index) => (
            <i
              key={index}
              className={index === 6 && streak > 0 ? "today" : ""}
              style={{
                height: Math.max(5, streak > index ? 6 + index * 5 : 5),
              }}
            />
          ))}
        </div>
        <em>
          {streak
            ? "Keep it alive with one solve or review today."
            : "Complete a study action to start your streak."}
        </em>
      </div>
      <div className="stat-card">
        <div className="stat-icon violet">
          <Trophy size={20} />
        </div>
        <span>Mastered (4+ recalls)</span>
        <strong>
          {totalMastered}
          <small>/ {totalCount}</small>
        </strong>
        <div className="progress">
          <i
            style={{
              width: `${totalCount ? (totalMastered / totalCount) * 100 : 0}%`,
            }}
          />
        </div>
        <em>DSA: {masteredDsa}/150 • SQL: {masteredSql}/50</em>
      </div>
    </>
  );
}

function ProblemCard({ problem, review, onOpenHistory }) {
  const nextRememberInterval =
    intervals[Math.min((problem.repetitions ?? 0) + 1, intervals.length - 1)];
  const history = getSolveHistory(problem);
  const solveCount = history.length;
  const lastDate = getLastSolvedDate(problem);
  const isSql = problem.track === "sql" || problem.id > 1000;
  const leetCodeUrl =
    problem.url ||
    (isSql
      ? getSqlLeetCodeUrl(problem.title)
      : getLeetCodeUrl(problem.title));

  return (
    <article className="problem-card" id={`review-${problem.id}`}>
      <div className="problem-number">
        {String(problem.id).padStart(2, "0")}
      </div>
      <div className="problem-info">
        <h3>
          <a
            href={leetCodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="problem-title-link"
            title={`Open "${problem.title}" on LeetCode`}
          >
            {problem.title} <ArrowUpRight size={14} />
          </a>
        </h3>
        <p>
          <span className={`track-badge ${isSql ? "sql" : "dsa"}`} style={{ marginRight: 6 }}>
            {isSql ? <Database size={10} /> : <Code2 size={10} />}
            {isSql ? "SQL" : "DSA"}
          </span>
          {problem.category}
          <span>•</span>
          <b className={`difficulty ${problem.difficulty.toLowerCase()}`}>
            {problem.difficulty}
          </b>
        </p>
        {solveCount > 0 && onOpenHistory && (
          <button
            type="button"
            className="card-solve-meta"
            onClick={() => onOpenHistory(problem)}
            title="Click to view solve timeline"
          >
            <History size={12} />
            <span>
              {solveCount}× (Last: {formatDate(lastDate)})
            </span>
          </button>
        )}
      </div>
      <div className="review-actions">
        <span className="due-now">Due today</span>
        <button
          className="again"
          onClick={() => review(problem, "again")}
          title="Review again tomorrow (1 day)"
        >
          Again <small>1d</small>
        </button>
        <button
          className="remember"
          onClick={() => review(problem, "good")}
          title={`Recall in ${nextRememberInterval} days`}
        >
          <Check size={16} />
          Remembered <small>{nextRememberInterval}d</small>
        </button>
      </div>
    </article>
  );
}

function ProgressCard({
  problems,
  dsaProblems,
  sqlProblems,
  activity,
  setActivePage,
  today,
}) {
  const total = problems.length || 1;
  const solved = problems.filter((problem) => problem.solvedAt).length;
  const solvedDsa = dsaProblems.filter((p) => p.solvedAt).length;
  const solvedSql = sqlProblems.filter((p) => p.solvedAt).length;
  const days = buildHeatmap(activity, today);

  return (
    <aside className="progress-card">
      <div className="section-heading">
        <div>
          <h2>Your progress</h2>
          <p>Recorded actions across both curriculums.</p>
        </div>
        <button
          className="icon-button"
          onClick={() => setActivePage("Learning path")}
          title="View learning path"
        >
          <ChevronDown size={17} />
        </button>
      </div>
      <div className="mastery">
        <div
          className="mastery-ring"
          style={{
            background: `conic-gradient(var(--violet) ${(solved / total) * 100}%, #eeeef5 0)`,
          }}
        >
          <span>{Math.round((solved / total) * 100)}%</span>
        </div>
        <div>
          <strong>NeetCode & SQL 50</strong>
          <p>
            {solved} of {total} total solved
          </p>
          <div className="legend" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            <span>DSA: {solvedDsa}/150 • SQL: {solvedSql}/50</span>
          </div>
        </div>
      </div>
      <div className="heatmap-label">
        <span>Activity</span>
        <span>Last 12 weeks</span>
      </div>
      <div className="heatmap">
        {days.map((day) => (
          <i
            key={day.index}
            title={`${day.date}: ${day.count} action${day.count === 1 ? "" : "s"}`}
            className={`heat-${day.level}`}
          />
        ))}
      </div>
      <div className="heatmap-scale">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <i key={level} className={`heat-${level}`} />
        ))}
        <span>More</span>
      </div>
      <button
        className="outline-button"
        onClick={() => setActivePage("Review calendar")}
      >
        <Grid2X2 size={17} />
        View review calendar
      </button>
    </aside>
  );
}

function ReviewCalendar({
  scheduleDsa,
  scheduleSql,
  scheduleAll,
  calendarTrack,
  setCalendarTrack,
  setActivePage,
  today,
}) {
  const [selectedDate, setSelectedDate] = useState(today);
  const activeSchedule =
    calendarTrack === "dsa"
      ? scheduleDsa
      : calendarTrack === "sql"
        ? scheduleSql
        : scheduleAll;

  const monthStart = `${today.slice(0, 7)}-01`;
  const firstWeekday = new Date(`${monthStart}T12:00:00`).getDay();
  const calendarDays = Array.from({ length: 42 }, (_, index) =>
    addDays(monthStart, index - firstWeekday),
  );
  const monthName = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${monthStart}T12:00:00`));

  const selectedReviews = activeSchedule[selectedDate] ?? [];

  return (
    <section className="page calendar-page">
      <div className="greeting-row">
        <div>
          <p className="eyebrow">SPACED REPETITION SCHEDULE</p>
          <h1>Review calendar</h1>
          <p className="muted">
            Independent 2-problem daily caps per track. Click any date to inspect planned reviews.
          </p>
        </div>
        <button className="primary" onClick={() => setActivePage("Dashboard")}>
          <Home size={17} />
          Back to dashboard
        </button>
      </div>

      {/* Calendar Track Switcher */}
      <div className="dashboard-track-bar" style={{ marginBottom: 18 }}>
        <button
          className={`dashboard-track-tab ${calendarTrack === "all" ? "active" : ""}`}
          onClick={() => setCalendarTrack("all")}
        >
          All Tracks
        </button>
        <button
          className={`dashboard-track-tab ${calendarTrack === "dsa" ? "active" : ""}`}
          onClick={() => setCalendarTrack("dsa")}
        >
          <Code2 size={14} /> DSA Only (NeetCode 150)
        </button>
        <button
          className={`dashboard-track-tab ${calendarTrack === "sql" ? "active" : ""}`}
          onClick={() => setCalendarTrack("sql")}
        >
          <Database size={14} /> SQL 50 Only
        </button>
      </div>

      <div className="calendar-layout">
        <div className="calendar-card">
          <div className="calendar-header">
            <h2>{monthName}</h2>
            <span>
              {calendarTrack === "all"
                ? "Dots show scheduled reviews across DSA & SQL"
                : `Dots show ${calendarTrack.toUpperCase()} reviews (max 2/day)`}
            </span>
          </div>
          <div className="calendar-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarDays.map((date) => {
              const planned = activeSchedule[date] ?? [];
              const inMonth = date.slice(0, 7) === today.slice(0, 7);
              const isSelected = date === selectedDate;
              return (
                <div
                  key={date}
                  className={`calendar-day ${inMonth ? "" : "outside-month"} ${date === today ? "calendar-today" : ""} ${isSelected ? "selected-day" : ""}`}
                  onClick={() => setSelectedDate(date)}
                >
                  <span>{Number(date.slice(-2))}</span>
                  <div className="calendar-dots">
                    {planned.map((problem) => (
                      <i
                        key={problem.id}
                        title={`[${problem.track === "sql" ? "SQL" : "DSA"}] ${problem.title}`}
                        style={{
                          background: problem.track === "sql" ? "#0891b2" : "#6366f1",
                        }}
                      />
                    ))}
                  </div>
                  {planned.length > 0 && <small>{planned.length}</small>}
                </div>
              );
            })}
          </div>
        </div>
        <aside className="calendar-agenda">
          <div className="section-heading">
            <div>
              <h2>
                {selectedDate === today
                  ? "Today’s reviews"
                  : `Plan for ${formatDate(selectedDate)}`}
              </h2>
              <p>
                {selectedReviews.length
                  ? `${selectedReviews.length} recall${selectedReviews.length === 1 ? "" : "s"} scheduled.`
                  : "No reviews scheduled on this day."}
              </p>
            </div>
          </div>
          {selectedReviews.length ? (
            <div className="agenda-list">
              {selectedReviews.map((problem) => {
                const isSql = problem.track === "sql" || problem.id > 1000;
                return (
                  <div className="agenda-item" key={problem.id}>
                    <div className="agenda-number">
                      {String(problem.id).padStart(2, "0")}
                    </div>
                    <div>
                      <strong>
                        <a
                          href={
                            problem.url ||
                            (isSql
                              ? getSqlLeetCodeUrl(problem.title)
                              : getLeetCodeUrl(problem.title))
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="problem-title-link"
                          title={`Open "${problem.title}" on LeetCode`}
                        >
                          {problem.title} <ArrowUpRight size={12} />
                        </a>
                      </strong>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span className={`track-badge ${isSql ? "sql" : "dsa"}`} style={{ fontSize: 9, padding: "1px 5px" }}>
                          {isSql ? "SQL" : "DSA"}
                        </span>
                        {problem.category}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">Clear for this date.</div>
          )}
          <div className="calendar-note">
            <CalendarDays size={18} />
            <p>
              Each track operates an independent 2-problem cap per day. Recalls automatically roll forward when capacity is reached.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function LearningPath({
  dsaProblems,
  sqlProblems,
  setActivePage,
  setDsaTopicFilter,
  setSqlTopicFilter,
}) {
  const [currentRoadmap, setCurrentRoadmap] = useState("dsa");

  const dsaCategoryStats = useMemo(() => {
    return dsaTopics.slice(1).map((category) => {
      const topicProblems = dsaProblems.filter((p) => p.category === category);
      const total = topicProblems.length;
      const solved = topicProblems.filter((p) => p.solvedAt).length;
      const mastered = topicProblems.filter((p) => p.status === "mastered").length;
      const easy = topicProblems.filter((p) => p.difficulty === "Easy").length;
      const medium = topicProblems.filter((p) => p.difficulty === "Medium").length;
      const hard = topicProblems.filter((p) => p.difficulty === "Hard").length;

      return {
        category,
        total,
        solved,
        mastered,
        easy,
        medium,
        hard,
        percent: total ? Math.round((solved / total) * 100) : 0,
      };
    });
  }, [dsaProblems]);

  const sqlCategoryStats = useMemo(() => {
    return sqlTopics.slice(1).map((category) => {
      const topicProblems = sqlProblems.filter((p) => p.category === category);
      const total = topicProblems.length;
      const solved = topicProblems.filter((p) => p.solvedAt).length;
      const mastered = topicProblems.filter((p) => p.status === "mastered").length;
      const easy = topicProblems.filter((p) => p.difficulty === "Easy").length;
      const medium = topicProblems.filter((p) => p.difficulty === "Medium").length;
      const hard = topicProblems.filter((p) => p.difficulty === "Hard").length;

      return {
        category,
        total,
        solved,
        mastered,
        easy,
        medium,
        hard,
        percent: total ? Math.round((solved / total) * 100) : 0,
      };
    });
  }, [sqlProblems]);

  const activeStats = currentRoadmap === "dsa" ? dsaCategoryStats : sqlCategoryStats;

  return (
    <section className="page learning-path-page">
      <div className="greeting-row">
        <div>
          <p className="eyebrow">CURRICULUM ROADMAP</p>
          <h1>Learning path</h1>
          <p className="muted">
            {currentRoadmap === "dsa"
              ? "Master all 18 core topics in the NeetCode DSA curriculum step by step."
              : "Master all 7 canonical categories in the LeetCode SQL 50 study plan."}
          </p>
        </div>
        <button className="primary" onClick={() => setActivePage("Dashboard")}>
          <Home size={17} />
          Back to dashboard
        </button>
      </div>

      {/* Roadmap Switcher */}
      <div className="dashboard-track-bar" style={{ marginBottom: 20 }}>
        <button
          className={`dashboard-track-tab ${currentRoadmap === "dsa" ? "active" : ""}`}
          onClick={() => setCurrentRoadmap("dsa")}
        >
          <Code2 size={15} /> DSA Roadmap (18 Topics • 150 Problems)
        </button>
        <button
          className={`dashboard-track-tab ${currentRoadmap === "sql" ? "active" : ""}`}
          onClick={() => setCurrentRoadmap("sql")}
        >
          <Database size={15} /> SQL 50 Roadmap (7 Topics • 50 Problems)
        </button>
      </div>

      <div className="learning-path-grid">
        {activeStats.map((item) => (
          <article className="learning-card" key={item.category}>
            <div className="learning-card-header">
              <h3>{item.category}</h3>
              <span>
                {item.solved} / {item.total} solved
              </span>
            </div>

            <div className="learning-card-progress">
              <div className="learning-progress-bar">
                <i
                  className="bar-mastered"
                  style={{
                    width: `${item.total ? (item.mastered / item.total) * 100 : 0}%`,
                  }}
                />
                <i
                  className="bar-learning"
                  style={{
                    width: `${item.total ? ((item.solved - item.mastered) / item.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="learning-stats-row">
                <span>{item.percent}% complete</span>
                <span>{item.mastered} mastered</span>
              </div>
            </div>

            <div className="learning-difficulties">
              {item.easy > 0 && (
                <span className="diff-tag easy">{item.easy} Easy</span>
              )}
              {item.medium > 0 && (
                <span className="diff-tag medium">{item.medium} Med</span>
              )}
              {item.hard > 0 && (
                <span className="diff-tag hard">{item.hard} Hard</span>
              )}
            </div>

            <div className="learning-card-footer">
              <button
                onClick={() => {
                  if (currentRoadmap === "dsa") {
                    setDsaTopicFilter(item.category);
                    setActivePage("DSA Problems");
                  } else {
                    setSqlTopicFilter(item.category);
                    setActivePage("SQL 50");
                  }
                }}
              >
                Study {item.category} <ChevronRight size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProblemsPage({
  track,
  trackTitle,
  trackEyebrow,
  trackDescription,
  topics,
  topicFilter,
  setTopicFilter,
  difficultyFilter,
  setDifficultyFilter,
  statusFilter,
  setStatusFilter,
  problems,
  allProblems,
  totalCount,
  expandedNotesId,
  setExpandedNotesId,
  query,
  setModalOpen,
  onOpenNotes,
  review,
  undoReview,
  planProblem,
  markSolved,
  resetProblem,
  today,
  onOpenHistory,
}) {
  const isSql = track === "sql";

  const diffStats = useMemo(() => {
    const list = ["Easy", "Medium", "Hard"];
    return list.map((diff) => {
      const matching = (allProblems || []).filter((p) => p.difficulty === diff);
      const total = matching.length;
      const solved = matching.filter((p) => p.solvedAt).length;
      const mastered = matching.filter((p) => p.status === "mastered").length;
      const percent = total ? Math.round((solved / total) * 100) : 0;
      return { diff, total, solved, mastered, percent };
    });
  }, [allProblems]);

  const solvedCount = useMemo(
    () => (allProblems || []).filter((p) => p.solvedAt).length,
    [allProblems],
  );
  const unsolvedCount = totalCount - solvedCount;

  return (
    <section className="page problems-page">
      <div className="greeting-row">
        <div>
          <p className="eyebrow">{trackEyebrow}</p>
          <h1>{trackTitle}</h1>
          <p className="muted">{trackDescription}</p>
        </div>
        <button className="primary" onClick={() => setModalOpen(true)}>
          <Plus size={18} />
          Add problem
        </button>
      </div>

      {/* Difficulty Overview Section */}
      <div className="difficulty-section">
        {diffStats.map((item) => {
          const isSelected = difficultyFilter === item.diff;
          return (
            <div
              key={item.diff}
              className={`diff-stat-card ${item.diff.toLowerCase()}-card ${isSelected ? "selected" : ""}`}
              onClick={() =>
                setDifficultyFilter((curr) =>
                  curr === item.diff ? "All" : item.diff,
                )
              }
              title={`Click to filter by ${item.diff} problems`}
            >
              <div className="diff-card-header">
                <strong>{item.diff}</strong>
                <span>
                  {item.solved} / {item.total} solved
                </span>
              </div>
              <div className="diff-card-progress">
                <i style={{ width: `${item.percent}%` }} />
              </div>
              <div className="diff-card-stats">
                <span>{item.percent}% solved</span>
                <span>{item.mastered} mastered</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="filter-row">
        {/* Status Filter Tabs (All / Solved / Unsolved) */}
        <div className="status-filter-bar">
          <button
            className={`status-tab-btn ${statusFilter === "All" ? "selected" : ""}`}
            onClick={() => setStatusFilter("All")}
          >
            All problems <small>({totalCount})</small>
          </button>
          <button
            className={`status-tab-btn ${statusFilter === "Solved" ? "selected" : ""}`}
            onClick={() => setStatusFilter("Solved")}
          >
            <CheckCircle2 size={13} style={{ color: "#2e8b63" }} /> Solved{" "}
            <small>({solvedCount})</small>
          </button>
          <button
            className={`status-tab-btn ${statusFilter === "Unsolved" ? "selected" : ""}`}
            onClick={() => setStatusFilter("Unsolved")}
          >
            <Circle size={13} /> Unsolved <small>({unsolvedCount})</small>
          </button>
        </div>

        {/* Difficulty Filter Pills */}
        <div className="difficulty-filter-bar">
          <span className="difficulty-filter-label">Difficulty:</span>
          {["All", "Easy", "Medium", "Hard"].map((diff) => {
            const count =
              diff === "All"
                ? (allProblems || []).length
                : (allProblems || []).filter((p) => p.difficulty === diff)
                    .length;
            const isSelected = difficultyFilter === diff;
            return (
              <button
                key={diff}
                className={`difficulty-pill ${diff.toLowerCase()}-pill ${isSelected ? "selected" : ""}`}
                onClick={() => setDifficultyFilter(diff)}
              >
                {diff === "All" ? "All difficulties" : diff}{" "}
                <small>({count})</small>
              </button>
            );
          })}
        </div>

        {/* Topic Filters */}
        <div className="filters">
          {topics.map((topic) => (
            <button
              key={topic}
              onClick={() => setTopicFilter(topic)}
              className={topicFilter === topic ? "selected" : ""}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {(query ||
        topicFilter !== "All topics" ||
        difficultyFilter !== "All" ||
        statusFilter !== "All") && (
        <p className="muted" style={{ margin: "0 0 16px" }}>
          Showing {problems.length} problem{problems.length === 1 ? "" : "s"}
          {statusFilter !== "All" ? ` (${statusFilter})` : ""}
          {topicFilter !== "All topics" ? ` in ${topicFilter}` : ""}
          {difficultyFilter !== "All" ? ` • ${difficultyFilter}` : ""}
          {query ? ` matching “${query}”` : ""}
        </p>
      )}

      <div className="table">
        <div className="table-head">
          <span>PROBLEM</span>
          <span>TOPIC</span>
          <span>STATUS</span>
          <span>SOLVED</span>
          <span>NEXT REVIEW</span>
          <span style={{ textAlign: "right" }}>ACTIONS</span>
        </div>
        {problems.map((problem) => {
          const isProblemSolved = Boolean(problem.solvedAt);
          const history = getSolveHistory(problem);
          const solveCount = history.length;
          const lastDate = getLastSolvedDate(problem);
          const isExpanded = expandedNotesId === problem.id;
          const isPlanned = Boolean(
            problem.plannedDate && problem.plannedDate <= today,
          );
          const isDue = Boolean(
            problem.nextReview && problem.nextReview <= today,
          );
          const wasReviewedToday = problem.lastReviewed === today;
          const hasNotes = Boolean(
            problem.sqlCode ||
              problem.pythonCode ||
              problem.timeComplexity ||
              problem.notes,
          );
          const leetCodeUrl =
            problem.url ||
            (isSql
              ? getSqlLeetCodeUrl(problem.title)
              : getLeetCodeUrl(problem.title));

          return (
            <div className="table-row-wrapper" key={problem.id}>
              <div className={`table-row ${isProblemSolved ? "is-solved" : ""}`}>
                <div className="problem-cell">
                  <button
                    className={`solved-check-btn ${isProblemSolved ? "checked" : ""}`}
                    onClick={() =>
                      isProblemSolved ? resetProblem(problem) : markSolved(problem)
                    }
                    title={
                      isProblemSolved
                        ? "Mark as unsolved"
                        : "Mark as solved today"
                    }
                    aria-label={
                      isProblemSolved ? "Mark as unsolved" : "Mark as solved"
                    }
                  >
                    {isProblemSolved ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <Circle size={18} />
                    )}
                  </button>
                  <div>
                    <a
                      href={leetCodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="problem-title-link"
                      title={`Open "${problem.title}" directly on LeetCode`}
                    >
                      {problem.title}
                      <ArrowUpRight size={13} />
                    </a>
                    <span className="problem-tags">
                      <span className={`track-badge ${isSql ? "sql" : "dsa"}`}>
                        {isSql ? <Database size={10} /> : <Code2 size={10} />}
                        {isSql ? "SQL" : "DSA"}
                      </span>
                      {solveCount > 0 && (
                        <button
                          type="button"
                          className="problem-solve-tag"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenHistory?.(problem);
                          }}
                          title="Click to view solve timeline"
                        >
                          <History size={10} />
                          {solveCount}× (Last: {formatDate(lastDate)})
                        </button>
                      )}
                      {problem.timeComplexity && (
                        <span
                          className="complexity-tag"
                          title="Time / Query Complexity"
                        >
                          {problem.timeComplexity}
                        </span>
                      )}
                      {(problem.sqlCode || problem.pythonCode) && (
                        <span
                          className={`code-tag ${isSql ? "sql" : ""}`}
                          title={isSql ? "SQL Query Solution Saved" : "Python Solution Saved"}
                        >
                          {isSql ? <Database size={11} /> : <Code2 size={11} />}{" "}
                          {isSql ? "SQL" : "Py"}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <span>{problem.category}</span>
                <span
                  className={`status ${isProblemSolved ? "solved-badge" : problem.status}`}
                >
                  {isProblemSolved ? (
                    <>
                      <Check size={11} /> Solved
                    </>
                  ) : wasReviewedToday ? (
                    "reviewed today"
                  ) : isPlanned ? (
                    "planned today"
                  ) : (
                    problem.status
                  )}
                </span>
                <div className="solves-cell">
                  {solveCount > 0 ? (
                    <button
                      type="button"
                      className="solves-chip active"
                      onClick={() => onOpenHistory?.(problem)}
                      title="Click to view all solve dates"
                    >
                      <History size={12} />
                      <strong>{solveCount}×</strong>
                      <span className="solves-last-date">
                        Last: {formatDate(lastDate)}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="solves-chip zero"
                      onClick={() => onOpenHistory?.(problem)}
                      title="Click to view or record solves"
                    >
                      0 solves
                    </button>
                  )}
                </div>
                <span>
                  {wasReviewedToday
                    ? `Next: ${formatDate(problem.nextReview)}`
                    : isDue
                      ? "Due today"
                      : problem.nextReview
                        ? formatDate(problem.nextReview)
                        : "—"}
                </span>

                <div className="table-actions">
                  <button
                    className={`notes-btn ${hasNotes ? "has-notes" : ""} ${isExpanded ? "active" : ""}`}
                    onClick={() =>
                      setExpandedNotesId(isExpanded ? null : problem.id)
                    }
                    title={
                      isExpanded
                        ? "Collapse notes drawer"
                        : hasNotes
                          ? `View notes & ${isSql ? "SQL" : "Python"} code`
                          : "Add notes & code"
                    }
                  >
                    <FileCode2 size={13} />
                    {hasNotes ? "Notes ✓" : "Notes"}
                    <ChevronDown
                      size={12}
                      style={{
                        transform: isExpanded ? "rotate(180deg)" : "none",
                        transition: "transform 0.15s",
                      }}
                    />
                  </button>

                  {problem.status === "new" ? (
                    <>
                      <button
                        className={isPlanned ? "planned-action" : ""}
                        onClick={() => planProblem(problem)}
                      >
                        {isPlanned ? "In solve list" : "Add to solve list"}
                      </button>
                      <button
                        className="primary-action"
                        onClick={() => markSolved(problem)}
                      >
                        <Check size={14} /> Solved
                      </button>
                    </>
                  ) : wasReviewedToday ? (
                    <button
                      className="undo-button"
                      onClick={() => undoReview(problem)}
                    >
                      <Undo2 size={13} /> Undo review
                    </button>
                  ) : isDue ? (
                    <>
                      <button
                        className="again-action"
                        onClick={() => review(problem, "again")}
                        title="Review again tomorrow"
                      >
                        Again 1d
                      </button>
                      <button
                        className="remember-action"
                        onClick={() => review(problem, "good")}
                        title="Mark remembered"
                      >
                        <Check size={14} /> Remembered
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => review(problem, "good")}>
                        Review now
                      </button>
                      <button
                        className="reset-button"
                        title="Reset progress to new"
                        onClick={() => resetProblem(problem)}
                      >
                        <RotateCcw size={13} /> Reset
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isExpanded && (
                <ProblemNotesDrawer
                  problem={problem}
                  onEdit={() => onOpenNotes(problem)}
                  onClose={() => setExpandedNotesId(null)}
                  onOpenHistory={onOpenHistory}
                  today={today}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProblemNotesDrawer({
  problem,
  onEdit,
  onClose,
  onOpenHistory,
  today,
}) {
  const isSql = problem.track === "sql" || problem.id > 1000;
  const [copied, setCopied] = useState(false);
  const codeContent = isSql
    ? problem.sqlCode || problem.pythonCode || ""
    : problem.pythonCode || "";
  const hasCode = Boolean(codeContent && codeContent.trim());
  const hasComplexity = Boolean(
    problem.timeComplexity || problem.spaceComplexity,
  );
  const hasNotes = Boolean(problem.notes && problem.notes.trim());
  const history = getSolveHistory(problem);
  const hasHistory = history.length > 0;
  const lastDate = getLastSolvedDate(problem);

  function copyCode() {
    if (codeContent) {
      navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!hasCode && !hasComplexity && !hasNotes && !hasHistory) {
    return (
      <div className="notes-drawer">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            No solution or notes added yet for <strong>{problem.title}</strong>.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="primary"
              onClick={onEdit}
              style={{ padding: "6px 12px", fontSize: 11 }}
            >
              <Plus size={14} /> Add {isSql ? "SQL Query" : "Python Solution"} & Notes
            </button>
            <button
              className="undo-button"
              onClick={onClose}
              style={{ padding: "6px 10px", fontSize: 11 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-drawer">
      <div className="notes-drawer-content">
        <div className="notes-code-card">
          <div className="notes-code-header">
            <span>
              {isSql ? "💾 SQL Query Solution" : "🐍 Python 3 Solution"}
            </span>
            {hasCode && (
              <button
                className="copy-code-btn"
                onClick={copyCode}
                title="Copy code to clipboard"
              >
                <Copy size={11} /> {copied ? "Copied!" : "Copy code"}
              </button>
            )}
          </div>
          {hasCode ? (
            <pre className="notes-code-pre">
              <code>{codeContent}</code>
            </pre>
          ) : (
            <p
              style={{
                padding: 14,
                margin: 0,
                color: "var(--muted)",
                fontSize: 12,
              }}
            >
              No {isSql ? "SQL query" : "Python code"} entered yet. Click "Edit Solution" below to add code.
            </p>
          )}
        </div>

        <div className="notes-meta-card">
          <div className="notes-complexities">
            <div className="complexity-box">
              <span>{isSql ? "⏱ Execution / Complexity" : "⏱ Time Complexity"}</span>
              <strong>{problem.timeComplexity || "Not specified"}</strong>
            </div>
            <div className="complexity-box">
              <span>{isSql ? "💾 Memory / Temp Tables" : "💾 Space Complexity"}</span>
              <strong>{problem.spaceComplexity || "Not specified"}</strong>
            </div>
          </div>

          <div className="notes-approach-view">
            <span>{isSql ? "Query Logic & Edge Cases" : "Key Patterns & Approach Notes"}</span>
            <p>{problem.notes || "No notes written yet."}</p>
          </div>

          <div className="notes-solve-history-card">
            <div className="notes-solve-header">
              <strong>
                <History
                  size={13}
                  style={{ verticalAlign: "middle", marginRight: 5 }}
                />
                Solve Frequency & History
              </strong>
              {onOpenHistory && (
                <button
                  type="button"
                  className="text-button"
                  style={{ fontSize: 11, padding: "2px 6px" }}
                  onClick={() => onOpenHistory(problem)}
                >
                  View all dates →
                </button>
              )}
            </div>
            <div className="notes-solve-summary">
              <div>
                <span className="summary-label">TOTAL SOLVES</span>
                <span className="summary-value">
                  {history.length} time{history.length === 1 ? "" : "s"}
                </span>
              </div>
              <div>
                <span className="summary-label">LAST SOLVED</span>
                <span className="summary-value">
                  {lastDate
                    ? `${formatDate(lastDate)} (${formatRelativeDays(lastDate, today)})`
                    : "Never"}
                </span>
              </div>
            </div>
            {hasHistory && (
              <div className="dates-pill-list">
                {history
                  .slice(-5)
                  .reverse()
                  .map((date, i) => (
                    <span key={i} className="date-pill">
                      <Calendar size={10} />
                      {formatDate(date)}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="notes-drawer-actions">
        <button className="undo-button" onClick={onClose}>
          Collapse Notes
        </button>
        <button
          className="primary"
          onClick={onEdit}
          style={{ padding: "6px 12px", fontSize: 11 }}
        >
          <FileCode2 size={13} /> Edit Solution & Notes
        </button>
      </div>
    </div>
  );
}

function SolveHistoryModal({
  problem,
  onClose,
  onAddDate,
  onRemoveDate,
  today,
}) {
  const isSql = problem.track === "sql" || problem.id > 1000;
  const history = getSolveHistory(problem);
  const totalSolves = history.length;
  const lastDate = getLastSolvedDate(problem);
  const firstDate = history.length > 0 ? history[0] : null;
  const leetCodeUrl =
    problem.url ||
    (isSql
      ? getSqlLeetCodeUrl(problem.title)
      : getLeetCodeUrl(problem.title));

  const reversedHistory = useMemo(() => {
    return history
      .map((date, originalIndex) => ({ date, originalIndex }))
      .reverse();
  }, [history]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal solve-history-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 540 }}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">
              {isSql ? "SQL 50 TIMELINE" : "DSA TIMELINE"} & LOG
            </p>
            <h2>{problem.title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="solve-history-meta-bar">
          <span className={`track-badge ${isSql ? "sql" : "dsa"}`}>
            {isSql ? "SQL 50" : "DSA"}
          </span>
          <span className={`difficulty ${problem.difficulty.toLowerCase()}`}>
            {problem.difficulty}
          </span>
          <span className="cat-pill">{problem.category}</span>
          <a
            href={leetCodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="leetcode-link-btn"
          >
            LeetCode <ExternalLink size={12} />
          </a>
        </div>

        <div className="history-stat-grid">
          <div className="stat-card">
            <span className="stat-label">Total Solves</span>
            <span className="stat-value">{totalSolves}</span>
            <small>
              {totalSolves === 1 ? "1 time" : `${totalSolves} times`}
            </small>
          </div>
          <div className="stat-card">
            <span className="stat-label">Last Solved</span>
            <span className="stat-value" style={{ fontSize: 15 }}>
              {lastDate ? formatDate(lastDate) : "—"}
            </span>
            <small>
              {lastDate ? formatRelativeDays(lastDate, today) : "Not solved yet"}
            </small>
          </div>
          <div className="stat-card">
            <span className="stat-label">First Solved</span>
            <span className="stat-value" style={{ fontSize: 15 }}>
              {firstDate ? formatDate(firstDate) : "—"}
            </span>
            <small>
              {firstDate ? formatRelativeDays(firstDate, today) : "—"}
            </small>
          </div>
        </div>

        <div className="history-timeline-section">
          <div className="timeline-header">
            <h3>
              <Clock size={15} /> All Solve Dates ({totalSolves})
            </h3>
            <button
              type="button"
              className="text-button"
              style={{ fontSize: 12 }}
              onClick={() => onAddDate(problem, today)}
            >
              <Plus size={13} /> Record solve today
            </button>
          </div>

          {reversedHistory.length > 0 ? (
            <div className="timeline-list">
              {reversedHistory.map(({ date, originalIndex }, idx) => {
                const isLatest = idx === 0;
                return (
                  <div
                    key={`${date}-${originalIndex}`}
                    className={`timeline-entry ${isLatest ? "latest" : ""}`}
                  >
                    <span className="timeline-badge">
                      {isLatest ? "Latest" : `#${originalIndex + 1}`}
                    </span>
                    <div className="timeline-content">
                      <div className="timeline-date">
                        <Calendar
                          size={13}
                          style={{ color: "var(--muted)" }}
                        />
                        <strong>{formatFullDate(date)}</strong>
                      </div>
                      <span className="timeline-relative">
                        {formatRelativeDays(date, today)}
                      </span>
                    </div>
                    {onRemoveDate && (
                      <button
                        type="button"
                        className="delete-entry-btn"
                        onClick={() => onRemoveDate(problem, originalIndex)}
                        title="Remove this solve date entry"
                        aria-label="Remove date"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="history-empty-state">
              <CalendarDays size={32} opacity={0.4} />
              <p>You haven’t recorded any solves for this problem yet.</p>
              <button
                type="button"
                className="primary"
                style={{ fontSize: 12, padding: "6px 14px" }}
                onClick={() => onAddDate(problem, today)}
              >
                <Check size={14} /> Mark solved today
              </button>
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ProblemNotesModal({ problem, onClose, onSave }) {
  const isSql = problem.track === "sql" || problem.id > 1000;
  const initialCode = isSql
    ? problem.sqlCode || problem.pythonCode || ""
    : problem.pythonCode || "";

  const [code, setCode] = useState(initialCode);
  const [timeComplexity, setTimeComplexity] = useState(
    problem.timeComplexity || "",
  );
  const [spaceComplexity, setSpaceComplexity] = useState(
    problem.spaceComplexity || "",
  );
  const [notes, setNotes] = useState(problem.notes || "");

  const commonTimeDsa = [
    "O(1)",
    "O(log n)",
    "O(n)",
    "O(n log n)",
    "O(n²)",
    "O(2ⁿ)",
  ];
  const commonSpaceDsa = ["O(1)", "O(log n)", "O(n)", "O(n²)"];

  const commonTimeSql = [
    "Index Scan",
    "O(N)",
    "Hash Join",
    "Nested Loop",
    "O(N log N)",
  ];
  const commonSpaceSql = [
    "O(1)",
    "O(N) Temp Table",
    "O(N) Hash Table",
    "O(1) Streaming",
  ];

  function handleKeyDown(e) {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.target;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      target.value = val.substring(0, start) + "    " + val.substring(end);
      target.selectionStart = target.selectionEnd = start + 4;
      setCode(target.value);
    }
  }

  function submit(e) {
    e.preventDefault();
    onSave(problem.id, {
      sqlCode: isSql ? code : problem.sqlCode || "",
      pythonCode: !isSql ? code : problem.pythonCode || code,
      timeComplexity,
      spaceComplexity,
      notes,
    });
  }

  const defaultSnippet = isSql
    ? `-- SQL Query Solution for ${problem.title}
SELECT
    
FROM
    
WHERE
    ;`
    : `# Python 3 Solution for ${problem.title}
class Solution:
    def solve(self, *args, **kwargs):
        # Time: ${timeComplexity || "O(n)"}, Space: ${spaceComplexity || "O(1)"}
        pass
`;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal notes-modal"
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-title">
          <div>
            <p className="eyebrow">
              {isSql ? "SQL 50 • " : "DSA • "}
              {problem.category} • {problem.difficulty}
            </p>
            <h2>{problem.title} — Notes & Solution</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        <div className="complexity-row">
          <label>
            {isSql ? "Query / Execution Efficiency" : "Time Complexity"}
            <input
              value={timeComplexity}
              onChange={(e) => setTimeComplexity(e.target.value)}
              placeholder={isSql ? "e.g. Index Scan or O(N)" : "e.g. O(n) or O(n log n)"}
            />
            <div className="chip-row">
              {(isSql ? commonTimeSql : commonTimeDsa).map((chip) => (
                <button
                  type="button"
                  key={chip}
                  className={`chip ${timeComplexity === chip ? "active" : ""}`}
                  onClick={() => setTimeComplexity(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          </label>

          <label>
            {isSql ? "Memory / Temp Tables" : "Space Complexity"}
            <input
              value={spaceComplexity}
              onChange={(e) => setSpaceComplexity(e.target.value)}
              placeholder={isSql ? "e.g. O(1) or Temp Table" : "e.g. O(1) or O(n)"}
            />
            <div className="chip-row">
              {(isSql ? commonSpaceSql : commonSpaceDsa).map((chip) => (
                <button
                  type="button"
                  key={chip}
                  className={`chip ${spaceComplexity === chip ? "active" : ""}`}
                  onClick={() => setSpaceComplexity(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          </label>
        </div>

        <div className="code-editor-wrap">
          <label>
            {isSql ? "SQL Solution Query" : "Python Solution Code"}
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={defaultSnippet}
              spellCheck={false}
            />
          </label>
        </div>

        <label>
          {isSql
            ? "Query Logic, Join Conditions & Edge Cases"
            : "Approach, Key Patterns & Edge Cases"}
          <textarea
            className="notes-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isSql
                ? "e.g. Left join accounts on transaction_id. Handle NULL values with COALESCE..."
                : "e.g. Two-pointer technique from opposite ends. Handle duplicate elements..."
            }
          />
        </label>

        <div className="notes-actions">
          <button type="button" className="undo-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            <Check size={16} /> Save Notes & Code
          </button>
        </div>
      </form>
    </div>
  );
}

function AddProblem({ onClose, onAdd }) {
  const [form, setForm] = useState({
    title: "",
    track: "dsa",
    category: "Arrays & Hashing",
    difficulty: "Medium",
    url: "",
  });

  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  function handleTrackChange(newTrack) {
    setForm((current) => ({
      ...current,
      track: newTrack,
      category: newTrack === "sql" ? "Select" : "Arrays & Hashing",
    }));
  }

  function submit(event) {
    event.preventDefault();
    if (form.title.trim()) onAdd(form);
  }

  const categoryOptions =
    form.track === "sql" ? sqlTopics.slice(1) : dsaTopics.slice(1);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-title">
          <div>
            <p className="eyebrow">GROW YOUR LIBRARY</p>
            <h2>Add a problem</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
            Study Track
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={`dashboard-track-tab ${form.track === "dsa" ? "active" : ""}`}
              onClick={() => handleTrackChange("dsa")}
              style={{ flex: 1, justifyContent: "center" }}
            >
              <Code2 size={14} /> DSA (NeetCode)
            </button>
            <button
              type="button"
              className={`dashboard-track-tab ${form.track === "sql" ? "active" : ""}`}
              onClick={() => handleTrackChange("sql")}
              style={{ flex: 1, justifyContent: "center" }}
            >
              <Database size={14} /> SQL 50
            </button>
          </div>
        </div>

        <label>
          Problem name
          <input
            autoFocus
            required
            value={form.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder={
              form.track === "sql"
                ? "e.g. Managers with at Least 5 Direct Reports"
                : "e.g. Longest Consecutive Sequence"
            }
          />
        </label>

        <div className="form-grid">
          <label>
            Topic
            <select
              value={form.category}
              onChange={(event) => set("category", event.target.value)}
            >
              {categoryOptions.map((topic) => (
                <option key={topic}>{topic}</option>
              ))}
            </select>
          </label>
          <label>
            Difficulty
            <select
              value={form.difficulty}
              onChange={(event) => set("difficulty", event.target.value)}
            >
              {["Easy", "Medium", "Hard"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Problem link <span className="optional">optional</span>
          <input
            value={form.url}
            onChange={(event) => set("url", event.target.value)}
            placeholder="https://leetcode.com/problems/..."
          />
        </label>
        <button className="primary submit" type="submit">
          <Plus size={17} />
          Add to library
        </button>
      </form>
    </div>
  );
}

function HelpModal({ onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ maxWidth: 540 }}
      >
        <div className="modal-title">
          <div>
            <p className="eyebrow">LEARNING SYSTEM</p>
            <h2>How Dual-Track Spaced Repetition Works</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div style={{ lineHeight: 1.6, color: "var(--muted)", fontSize: 13 }}>
          <p>
            <strong style={{ color: "var(--ink)" }}>1. Solving:</strong> Mark
            any unsolved problem as solved. Your first recall will be scheduled 1
            day later.
          </p>
          <p>
            <strong style={{ color: "var(--ink)" }}>2. Spaced Intervals:</strong>{" "}
            Reviews occur at 1d, 3d, 7d, 14d, 30d, and 60d intervals. After 4
            successful recalls, the problem is marked <b>Mastered</b>.
          </p>
          <p>
            <strong style={{ color: "var(--ink)" }}>3. Independent 2-Problem Daily Caps:</strong>{" "}
            DSA and SQL 50 each have their own separate <b>2 reviews/day limit</b> (4 total/day max).
            Reviewing DSA problems does not use up your SQL revision slots and vice versa.
            Additional due reviews automatically roll forward into subsequent days without penalty.
          </p>
          <p>
            <strong style={{ color: "var(--ink)" }}>4. Instant Undo:</strong> If
            you accidentally click "Remembered", "Again", or "Solved", press{" "}
            <kbd>⌘Z</kbd> or click <b>Undo</b> on the toast or problem card to
            revert immediately.
          </p>
        </div>
        <button
          className="primary submit"
          onClick={onClose}
          style={{ marginTop: 14 }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function SettingsModal({
  onClose,
  problems,
  activity,
  setProblems,
  setActivity,
  dsaCount,
  sqlCount,
  masteredDsa,
  masteredSql,
  dark,
  setDark,
  showToast,
}) {
  const fileInputRef = useRef(null);

  function handleExportBackup() {
    const backupData = {
      app: "recall-revision-lab",
      version: 2,
      exportedAt: new Date().toISOString(),
      problems,
      activity,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recall-dual-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded complete data backup (JSON).");
  }

  function handleImportBackup(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!Array.isArray(parsed.problems)) {
          throw new Error("Invalid backup: missing problems list");
        }
        setProblems(parsed.problems);
        try {
          localStorage.setItem(
            "recall-problems-v1",
            JSON.stringify(parsed.problems),
          );
          localStorage.setItem(
            "recall-problems-backup-v1",
            JSON.stringify(parsed.problems),
          );
        } catch {}
        if (parsed.activity && typeof parsed.activity === "object") {
          setActivity(parsed.activity);
          try {
            localStorage.setItem(
              "recall-activity-v1",
              JSON.stringify(parsed.activity),
            );
          } catch {}
        }
        fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problems: parsed.problems,
            activity: parsed.activity || {},
          }),
        }).catch(() => {});
        showToast(
          `Restored ${parsed.problems.length} problems & notes from backup.`,
        );
        onClose();
      } catch (err) {
        showToast(`Failed to restore backup: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <div className="modal-title">
          <div>
            <p className="eyebrow">PREFERENCES & DATA</p>
            <h2>Settings</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong>Dark Mode</strong>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 12,
                  color: "var(--muted)",
                }}
              >
                Switch between light and dark themes
              </p>
            </div>
            <button
              className="icon-button theme-toggle"
              onClick={() => setDark((v) => !v)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--line)",
              paddingTop: 14,
              fontSize: 12,
              color: "var(--muted)",
              lineHeight: 1.6,
            }}
          >
            <span>
              <strong>NeetCode 150 (DSA):</strong> {dsaCount} problems ({masteredDsa} mastered)
            </span>
            <br />
            <span>
              <strong>LeetCode SQL 50:</strong> {sqlCount} problems ({masteredSql} mastered)
            </span>
            <br />
            <span>
              <strong>Total Curated Catalog:</strong> {dsaCount + sqlCount} problems ({masteredDsa + masteredSql} mastered)
            </span>
          </div>

          {/* Data Storage & Backup Section */}
          <div className="settings-data-section">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              <Database size={16} style={{ color: "var(--violet)" }} />
              <span>Data Storage & Resilience</span>
            </div>

            <div className="storage-info-box">
              <span>
                <strong>Zero-Data-Loss Architecture:</strong> Your solved problems,
                notes, SQL queries, and repetition schedules are safely preserved in browser
                <code>localStorage</code> with rolling backups and bidirectional self-healing sync.
              </span>
              <span>
                <strong>Git Pushes & Deployments:</strong> Whenever you push changes or deploy
                to Netlify, your solved problems and notes will <strong>never vanish</strong>.
                The app automatically merges your local progress and restores the server cache.
              </span>
            </div>

            <div className="backup-buttons-row">
              <button
                type="button"
                className="outline-button"
                onClick={handleExportBackup}
                title="Download all your problems, notes, code, and activity as a JSON backup"
              >
                <Download size={14} /> Export Backup (.json)
              </button>

              <label
                className="outline-button"
                title="Restore from a previously saved JSON backup file"
              >
                <Upload size={14} /> Restore Backup
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportBackup}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>
        </div>

        <button
          className="primary submit"
          onClick={onClose}
          style={{ marginTop: 18 }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
