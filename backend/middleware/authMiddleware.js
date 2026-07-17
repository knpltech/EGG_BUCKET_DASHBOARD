import jwt from "jsonwebtoken";

export const requireAuthentication = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, globalThis.process?.env?.JWT_SECRET);

    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const verifyAdmin = (req, res, next) => requireAuthentication(req, res, () => {
  const userRole = String(req.user?.role || "").toLowerCase();
  if (userRole !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }
  return next();
});
