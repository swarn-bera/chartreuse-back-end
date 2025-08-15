import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../utils/jwt.js";

export const verifyJWT = asyncHandler(
  async (req, _res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Unauthorized: Token missing");
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = verifyToken(token);

      req.user = {
        id: decoded.id || decoded.userId, // support both id and userId
        email: decoded.email,
      };

      next();
    } catch (error) {
      throw new ApiError(401, "Invalid or expired token");
    }
  }
);
