const { Op } = require("sequelize");
const { User, RefreshSession } = require("../models");
const { verifyAccessToken, verifyRefreshToken, signAccessToken, signRefreshToken, hashRefreshToken } = require("../utils/authTokens");

const readBearerToken = (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
};

const requireAuth = async (req, res, next) => {
  const token = readBearerToken(req);
  if (!token) {
    return res.status(401).json({ status: "fail", message: "Autentikasi diperlukan" });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findByPk(payload.sub);
    if (!user) {
      return res.status(401).json({ status: "fail", message: "Sesi tidak valid" });
    }
    req.auth = {
      user,
      user_id: user.id,
      role: user.role,
      is_premium: Boolean(user.is_premium),
    };
    return next();
  } catch (err) {
    return res.status(401).json({ status: "fail", message: "Token akses tidak valid atau sudah kedaluwarsa" });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.auth || req.auth.role !== "admin") {
    return res.status(403).json({ status: "fail", message: "Akses khusus administrator" });
  }
  return next();
};

const REFRESH_COOKIE = "fitai_refresh_token";

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: String(process.env.NODE_ENV).toLowerCase() === "production",
  sameSite: "lax",
  path: "/api/v1/users",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const refreshAccessToken = async (req, res) => {
  try {
    const presentedToken = req.cookies?.[REFRESH_COOKIE] || req.validated?.refresh_token;
    if (!presentedToken) return res.status(401).json({ status: "fail", message: "Refresh token diperlukan" });

    const payload = verifyRefreshToken(presentedToken);
    if (payload.type !== "refresh") throw new Error("Token bukan refresh token");

    const tokenHash = hashRefreshToken(presentedToken);
    const session = await RefreshSession.findOne({ where: { token_hash: tokenHash } });

    if (!session || session.user_id !== payload.sub || session.revoked_at || new Date(session.expires_at) <= new Date()) {
      if (session?.family_id) {
        await RefreshSession.update(
          { revoked_at: new Date(), revoked_reason: "refresh_token_reuse" },
          { where: { family_id: session.family_id, revoked_at: null } }
        );
      }
      res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/users" });
      return res.status(401).json({ status: "fail", message: "Refresh token tidak valid atau sudah dicabut" });
    }

    const user = await User.findByPk(payload.sub);
    if (!user) return res.status(401).json({ status: "fail", message: "Sesi tidak valid" });

    await session.update({ revoked_at: new Date(), revoked_reason: "rotated" });

    const nextRefreshToken = signRefreshToken(user, session.family_id);
    const nextPayload = verifyRefreshToken(nextRefreshToken);
    const expiresAt = new Date(nextPayload.exp * 1000);
    await RefreshSession.create({
      user_id: user.id,
      token_hash: hashRefreshToken(nextRefreshToken),
      family_id: session.family_id,
      expires_at: expiresAt,
      ip_address: req.ip,
      user_agent: String(req.get("user-agent") || "").slice(0, 500),
    });

    res.cookie(REFRESH_COOKIE, nextRefreshToken, refreshCookieOptions());
    return res.status(200).json({
      status: "success",
      data: { access_token: signAccessToken(user), refresh_token: nextRefreshToken },
    });
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/users" });
    return res.status(401).json({ status: "fail", message: "Refresh token tidak valid atau sudah kedaluwarsa" });
  }
};

const logoutCurrentSession = async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refresh_token;
  if (token) {
    await RefreshSession.update(
      { revoked_at: new Date(), revoked_reason: "logout" },
      { where: { token_hash: hashRefreshToken(token), user_id: req.auth.user_id, revoked_at: null } }
    );
  }
  res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/users" });
  return res.status(200).json({ status: "success", message: "Logout berhasil" });
};

const logoutAllSessions = async (req, res) => {
  const targetUserId = Number(req.params.id);
  const [count] = await RefreshSession.update(
    { revoked_at: new Date(), revoked_reason: "admin_force_logout" },
    { where: { user_id: targetUserId, revoked_at: null } }
  );
  return res.status(200).json({ status: "success", message: `Semua sesi user dicabut (${count})` });
};

const listRefreshSessions = async (req, res) => {
  const sessions = await RefreshSession.findAll({
    where: { user_id: Number(req.params.id) },
    order: [["created_at", "DESC"]],
  });
  return res.status(200).json({ status: "success", data: sessions.map((session) => ({
    id: session.id,
    family_id: session.family_id,
    revoked_at: session.revoked_at,
    revoked_reason: session.revoked_reason,
    expires_at: session.expires_at,
    ip_address: session.ip_address,
    user_agent: session.user_agent,
    created_at: session.created_at,
  })) });
};

module.exports = { requireAuth, requireAdmin, refreshAccessToken, logoutCurrentSession, logoutAllSessions, listRefreshSessions };
