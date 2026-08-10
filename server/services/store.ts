import fs from "fs";
import path from "path";
import type {
  ThreatResponseReport,
  FirewallRule,
  PlannerTask,
  SystemAlert,
  ThreatLog,
} from "../../src/types";

export interface StoreShape {
  threatReports: ThreatResponseReport[];
  firewallRules: FirewallRule[];
  plannerTasks: PlannerTask[];
  alerts: SystemAlert[];
  threatLogs: ThreatLog[];
  securityScore: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

const EMPTY: StoreShape = {
  threatReports: [],
  firewallRules: [],
  plannerTasks: [],
  alerts: [],
  threatLogs: [],
  securityScore: 100,
};

let cache: StoreShape | null = null;

function load(): StoreShape {
  if (cache) return cache;
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoreShape>;
      cache = { ...EMPTY, ...parsed };
    } else {
      cache = { ...EMPTY };
    }
  } catch (err) {
    console.error("[STORE] Failed to read store, starting empty:", err);
    cache = { ...EMPTY };
  }
  return cache;
}

export function getStore(): StoreShape {
  return load();
}

export function saveStore(next: Partial<StoreShape>): StoreShape {
  const current = load();
  cache = { ...current, ...next };
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${STORE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), "utf8");
    fs.renameSync(tmp, STORE_FILE);
  } catch (err) {
    console.error("[STORE] Failed to persist store:", err);
  }
  return cache;
}

export function resetStore(): StoreShape {
  cache = { ...EMPTY };
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (err) {
    console.error("[STORE] Failed to reset store:", err);
  }
  return cache;
}
