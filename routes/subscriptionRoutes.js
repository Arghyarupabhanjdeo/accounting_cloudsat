import express from "express";
import { createSubscriptionOrder, getMySubscriptionPlans, getSubscriptionPlan, verifySubscriptionPayment, checkSubscriptionStatus } from "../controllers/subscriptionController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/order", createSubscriptionOrder);
router.post("/verify", verifySubscriptionPayment);
router.get("/my-plan", getMySubscriptionPlans);
router.get("/plans", getSubscriptionPlan);
router.get("/status", checkSubscriptionStatus);
export default router;