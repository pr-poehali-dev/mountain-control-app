import urls from "../../backend/func2url.json";

const API = {
  auth: urls.auth,
  personnel: urls.personnel,
  dispatcher: urls.dispatcher,
  medical: urls.medical,
  events: urls.events,
  scanner: urls.scanner,
};

function getToken(): string | null {
  return localStorage.getItem("mc_token");
}

export function setToken(token: string) {
  localStorage.setItem("mc_token", token);
}

export function clearToken() {
  localStorage.removeItem("mc_token");
  localStorage.removeItem("mc_user");
}

export function getStoredUser() {
  const raw = localStorage.getItem("mc_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: Record<string, unknown>) {
  localStorage.setItem("mc_user", JSON.stringify(user));
}

async function request(
  base: string,
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    params?: Record<string, string>;
  } = {}
) {
  const { method = "GET", body, params } = options;
  const token = getToken();

  let url = `${base}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Ошибка сервера");
  }

  return data;
}

export const authApi = {
  register: (body: Record<string, unknown>) =>
    request(API.auth, "/register", { method: "POST", body }),
  login: (body: Record<string, unknown>) =>
    request(API.auth, "/login", { method: "POST", body }),
  loginByCode: (code: string) =>
    request(API.auth, "/login-code", { method: "POST", body: { code } }),
  me: () => request(API.auth, "/me"),
  logout: () => request(API.auth, "/logout", { method: "POST" }),
};

export const personnelApi = {
  getAll: (params?: Record<string, string>) =>
    request(API.personnel, "/", { params }),
  getStats: () => request(API.personnel, "/stats"),
  add: (body: Record<string, unknown>) =>
    request(API.personnel, "/", { method: "POST", body }),
  updateStatus: (id: number, status: string) =>
    request(API.personnel, "/status", {
      method: "PUT",
      body: { id, status },
    }),
  search: (q: string) =>
    request(API.personnel, "/search", { params: { q } }),
};

export const dispatcherApi = {
  getLanterns: () => request(API.dispatcher, "/"),
  getStats: () => request(API.dispatcher, "/stats"),
  issue: (lantern_id: number, person_id: number) =>
    request(API.dispatcher, "/issue", {
      method: "POST",
      body: { lantern_id, person_id },
    }),
  returnLantern: (lantern_id: number, condition?: string) =>
    request(API.dispatcher, "/return", {
      method: "POST",
      body: { lantern_id, condition: condition || "normal" },
    }),
};

export const medicalApi = {
  getChecks: () => request(API.medical, "/"),
  getStats: () => request(API.medical, "/stats"),
  addCheck: (body: Record<string, unknown>) =>
    request(API.medical, "/", { method: "POST", body }),
};

export const eventsApi = {
  getEvents: (limit = 20) =>
    request(API.events, "/", { params: { limit: String(limit) } }),
  getDashboard: () => request(API.events, "/dashboard"),
};

export const scannerApi = {
  identify: (code: string) =>
    request(API.scanner, "/identify", { method: "POST", body: { code } }),
  checkin: (code: string, action = "checkin") =>
    request(API.scanner, "/checkin", {
      method: "POST",
      body: { code, action },
    }),
  getRecent: () => request(API.scanner, "/recent"),
};

export default API;