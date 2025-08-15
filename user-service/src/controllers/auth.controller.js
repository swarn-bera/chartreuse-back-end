import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import { hashPassword, comparePasswords } from '../utils/hash.js';
import { generateToken } from '../utils/jwt.js';
import axios from 'axios';

const prisma = new PrismaClient();

export const signupUser = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "User already exists");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  const token = generateToken(user.id);

  return res
    .status(201)
    .json(new ApiResponse(201, { token, user: { id: user.id, email: user.email } }, "Signup successful"));
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isValid = await comparePasswords(password, user.passwordHash);
  if (!isValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = generateToken(user.id);

  return res
    .status(200)
    .json(new ApiResponse(200, { token, user: { id: user.id, email: user.email } }, "Login successful"));
});

export const getMyProfile = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true }
  });

  // Fetch goal plans from goal-plan-service via API
  let plans = [];
  try {
    const response = await axios.get(`http://goal-plan-service:3002/api/goal-plans?userId=${userId}`);
    plans = response.data.data || [];
  } catch (err) {
    // Optionally handle error or log
  }

  return res.status(200).json(new ApiResponse(200, { ...user, plans }, "User profile fetched"));
});