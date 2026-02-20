const API = {
  auth: "https://functions.poehali.dev/9ef13688-d7fb-45f4-8fd3-cdf77d286250",
  personnel: "https://functions.poehali.dev/19d28244-fece-4d02-a90e-264fa78b5256",
  dispatcher: "https://functions.poehali.dev/fe833e96-793f-499d-9191-cf6b56d5664e",
  medical: "https://functions.poehali.dev/18f5df53-3ffc-4e98-b0e9-f4c07a9ba918",
  events: "https://functions.poehali.dev/7ddc9847-facb-4e59-8cfe-6b535f9fa0cd",
  scanner: "https://functions.poehali.dev/58bc1a4c-940f-4d64-ba57-f78ad93367b1",
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

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Нет связи с сервером. Проверьте интернет-соединение.");
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Ошибка ответа сервера");
  }

  if (!res.ok) {
    throw new Error(data.error || data.errorMessage || "Ошибка сервера");
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
