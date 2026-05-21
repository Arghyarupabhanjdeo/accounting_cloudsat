import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
  try {
    let token;

    // Check for token in cookie first (new cookie-based auth)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // Fall back to Authorization header (for backward compatibility)
    else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Access denied.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to request object
    req.user = decoded;
    req.user.id = decoded.id ?? decoded.user_id ?? decoded.userId ?? null;
    req.user.employee_id = decoded.employee_id ?? decoded.employeeId ?? decoded.employeeID ?? null;

    next(); // Continue to controller
  } catch (error) {
    console.error("AUTH ERROR:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};
