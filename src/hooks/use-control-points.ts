import { useEffect, useState } from "react";
import { checkpointApi } from "@/lib/api";

export interface ControlPointSettings {
  counts_territory: boolean;
  require_on_site: boolean;
  check_pass: boolean;
  require_medical: boolean;
  vehicles: boolean;
}

export interface ControlPoint {
  id: number;
  name: string;
  short_name: string;
  description: string;
  icon: string;
  is_main: boolean;
  is_active: boolean;
  sort_order: number;
  settings: ControlPointSettings;
  page_key: string;
}

const EVENT = "control-points-changed";
const CACHE_KEY = "mc_points";

let cache: ControlPoint[] | null = (() => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ControlPoint[]) : null;
  } catch {
    return null;
  }
})();
let pending: Promise<ControlPoint[]> | null = null;

function fetchPoints(): Promise<ControlPoint[]> {
  if (!pending) {
    pending = checkpointApi
      .getPoints()
      .then((d) => {
        cache = (d.points || []) as ControlPoint[];
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        return cache;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

export function notifyControlPointsChanged() {
  fetchPoints()
    .catch(() => cache || [])
    .then(() => window.dispatchEvent(new Event(EVENT)));
}

export function pointPath(p: Pick<ControlPoint, "id" | "is_main">) {
  return p.is_main ? "/checkpoint" : `/point/${p.id}`;
}

export function useControlPoints(enabled = true) {
  const [points, setPoints] = useState<ControlPoint[]>(cache || []);
  const [loaded, setLoaded] = useState(!!cache);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const sync = () => {
      if (alive && cache) {
        setPoints(cache);
        setLoaded(true);
      }
    };
    fetchPoints().then(sync).catch(() => setLoaded(true));
    window.addEventListener(EVENT, sync);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, sync);
    };
  }, [enabled]);

  return { points, loaded, extra: points.filter((p) => !p.is_main) };
}
