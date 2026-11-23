const { User } = require("../models");
const { verifyAccessToken, verifyRefreshToken, signAccessToken } = require("../utils/authTokens");

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

const refreshAccessToken = async (req, res) => {
  try {
    const payload = verifyRefreshToken(req.validated.refresh_token);
    if (payload.type !== "refresh") {
      throw new Error("Token bukan refresh token");
    }
    const user = await User.findByPk(payload.sub);
    if (!user) {
      return res.status(401).json({ status: "fail", message: "Sesi tidak valid" });
    }
    return res.status(200).json({
      status: "success",
      data: { access_token: signAccessToken(user) },
    });
  } catch (err) {
    return res.status(401).json({ status: "fail", message: "Refresh token tidak valid atau sudah kedaluwarsa" });
  }
};

module.exports = { requireAuth, requireAdmin, refreshAccessToken };
