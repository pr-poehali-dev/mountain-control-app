const API = {
  auth: "https://functions.poehali.dev/9ef13688-d7fb-45f4-8fd3-cdf77d286250",
  personnel: "https://functions.poehali.dev/19d28244-fece-4d02-a90e-264fa78b5256",
  dispatcher: "https://functions.poehali.dev/fe833e96-793f-499d-9191-cf6b56d5664e",
  medical: "https://functions.poehali.dev/18f5df53-3ffc-4e98-b0e9-f4c07a9ba918",
  events: "https://functions.poehali.dev/7ddc9847-facb-4e59-8cfe-6b535f9fa0cd",
  scanner: "https://functions.poehali.dev/58bc1a4c-940f-4d64-ba57-f78ad93367b1",
  reports: "https://functions.poehali.dev/fdbae00e-f203-48ec-97ae-6e89fc47a5cf",
  aho: "https://functions.poehali.dev/4fe7a896-fe95-4550-81d3-a5412844f65e",
  lampRoom: "https://functions.poehali.dev/a93fd43f-fb15-4e41-a64b-ccff98c24ca5",
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
    request(API.auth, "", { method: "POST", body, params: { action: "register" } }),
  login: (body: Record<string, unknown>) =>
    request(API.auth, "", { method: "POST", body, params: { action: "login" } }),
  loginByCode: (code: string) =>
    request(API.auth, "", { method: "POST", body: { code }, params: { action: "login-code" } }),
  me: () => request(API.auth, "", { params: { action: "me" } }),
  logout: () => request(API.auth, "", { method: "POST", params: { action: "logout" } }),
};

export const personnelApi = {
  getAll: (params?: Record<string, string>) =>
    request(API.personnel, "", { params: { action: "list", ...params } }),
  getStats: () => request(API.personnel, "", { params: { action: "stats" } }),
  add: (body: Record<string, unknown>) =>
    request(API.personnel, "", { method: "POST", body, params: { action: "add" } }),
  updateStatus: (id: number, status: string) =>
    request(API.personnel, "", {
      method: "PUT",
      body: { id, status },
      params: { action: "status" },
    }),
  search: (q: string) =>
    request(API.personnel, "", { params: { action: "search", q } }),
  edit: (body: Record<string, unknown>) =>
    request(API.personnel, "", { method: "PUT", body, params: { action: "edit" } }),
  getHistory: (id: number) =>
    request(API.personnel, "", { params: { action: "history", id: String(id) } }),
};

export const dispatcherApi = {
  getLanterns: (params?: Record<string, string>) =>
    request(API.dispatcher, "", { params: { action: "list", ...params } }),
  getStats: () => request(API.dispatcher, "", { params: { action: "stats" } }),
  getAvailable: () => request(API.dispatcher, "", { params: { action: "available" } }),
  searchPerson: (q: string) =>
    request(API.dispatcher, "", { params: { action: "search", q } }),
  issue: (lantern_id: number, person_id: number) =>
    request(API.dispatcher, "", {
      method: "POST",
      body: { lantern_id, person_id },
      params: { action: "issue" },
    }),
  issueByCode: (code: string, lantern_id: number) =>
    request(API.dispatcher, "", {
      method: "POST",
      body: { code, lantern_id },
      params: { action: "issue-by-code" },
    }),
  returnLantern: (lantern_id: number, condition?: string) =>
    request(API.dispatcher, "", {
      method: "POST",
      body: { lantern_id, condition: condition || "normal" },
      params: { action: "return" },
    }),
  getMessages: () => request(API.dispatcher, "", { params: { action: "messages" } }),
  sendMessage: (sender_name: string, message: string, is_urgent = false) =>
    request(API.dispatcher, "", {
      method: "POST",
      body: { sender_name, message, is_urgent },
      params: { action: "message" },
    }),
};

export const medicalApi = {
  getChecks: (params?: Record<string, string>) =>
    request(API.medical, "", { params: { action: "list", ...params } }),
  getStats: (params?: Record<string, string>) =>
    request(API.medical, "", { params: { action: "stats", ...params } }),
  getShift: () => request(API.medical, "", { params: { action: "shift" } }),
  getExportUrl: (params?: Record<string, string>) => {
    const qs = new URLSearchParams({ action: "export", ...params }).toString();
    return `${API.medical}?${qs}`;
  },
  addCheck: (body: Record<string, unknown>) =>
    request(API.medical, "", { method: "POST", body, params: { action: "add" } }),
  scan: (code: string) =>
    request(API.medical, "", { method: "POST", body: { code }, params: { action: "scan" } }),
  deny: (code: string, reason: string) =>
    request(API.medical, "", { method: "POST", body: { code, reason }, params: { action: "deny" } }),
  getSchedule: () =>
    request(API.medical, "", { params: { action: "schedule" } }),
  saveSchedule: (body: { day_start: string; day_end: string; night_start: string; night_end: string }) =>
    request(API.medical, "", { method: "POST", body, params: { action: "schedule" } }),
};

export const eventsApi = {
  getEvents: (limit = 20) =>
    request(API.events, "", { params: { action: "list", limit: String(limit) } }),
  getDashboard: () => request(API.events, "", { params: { action: "dashboard" } }),
  getNotifications: (limit = 30) =>
    request(API.events, "", { params: { action: "notifications", limit: String(limit) } }),
  markRead: (id: number) =>
    request(API.events, "", { method: "PUT", body: { id }, params: { action: "read" } }),
  markAllRead: () =>
    request(API.events, "", { method: "PUT", body: {}, params: { action: "read-all" } }),
};

export const reportsApi = {
  getReport: (reportType: string, params?: Record<string, string>) =>
    request(API.reports, "", { params: { action: reportType, ...params } }),
  getExportUrl: (reportType: string, params?: Record<string, string>) => {
    const qs = new URLSearchParams({ action: "export", report_type: reportType, ...params }).toString();
    return `${API.reports}?${qs}`;
  },
};

export const ahoApi = {
  upload: (body: Record<string, unknown>) =>
    request(API.aho, "", { method: "POST", body, params: { action: "upload" } }),
  getList: (params?: Record<string, string>) =>
    request(API.aho, "", { params: { action: "list", ...params } }),
  getBatches: () =>
    request(API.aho, "", { params: { action: "batches" } }),
  checkIn: (id: number) =>
    request(API.aho, "", { method: "PUT", body: { id }, params: { action: "checkin" } }),
  checkOut: (id: number) =>
    request(API.aho, "", { method: "PUT", body: { id }, params: { action: "checkout" } }),
  assignRoom: (id: number, room: string, building: string) =>
    request(API.aho, "", { method: "PUT", body: { id, room, building }, params: { action: "assign-room" } }),
  getStats: () =>
    request(API.aho, "", { params: { action: "stats" } }),
  getMedicalStatus: (params?: Record<string, string>) =>
    request(API.aho, "", { params: { action: "medical-status", ...params } }),
  getTemplate: () =>
    request(API.aho, "", { params: { action: "template" } }),
  massCheckIn: (body: Record<string, unknown>) =>
    request(API.aho, "", { method: "PUT", body, params: { action: "mass-checkin" } }),
  massCheckOut: (body: Record<string, unknown>) =>
    request(API.aho, "", { method: "PUT", body, params: { action: "mass-checkout" } }),
  getMedicalItrStats: (params?: Record<string, string>) =>
    request(API.aho, "", { params: { action: "medical-itr-stats", ...params } }),
  getItrPositions: () =>
    request(API.aho, "", { params: { action: "itr-positions" } }),
  saveItrPositions: (positions: string[]) =>
    request(API.aho, "", { method: "PUT", body: { positions }, params: { action: "itr-positions" } }),
  resetData: (resetType: string) =>
    request(API.aho, "", { method: "POST", body: { reset_type: resetType }, params: { action: "reset" } }),
  exportAllData: () =>
    request(API.aho, "", { params: { action: "export-all" } }),
};

export const scannerApi = {
  identify: (code: string) =>
    request(API.scanner, "", { method: "POST", body: { code }, params: { action: "identify" } }),
  checkin: (code: string, checkinAction = "checkin") =>
    request(API.scanner, "", {
      method: "POST",
      body: { code, action: checkinAction },
      params: { action: "checkin" },
    }),
  getRecent: () => request(API.scanner, "", { params: { action: "recent" } }),
};

export const lampRoomApi = {
  getIssues: (params?: Record<string, string>) =>
    request(API.lampRoom, "", { params: { action: "list", ...params } }),
  getStats: () =>
    request(API.lampRoom, "", { params: { action: "stats" } }),
  search: (q: string) =>
    request(API.lampRoom, "", { params: { action: "search", q } }),
  getDenials: (params?: Record<string, string>) =>
    request(API.lampRoom, "", { params: { action: "denials", ...params } }),
  identify: (code: string) =>
    request(API.lampRoom, "", { method: "POST", body: { code }, params: { action: "identify" } }),
  issue: (body: Record<string, unknown>) =>
    request(API.lampRoom, "", { method: "POST", body, params: { action: "issue" } }),
  returnItem: (issue_id: number, condition?: string) =>
    request(API.lampRoom, "", { method: "POST", body: { issue_id, condition: condition || "normal" }, params: { action: "return" } }),
  deny: (body: Record<string, unknown>) =>
    request(API.lampRoom, "", { method: "POST", body, params: { action: "deny" } }),
};

export default API;