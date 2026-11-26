const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const getSecret = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} belum dikonfigurasi`);
  return value;
};

const signAccessToken = (user) =>
  jwt.sign(
    { sub: user.id, role: user.role, is_premium: Boolean(user.is_premium) },
    getSecret("JWT_ACCESS_SECRET"),
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m", issuer: "fitai" }
  );

const signRefreshToken = (user, familyId = createFamilyId()) =>
  jwt.sign(
    { sub: user.id, role: user.role, type: "refresh", jti: crypto.randomUUID(), family_id: familyId },
    getSecret("JWT_REFRESH_SECRET"),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d", issuer: "fitai" }
  );

const verifyAccessToken = (token) =>
  jwt.verify(token, getSecret("JWT_ACCESS_SECRET"), { issuer: "fitai" });

const verifyRefreshToken = (token) =>
  jwt.verify(token, getSecret("JWT_REFRESH_SECRET"), { issuer: "fitai" });

const hashRefreshToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const createFamilyId = () => crypto.randomBytes(32).toString("hex");

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashRefreshToken,
  createFamilyId,
};
