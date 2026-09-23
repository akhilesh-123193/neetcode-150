import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  Bell,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Code2,
  Flame,
  Grid2X2,
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
  Trophy,
  Undo2,
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
import { starterProblems } from "../shared/neetcode150.js";
import "./styles.css";

const topics = [
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

function App() {
  const [problems, setProblems] = useState(starterProblems);
  const [activity, setActivity] = useState({});
  const [activePage, setActivePage] = useState("Dashboard");
  const [filter, setFilter] = useState("All topics");
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

  useEffect(() => {
    fetch("/api/state")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load your study data");
        return response.json();
      })
      .then((data) => {
        if (Array.isArray(data.problems) && data.problems.length > 0) {
          setProblems(data.problems);
        }
        setActivity(data.activity ?? {});
      })
      .catch(() => {
        showToast("Using offline library data. Changes will sync when online.");
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
  const reviewedToday = useMemo(
    () => problems.filter((problem) => problem.lastReviewed === today),
    [problems],
  );
  const completedTodayCount = reviewedToday.length;
  const remainingSlots = Math.max(0, dailyCap - completedTodayCount);

  const due = useMemo(() => {
    const unreviewed = problems.filter((p) => p.lastReviewed !== today);
    return getDueReviews(unreviewed, today, remainingSlots);
  }, [problems, remainingSlots]);

  const todayPlan = useMemo(
    () =>
      problems.filter(
        (problem) =>
          problem.status === "new" &&
          problem.plannedDate &&
          problem.plannedDate <= today,
      ),
    [problems],
  );

  const solvedToday = useMemo(
    () => problems.filter((problem) => problem.solvedAt === today),
    [problems],
  );

  const mastered = useMemo(
    () => problems.filter((problem) => problem.status === "mastered").length,
    [problems],
  );

  const filtered = useMemo(
    () =>
      problems.filter(
        (problem) =>
          (filter === "All topics" || problem.category === filter) &&
          problem.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [problems, filter, query],
  );

  const streak = useMemo(() => calculateStreak(activity, today), [activity]);

  const reviewSchedule = useMemo(
    () => buildReviewSchedule(problems, today),
    [problems],
  );

  async function updateProblem(problem, patch) {
    const updated = { ...problem, ...patch };
    setProblems((items) =>
      items.map((item) => (item.id === problem.id ? updated : item)),
    );
    try {
      await fetch(`/api/problems/${problem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      // Offline fallback: state already updated locally
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
    const patch = {
      status: "learning",
      repetitions: 0,
      plannedDate: null,
      solvedAt: today,
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
      // Revert lastReviewed flag manually
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
      const patch = {
        status: "new",
        repetitions: 0,
        solvedAt: null,
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

  async function addProblem(form) {
    try {
      const created = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        ...form,
      };
      setProblems((items) => [...items, localCreated]);
    }
    setModalOpen(false);
    showToast(`Added "${form.title}" to your problem library.`);
  }

  const content =
    activePage === "Dashboard" ? (
      <Dashboard
        problems={problems}
        due={due}
        todayPlan={todayPlan}
        reviewedToday={reviewedToday}
        solvedToday={solvedToday}
        mastered={mastered}
        streak={streak}
        dailyCap={dailyCap}
        completedTodayCount={completedTodayCount}
        review={review}
        undoReview={undoReview}
        undoSolve={undoSolve}
        planProblem={planProblem}
        markSolved={markSolved}
        setModalOpen={setModalOpen}
        setActivePage={setActivePage}
        activity={activity}
      />
    ) : activePage === "Review calendar" ? (
      <ReviewCalendar
        schedule={reviewSchedule}
        setActivePage={setActivePage}
        today={today}
      />
    ) : activePage === "Learning path" ? (
      <LearningPath
        problems={problems}
        setActivePage={setActivePage}
        setFilter={setFilter}
      />
    ) : (
      <ProblemsPage
        problems={filtered}
        totalCount={problems.length}
        filter={filter}
        query={query}
        setFilter={setFilter}
        setModalOpen={setModalOpen}
        review={review}
        undoReview={undoReview}
        planProblem={planProblem}
        markSolved={markSolved}
        resetProblem={resetProblem}
        today={today}
      />
    );

  return (
    <div className={`app-shell ${dark ? "dark" : ""}`}>
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        totalProblems={problems.length}
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
                  activePage !== "My problems"
                ) {
                  setActivePage("My problems");
                }
              }}
              placeholder="Search your problems..."
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
                showToast("All notifications up to date.")
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

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          problemsCount={problems.length}
          masteredCount={mastered}
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
  totalProblems,
  setHelpOpen,
  setSettingsOpen,
}) {
  const items = [
    [Home, "Dashboard"],
    [Layers3, "My problems"],
    [CalendarDays, "Review calendar"],
    [Target, "Learning path"],
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
        {items.map(([Icon, label]) => (
          <button
            key={label}
            className={activePage === label ? "nav-item active" : "nav-item"}
            onClick={() => setActivePage(label)}
          >
            <Icon size={19} />
            {label}
            {label === "My problems" && <b>{totalProblems}</b>}
          </button>
        ))}
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
            <strong>Become a master</strong>
            <span>Build your streak daily</span>
          </div>
          <ChevronRight size={17} />
        </div>
      </div>
    </aside>
  );
}

function Dashboard({
  problems,
  due,
  todayPlan,
  reviewedToday,
  solvedToday,
  mastered,
  streak,
  dailyCap,
  completedTodayCount,
  review,
  undoReview,
  undoSolve,
  planProblem,
  markSolved,
  setModalOpen,
  setActivePage,
  activity,
}) {
  const totalCount = problems.length;

  return (
    <section className="page dashboard">
      <div className="greeting-row">
        <div>
          <p className="eyebrow">{displayToday}</p>
          <h1>
            Good morning, Akhilesh <span>✦</span>
          </h1>
          <p className="muted">
            Solve as much as you want. Revision is focused at {dailyCap} problems
            a day.
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
              YOUR DAILY FOCUS
            </div>
            <h2>
              {completedTodayCount >= dailyCap
                ? "Daily goal completed!"
                : due.length
                  ? `${due.length} review${due.length === 1 ? "" : "s"} ready`
                  : "Build today’s plan"}
            </h2>
            <p>
              {completedTodayCount >= dailyCap
                ? `You finished your ${dailyCap} reviews today! Overdue reviews roll forward cleanly.`
                : due.length
                  ? `Your oldest due recalls are scheduled (target: ${dailyCap}/day).`
                  : "Choose any number of fresh problems and solve them at your pace."}
            </p>
            <button
              className="dark-button"
              onClick={() => {
                if (due.length > 0) {
                  document
                    .getElementById(`review-${due[0].id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                } else {
                  document
                    .getElementById("today-plan")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }}
            >
              {due.length ? (
                <>
                  Start reviewing <ArrowUpRight size={17} />
                </>
              ) : (
                <>
                  Choose problems <ArrowUpRight size={17} />
                </>
              )}
            </button>
          </div>
          <div className="orbit">
            <div className="orbit-ring ring-one" />
            <div className="orbit-ring ring-two" />
            <div className="orbit-core">
              <BrainCircuit size={44} />
            </div>
            <span className="float-card card-a">
              <Code2 size={15} />
              Recall
            </span>
            <span className="float-card card-b">
              <Trophy size={15} />
              Level 8
            </span>
          </div>
        </div>
        <StatCards
          mastered={mastered}
          streak={streak}
          totalCount={totalCount}
        />
      </div>

      <div className="content-grid">
        <div className="due-section">
          <section className="today-section" id="today-plan">
            <div className="section-heading">
              <div>
                <h2>
                  Today’s solve list <span>{todayPlan.length}</span>
                </h2>
                <p>
                  Pick fresh problems from your library—then mark them solved
                  to start their spaced repetition schedule.
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => setActivePage("My problems")}
              >
                Browse library <ChevronRight size={16} />
              </button>
            </div>

            <div className="problem-list">
              {todayPlan.length ? (
                todayPlan.map((problem) => (
                  <article className="problem-card plan-card" key={problem.id}>
                    <div className="problem-number">
                      {String(problem.id).padStart(2, "0")}
                    </div>
                    <div className="problem-info">
                      <h3>
                        {problem.title}
                        {problem.url && (
                          <a
                            href={problem.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ArrowUpRight size={15} />
                          </a>
                        )}
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
                  No problems in today’s solve list. Choose fresh problems from
                  your library to practice.
                </div>
              )}
            </div>

            {solvedToday.length > 0 && (
              <div className="reviewed-today-section">
                <h3>
                  <Check size={15} /> Solved today ({solvedToday.length})
                </h3>
                <div className="problem-list">
                  {solvedToday.map((problem) => (
                    <article
                      className="problem-card reviewed-card"
                      key={problem.id}
                    >
                      <div className="problem-number">
                        {String(problem.id).padStart(2, "0")}
                      </div>
                      <div className="problem-info">
                        <h3>{problem.title}</h3>
                        <p>
                          <span className="reviewed-badge">Solved</span>
                          Next recall scheduled:{" "}
                          <b>{formatDate(problem.nextReview)}</b>
                        </p>
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

          <section className="review-section">
            <div className="section-heading">
              <div>
                <h2>
                  Due for review{" "}
                  <span>
                    {completedTodayCount}/{dailyCap} completed
                  </span>
                </h2>
                <p>
                  At most {dailyCap} recalls are scheduled per day to prevent
                  burnout.
                </p>
              </div>
            </div>

            {completedTodayCount >= dailyCap && (
              <div className="daily-completed-banner">
                <div>
                  <strong>🎉 Daily review target completed!</strong>
                  <p>
                    You reviewed {completedTodayCount} problem
                    {completedTodayCount === 1 ? "" : "s"} today. Any further
                    recalls roll cleanly into tomorrow.
                  </p>
                </div>
                <button onClick={() => setActivePage("My problems")}>
                  Practice more in library
                </button>
              </div>
            )}

            <div className="problem-list">
              {due.length ? (
                due.map((problem) => (
                  <ProblemCard
                    key={problem.id}
                    problem={problem}
                    review={review}
                  />
                ))
              ) : completedTodayCount >= dailyCap ? null : (
                <div className="empty">
                  No recalls due today. Your next solved problem starts its
                  review cycle.
                </div>
              )}
            </div>

            {reviewedToday.length > 0 && (
              <div className="reviewed-today-section">
                <h3>
                  <Check size={15} /> Reviewed today ({reviewedToday.length})
                </h3>
                <div className="problem-list">
                  {reviewedToday.map((problem) => (
                    <article
                      className="problem-card reviewed-card"
                      key={problem.id}
                    >
                      <div className="problem-number">
                        {String(problem.id).padStart(2, "0")}
                      </div>
                      <div className="problem-info">
                        <h3>{problem.title}</h3>
                        <p>
                          <span className="reviewed-badge">
                            {problem.lastReviewQuality === "again"
                              ? "Again (1d)"
                              : "Remembered"}
                          </span>
                          Next review: <b>{formatDate(problem.nextReview)}</b>
                        </p>
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

        <ProgressCard
          problems={problems}
          activity={activity}
          setActivePage={setActivePage}
          today={today}
        />
      </div>
    </section>
  );
}

function StatCards({ mastered, streak, totalCount }) {
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
            ? "Keep it alive with one study action today."
            : "Complete a solve or review to start your streak."}
        </em>
      </div>
      <div className="stat-card">
        <div className="stat-icon violet">
          <Trophy size={20} />
        </div>
        <span>Mastered</span>
        <strong>
          {mastered}
          <small>/ {totalCount}</small>
        </strong>
        <div className="progress">
          <i
            style={{
              width: `${totalCount ? (mastered / totalCount) * 100 : 0}%`,
            }}
          />
        </div>
        <em>{Math.max(0, totalCount - mastered)} problems to go</em>
      </div>
    </>
  );
}

function ProblemCard({ problem, review }) {
  const nextRememberInterval =
    intervals[Math.min((problem.repetitions ?? 0) + 1, intervals.length - 1)];

  return (
    <article className="problem-card" id={`review-${problem.id}`}>
      <div className="problem-number">
        {String(problem.id).padStart(2, "0")}
      </div>
      <div className="problem-info">
        <h3>
          {problem.title}
          {problem.url && (
            <a href={problem.url} target="_blank" rel="noreferrer">
              <ArrowUpRight size={15} />
            </a>
          )}
        </h3>
        <p>
          {problem.category}
          <span>•</span>
          <b className={`difficulty ${problem.difficulty.toLowerCase()}`}>
            {problem.difficulty}
          </b>
        </p>
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

function ProgressCard({ problems, activity, setActivePage, today }) {
  const total = problems.length || 1;
  const solved = problems.filter((problem) => problem.solvedAt).length;
  const days = buildHeatmap(activity, today);

  return (
    <aside className="progress-card">
      <div className="section-heading">
        <div>
          <h2>Your progress</h2>
          <p>Based on your recorded study actions.</p>
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
          <strong>NeetCode Catalog</strong>
          <p>
            {solved} of {total} solved
          </p>
          <div className="legend">
            <i />
            <span>Solved percentage</span>
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

function ReviewCalendar({ schedule, setActivePage, today }) {
  const [selectedDate, setSelectedDate] = useState(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const firstWeekday = new Date(`${monthStart}T12:00:00`).getDay();
  const calendarDays = Array.from({ length: 42 }, (_, index) =>
    addDays(monthStart, index - firstWeekday),
  );
  const monthName = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${monthStart}T12:00:00`));

  const selectedReviews = schedule[selectedDate] ?? [];

  return (
    <section className="page calendar-page">
      <div className="greeting-row">
        <div>
          <p className="eyebrow">SPACED REPETITION PLAN</p>
          <h1>Review calendar</h1>
          <p className="muted">
            Reviews are scheduled with a 2-problem daily limit. Click any date to
            inspect planned recalls.
          </p>
        </div>
        <button className="primary" onClick={() => setActivePage("Dashboard")}>
          <Home size={17} />
          Back to dashboard
        </button>
      </div>
      <div className="calendar-layout">
        <div className="calendar-card">
          <div className="calendar-header">
            <h2>{monthName}</h2>
            <span>Each dot is one scheduled review (max 2/day)</span>
          </div>
          <div className="calendar-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarDays.map((date) => {
              const planned = schedule[date] ?? [];
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
                      <i key={problem.id} title={problem.title} />
                    ))}
                  </div>
                  {planned.length > 0 && <small>{planned.length}/2</small>}
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
              {selectedReviews.map((problem) => (
                <div className="agenda-item" key={problem.id}>
                  <div className="agenda-number">
                    {String(problem.id).padStart(2, "0")}
                  </div>
                  <div>
                    <strong>{problem.title}</strong>
                    <span>{problem.category}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Clear for this date.</div>
          )}
          <div className="calendar-note">
            <CalendarDays size={18} />
            <p>
              When more than 2 reviews land on the same day, extra reviews
              automatically roll forward into subsequent days.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function LearningPath({ problems, setActivePage, setFilter }) {
  const categoryStats = useMemo(() => {
    return topics.slice(1).map((category) => {
      const topicProblems = problems.filter((p) => p.category === category);
      const total = topicProblems.length;
      const solved = topicProblems.filter((p) => p.solvedAt).length;
      const mastered = topicProblems.filter(
        (p) => p.status === "mastered",
      ).length;
      const easy = topicProblems.filter((p) => p.difficulty === "Easy").length;
      const medium = topicProblems.filter(
        (p) => p.difficulty === "Medium",
      ).length;
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
  }, [problems]);

  return (
    <section className="page learning-path-page">
      <div className="greeting-row">
        <div>
          <p className="eyebrow">CURRICULUM ROADMAP</p>
          <h1>Learning path</h1>
          <p className="muted">
            Master all 18 core topics in the NeetCode curriculum step by step.
          </p>
        </div>
        <button className="primary" onClick={() => setActivePage("Dashboard")}>
          <Home size={17} />
          Back to dashboard
        </button>
      </div>

      <div className="learning-path-grid">
        {categoryStats.map((item) => (
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
                  setFilter(item.category);
                  setActivePage("My problems");
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
  problems,
  totalCount,
  filter,
  query,
  setFilter,
  setModalOpen,
  review,
  undoReview,
  planProblem,
  markSolved,
  resetProblem,
  today,
}) {
  return (
    <section className="page problems-page">
      <div className="greeting-row">
        <div>
          <p className="eyebrow">YOUR LIBRARY</p>
          <h1>My problems</h1>
          <p className="muted">
            Browse all {totalCount} curated problems. Add them to today’s solve
            list or practice them anytime.
          </p>
        </div>
        <button className="primary" onClick={() => setModalOpen(true)}>
          <Plus size={18} />
          Add problem
        </button>
      </div>

      <div className="filters">
        {topics.map((topic) => (
          <button
            key={topic}
            onClick={() => setFilter(topic)}
            className={filter === topic ? "selected" : ""}
          >
            {topic}
          </button>
        ))}
      </div>

      {query && (
        <p className="muted" style={{ margin: "0 0 16px" }}>
          Showing {problems.length} result{problems.length === 1 ? "" : "s"} for
          “{query}”
        </p>
      )}

      <div className="table">
        <div className="table-head">
          <span>PROBLEM</span>
          <span>TOPIC</span>
          <span>STATUS</span>
          <span>NEXT REVIEW</span>
          <span style={{ textAlign: "right" }}>ACTIONS</span>
        </div>
        {problems.map((problem) => {
          const isPlanned = Boolean(
            problem.plannedDate && problem.plannedDate <= today,
          );
          const isDue = Boolean(
            problem.nextReview && problem.nextReview <= today,
          );
          const wasReviewedToday = problem.lastReviewed === today;

          return (
            <div className="table-row" key={problem.id}>
              <div>
                <strong>{problem.title}</strong>
                {problem.url && (
                  <a href={problem.url} target="_blank" rel="noreferrer">
                    <ArrowUpRight size={14} />
                  </a>
                )}
              </div>
              <span>{problem.category}</span>
              <span className={`status ${problem.status}`}>
                {wasReviewedToday
                  ? "reviewed today"
                  : isPlanned
                    ? "planned today"
                    : problem.status}
              </span>
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
          );
        })}
      </div>
    </section>
  );
}

function AddProblem({ onClose, onAdd }) {
  const [form, setForm] = useState({
    title: "",
    category: "Arrays & Hashing",
    difficulty: "Medium",
    url: "",
  });

  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  function submit(event) {
    event.preventDefault();
    if (form.title.trim()) onAdd(form);
  }

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
        <label>
          Problem name
          <input
            autoFocus
            required
            value={form.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder="e.g. Longest Consecutive Sequence"
          />
        </label>
        <div className="form-grid">
          <label>
            Topic
            <select
              value={form.category}
              onChange={(event) => set("category", event.target.value)}
            >
              {topics.slice(1).map((topic) => (
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
            <h2>How Spaced Repetition Works</h2>
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
            <strong style={{ color: "var(--ink)" }}>3. Daily Focus Cap:</strong>{" "}
            To avoid cognitive overload, revision is capped at 2 problems per
            day. Additional due reviews automatically roll forward into
            subsequent days.
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
  problemsCount,
  masteredCount,
  dark,
  setDark,
  showToast,
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ maxWidth: 500 }}
      >
        <div className="modal-title">
          <div>
            <p className="eyebrow">PREFERENCES</p>
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
            }}
          >
            <span>Total problems in catalog: {problemsCount}</span>
            <br />
            <span>Mastered problems: {masteredCount}</span>
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
