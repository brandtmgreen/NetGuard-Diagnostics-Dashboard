import { PlannerTask } from "./types";

export const PLANNER_STORAGE_KEY = "netguard-planner-v1";
export const PLANNER_EVENT = "netguard-planner-change";

export const DEFAULT_PLANNER_TASKS: PlannerTask[] = [
  {
    id: "seed-review-alerts",
    title: "Review open detections",
    description: "Acknowledge or ignore every open detection and confirm whether follow-up is required.",
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    priority: "High",
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-firewall",
    title: "Verify firewall rules",
    description: "Check active NetGuard block rules and remove any expired or stale entries.",
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    priority: "Medium",
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-capture",
    title: "Confirm capture coverage",
    description: "Verify the Ethernet capture interface is active during a working day and tshark is healthy.",
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    priority: "Medium",
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-report",
    title: "Export weekly security report",
    description: "Generate the weekly report and store it with the operations record.",
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    priority: "Low",
    completed: false,
    createdAt: new Date().toISOString(),
  },
];

export function readPlannerTasks(): PlannerTask[] {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(PLANNER_STORAGE_KEY) : null;
    if (!raw) return DEFAULT_PLANNER_TASKS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_PLANNER_TASKS;
  } catch {
    return DEFAULT_PLANNER_TASKS;
  }
}

export function savePlannerTasks(tasks: PlannerTask[], notify = false): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(tasks));
    if (notify) window.dispatchEvent(new CustomEvent(PLANNER_EVENT, { detail: tasks }));
  } catch {
    // Storage can be unavailable in a hardened browser profile; the UI still works in-session.
  }
}

export function addPlannerTask(task: Omit<PlannerTask, "id" | "createdAt">): PlannerTask {
  const created: PlannerTask = {
    ...task,
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  savePlannerTasks([created, ...readPlannerTasks()], true);
  return created;
}
