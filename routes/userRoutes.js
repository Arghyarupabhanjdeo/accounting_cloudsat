import express from "express";
import { AllUsers, createUser, login, logout, getAuthenticatedUser, syncUser } from "../controllers/userController.js";
import { authMiddleware } from "../middlewares/authmiddleWare.js";


const router = express.Router();

router.post("/register", createUser);
router.post("/login", login);
router.get("/allUser", AllUsers);
router.post("/logout", logout);
router.get("/me", authMiddleware, getAuthenticatedUser); // Protected route to get current user
router.post("/sync", syncUser); // Sync SuperAdmin user → upsert user + auto-create company + return accounting JWT

export default router;


// register -  http://localhost:3000/api/v1/auth/register
// login - http://localhost:3000/api/v1/auth/login
// me - http://localhost:3000/api/v1/auth/me
// sync - http://localhost:3000/api/v1/auth/sync
