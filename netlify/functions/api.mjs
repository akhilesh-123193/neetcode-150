import { getStore } from "@netlify/blobs";
import { starterProblems } from "../../shared/neetcode150.js";

let memoryFallback = {
  problems: starterProblems,
  activity: {},
};

function getSafeStore() {
  try {
    return getStore("recall-data", { consistency: "strong" });
  } catch (err) {
    console.warn("Could not initialize @netlify/blobs:", err?.message || err);
    return null;
  }
}

async function getData(store) {
  if (!store) return memoryFallback;
  try {
    const data = await store.get("state", { type: "json" });
    if (!data || !Array.isArray(data.problems)) {
      return { problems: starterProblems, activity: {} };
    }
    const knownTitles = new Set(data.problems.map((problem) => problem.title));
    return {
      problems: [
        ...data.problems.map((p) => ({
          ...p,
          track: p.track || (p.id > 1000 ? "sql" : "dsa"),
        })),
        ...starterProblems.filter((problem) => !knownTitles.has(problem.title)),
      ],
      activity: data.activity ?? {},
    };
  } catch (err) {
    console.warn("Netlify blobs get failed, using fallback:", err?.message || err);
    return memoryFallback;
  }
}

async function saveData(store, nextData) {
  memoryFallback = nextData;
  if (!store) return;
  try {
    await store.setJSON("state", nextData);
  } catch (err) {
    console.warn("Netlify blobs setJSON failed:", err?.message || err);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (request) => {
  const url = new URL(request.url);
  const route =
    url.pathname
      .replace(/^\/.netlify\/functions\/api/, "")
      .replace(/^\/api/, "") || "/";
  const store = getSafeStore();

  if (request.method === "GET" && route === "/state") {
    return json(await getData(store));
  }

  if (request.method === "POST" && route === "/state") {
    try {
      const { problems, activity } = await request.json();
      const current = await getData(store);
      const nextData = {
        problems: Array.isArray(problems) ? problems : current.problems,
        activity:
          activity && typeof activity === "object" ? activity : current.activity,
      };
      await saveData(store, nextData);
      return json({ success: true, count: nextData.problems.length });
    } catch (err) {
      return json({ error: err?.message || "Invalid payload" }, 400);
    }
  }

  const data = await getData(store);
  if (request.method === "POST" && route === "/problems") {
    try {
      const body = await request.json();
      const problem = {
        id: Date.now(),
        status: "new",
        repetitions: 0,
        nextReview: null,
        plannedDate: null,
        ...body,
      };
      data.problems.push(problem);
      await saveData(store, data);
      return json(problem, 201);
    } catch (err) {
      return json({ error: err?.message || "Invalid payload" }, 400);
    }
  }

  if (request.method === "POST" && route === "/activity") {
    try {
      const { date, delta = 1 } = await request.json();
      if (!date) return json({ error: "Date is required" }, 400);
      const newCount = Math.max(0, (data.activity[date] ?? 0) + delta);
      if (newCount === 0) {
        delete data.activity[date];
      } else {
        data.activity[date] = newCount;
      }
      await saveData(store, data);
      return json({ date, count: data.activity[date] ?? 0 });
    } catch (err) {
      return json({ error: err?.message || "Invalid payload" }, 400);
    }
  }

  const match = route.match(/^\/problems\/(\d+)$/);
  if (request.method === "PATCH" && match) {
    try {
      const problem = data.problems.find((item) => item.id === Number(match[1]));
      if (!problem) return json({ error: "Problem not found" }, 404);
      Object.assign(problem, await request.json());
      await saveData(store, data);
      return json(problem);
    } catch (err) {
      return json({ error: err?.message || "Invalid payload" }, 400);
    }
  }

  if (request.method === "DELETE" && match) {
    const id = Number(match[1]);
    const index = data.problems.findIndex((item) => item.id === id);
    if (index === -1) return json({ error: "Problem not found" }, 404);
    data.problems.splice(index, 1);
    await saveData(store, data);
    return json({ success: true, id });
  }

  return json({ error: "Not found" }, 404);
};
