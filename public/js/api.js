/**
 * API CLIENT — pembungkus fetch untuk service /api/v1
 * ====================================================
 * Hanya mengurus "cara memanggil endpoint" + merapikan error menjadi
 * satu objek ApiError { status, message, errors } supaya lapisan UI cukup
 * menampilkan `message` (pesan Bahasa Indonesia dari backend/Joi).
 */
const API_BASE = "/api/v1";
const AUTH_KEYS = { access: "fitai_access_token", refresh: "fitai_refresh_token" };

class ApiError extends Error {
  constructor(message, status, errors, payload) {
    super(message);
    this.status = status;
    this.errors = errors || null;
    // payload = body respons upstream utuh. Dipakai halaman AI Coach untuk
    // menampilkan fallback dari DB saat service menjawab 502/504.
    this.payload = payload || null;
  }
}

async function request(path, { method = "GET", body, query, allowRefresh = true } = {}) {
  const url = new URL(API_BASE + path, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });
  }

  let res;
  try {
    const accessToken = localStorage.getItem(AUTH_KEYS.access);
    res = await fetch(url, {
      method,
      credentials: "include",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError("Server tidak dapat dihubungi. Jalankan `npm run dev`.", 0);
  }

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    /* response bukan JSON */
  }

  if (!res.ok) {
    if (res.status === 401 && allowRefresh) {
      try {
        await refreshAccessToken();
        return request(path, { method, body, query, allowRefresh: false });
      } catch (refreshError) {
        clearSession();
        window.dispatchEvent(new CustomEvent("fitai:session-expired", {
          detail: { message: refreshError.message || "Sesi telah berakhir" },
        }));
        throw new ApiError("Sesi telah berakhir. Silakan masuk kembali.", 401);
      }
    }

    const message =
      (json && (json.message || json.error)) ||
      `Request gagal dengan status ${res.status}`;
    throw new ApiError(message, res.status, json && json.errors, json);
  }
  return json;
}

let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const res = await fetch(`${API_BASE}/users/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.data?.access_token) {
      throw new ApiError(json?.message || "Refresh token tidak valid", res.status || 401);
    }

    localStorage.setItem(AUTH_KEYS.access, json.data.access_token);
    return json.data.access_token;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

function clearSession() {
  localStorage.removeItem(AUTH_KEYS.access);
  localStorage.removeItem(AUTH_KEYS.refresh);
  localStorage.removeItem("fitai_user_id");
}

const api = {
  /* ------------------------------- USER ---------------------------- */
  listUsers: (query) => request("/users", { query }),
  getUser: (id) => request(`/users/${id}`),
  register: (body) => request("/users", { method: "POST", body }),
  login: async (body) => {
    const result = await request("/users/login", { method: "POST", body, allowRefresh: false });
    if (result.data?.access_token) localStorage.setItem(AUTH_KEYS.access, result.data.access_token);
    return result;
  },
  refresh: () => request("/users/refresh", { method: "POST", allowRefresh: false }),
  logout: () => request("/users/logout", { method: "POST", allowRefresh: false }),
  updateUser: (id, body) => request(`/users/${id}`, { method: "PUT", body }),
  listUserLogs: (id, query) => request(`/users/${id}/workout-logs`, { query }),

  /* ----------------------------- EXERCISE -------------------------- */
  listExercises: (query) => request("/exercises", { query: { limit: 100, ...query } }),
  createExercise: (body) => request("/exercises", { method: "POST", body }),

  /* --------------------------- WORKOUT LOG ------------------------- */
  createLog: (body) => request("/workout-logs", { method: "POST", body }),
  getLog: (id) => request(`/workout-logs/${id}`),
  getStatistik: (userId, range) =>
    request("/workout-logs/statistik", { query: { user_id: userId, ...range } }),

  /* -------------------------- RECOMMENDATION ----------------------- */
  generate: (body) => request("/recommendations/generate", { body, method: "POST" }),

  /* ------------------------------ ADMIN ---------------------------- */
  adminDashboard: () => request("/admin/dashboard"),
  adminListUsers: (query) => request("/admin/users", { query }),
  adminUpdateUser: (id, body) => request(`/admin/users/${id}`, { method: "PATCH", body }),
  adminDeleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),
  adminRestoreUser: (id) => request(`/admin/users/${id}/restore`, { method: "POST" }),
  adminListUserSessions: (id) => request(`/admin/users/${id}/sessions`),
  adminLogoutAllUserSessions: (id) => request(`/admin/users/${id}/sessions`, { method: "POST" }),
  adminListUserPayments: (id) => request(`/admin/users/${id}/payments`),
  adminListUserWorkoutLogs: (id) => request(`/admin/users/${id}/workout-logs`),
  adminListEquipments: () => request("/admin/equipments"),
  adminCreateEquipment: (body) => request("/admin/equipments", { method: "POST", body }),
  adminUpdateEquipment: (id, body) => request(`/admin/equipments/${id}`, { method: "PATCH", body }),
  adminDeleteEquipment: (id) => request(`/admin/equipments/${id}`, { method: "DELETE" }),
  adminListExercises: (query) => request("/admin/exercises", { query }),
  adminCreateExercise: (body) => request("/admin/exercises", { method: "POST", body }),
  adminUpdateExercise: (id, body) => request(`/admin/exercises/${id}`, { method: "PATCH", body }),
  adminDeleteExercise: (id) => request(`/admin/exercises/${id}`, { method: "DELETE" }),
  adminListPricing: () => request("/admin/pricing-plans"),
  adminCreatePricing: (body) => request("/admin/pricing-plans", { method: "POST", body }),
  adminUpdatePricing: (id, body) => request(`/admin/pricing-plans/${id}`, { method: "PATCH", body }),
  adminDeletePricing: (id) => request(`/admin/pricing-plans/${id}`, { method: "DELETE" }),
  adminListExerciseMedia: (exerciseId) => request(`/admin/exercises/${exerciseId}/media`),
  adminDeleteExerciseMedia: (exerciseId, mediaId) =>
    request(`/admin/exercises/${exerciseId}/media/${mediaId}`, { method: "DELETE" }),
  adminUploadExerciseMedia: async (exerciseId, file, options = {}) => {
    const form = new FormData();
    form.append("file", file);
    form.append("source", options.source || "upload");
    form.append("prompt", options.prompt || "");
    form.append("is_primary", options.is_primary ? "true" : "false");
    form.append("credit", options.credit || "");
    const accessToken = localStorage.getItem(AUTH_KEYS.access);
    const res = await fetch(`${API_BASE}/admin/exercises/${exerciseId}/media`, {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
    const json = await res.json();
    if (res.status === 401) {
      try {
        await refreshAccessToken();
        const retryToken = localStorage.getItem(AUTH_KEYS.access);
        const retryRes = await fetch(`${API_BASE}/admin/exercises/${exerciseId}/media`, {
          method: "POST",
          headers: retryToken ? { Authorization: `Bearer ${retryToken}` } : {},
          body: form,
        });
        const retryJson = await retryRes.json().catch(() => null);
        if (!retryRes.ok) throw new ApiError(retryJson?.message || "Upload media gagal", retryRes.status, retryJson?.errors, retryJson);
        return retryJson;
      } catch (refreshError) {
        if (refreshError instanceof ApiError) throw refreshError;
        clearSession();
        window.dispatchEvent(new CustomEvent("fitai:session-expired", {
          detail: { message: refreshError.message || "Sesi telah berakhir" },
        }));
        throw new ApiError("Sesi telah berakhir. Silakan masuk kembali.", 401);
      }
    }
    if (!res.ok) throw new ApiError(json.message || "Upload media gagal", res.status, json.errors, json);
    return json;
  },
};
