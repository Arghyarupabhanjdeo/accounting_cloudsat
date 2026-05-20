import { razorpay } from "../utils/razorpay.js";
import pool from "../db.js";
import crypto from "crypto";

// CREATE TABLE subscriptions (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   user_id INT NOT NULL,
//   plan_id INT NOT NULL,
//   plan_type ENUM('monthly', 'yearly') NOT NULL,
//   razorpay_payment_id VARCHAR(100),
//   duration_days INT NOT NULL,
//   start_date DATETIME NOT NULL,
//   end_date DATETIME NOT NULL,
//   status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

//   INDEX idx_user_plan (user_id, plan_type, status),
//   INDEX idx_end_date (end_date),

//   FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
// );

// CREATE TABLE subscription_plans (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   name VARCHAR(100) NOT NULL,
//   type ENUM('monthly', 'yearly') NOT NULL,
//   price INT NOT NULL COMMENT 'Price in INR',
//   status ENUM('active', 'inactive') DEFAULT 'active',
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );
// INSERT INTO subscription_plans (name, type, price) VALUES
// ('Basic Monthly', 'monthly', 199),
// ('Pro Monthly', 'monthly', 399),
// ('Basic Yearly', 'yearly', 1999),
// ('Pro Yearly', 'yearly', 3999);


export const getSubscriptionPlan = async (req, res) => {
  try {
    const [plans] = await pool.query(
      `SELECT * FROM subscription_plans WHERE status='active'`
    );

    res.status(200).json({
      success: true,
      plans
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch plans" });
  }
};

export const createSubscriptionOrder = async (req, res) => {
  try {
    const { plan_id } = req.body;
    const user_id = req.body.user_id;

    const [[plan]] = await pool.query(
      `SELECT * FROM subscription_plans WHERE id=? AND status='active'`,
      [plan_id]
    );

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    const durationDays = plan.type === "monthly" ? 30 : 365;

    /* 🔹 Check active subscription of SAME TYPE */
    const [[activeSub]] = await pool.query(
      `
      SELECT id FROM subscriptions
      WHERE user_id=? AND plan_type=? AND status='active'
      AND end_date >= NOW()
      LIMIT 1
      `,
      [user_id, plan.type]
    );

    if (activeSub) {
      return res.status(400).json({
        message: `You already have an active ${plan.type} subscription`
      });
    }

    // 🔹 Check if this is a renewal for yearly subscription
    let finalPrice = plan.price;
    let isRenewal = false;

    if (plan.type === "yearly") {
      // Check if user has any previous yearly subscription (active or expired)
      const [[previousYearlySub]] = await pool.query(
        `
        SELECT id FROM subscriptions
        WHERE user_id=? AND plan_type='yearly'
        LIMIT 1
        `,
        [user_id]
      );

      if (previousYearlySub) {
        // This is a renewal - apply renewal price
        finalPrice = 2999;
        isRenewal = true;
        console.log(`✓ Renewal detected for user ${user_id} - Applying renewal price: ₹${finalPrice}`);
      }
    }

    // 🔹 Calculate GST (18%)
    const GST_RATE = 0.18;
    const gstAmount = Math.round(finalPrice * GST_RATE);
    const totalAmount = finalPrice + gstAmount;

    console.log(`💰 Price Breakdown: Base: ₹${finalPrice}, GST (18%): ₹${gstAmount}, Total: ₹${totalAmount}`);

    const order = await razorpay.orders.create({
      amount: totalAmount * 100,
      currency: "INR",
      receipt: `sub_${user_id}_${Date.now()}`
    });

    res.json({
      success: true,
      order,
      plan_type: plan.type,
      duration_days: durationDays,
      amount: finalPrice,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      original_price: plan.price,
      is_renewal: isRenewal,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create order" });
  }
};

export const verifySubscriptionPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_id
    } = req.body;

    const userId = req.body.user_id || req.params.userId || req.query.userId || req.user?.userId;

    console.log("=== Payment Verification ===");
    console.log("User ID:", userId);
    console.log("Plan ID:", plan_id);
    console.log("Payment ID:", razorpay_payment_id);

    if (!userId) {
      console.log("ERROR: No userId provided");
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const sign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    console.log("Generated signature:", sign);
    console.log("Received signature:", razorpay_signature);

    if (sign !== razorpay_signature) {
      console.log("ERROR: Signature mismatch");
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const [[plan]] = await pool.query(
      `SELECT * FROM subscription_plans WHERE id=?`,
      [plan_id]
    );

    if (!plan) {
      console.log("ERROR: Plan not found");
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    const durationDays = plan.type === "monthly" ? 30 : 365;
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + durationDays * 24 * 60 * 60 * 1000
    );

    console.log("Inserting subscription:", {
      userId,
      plan_id,
      plan_type: plan.type,
      start_date: startDate,
      end_date: endDate
    });

    const [result] = await pool.query(
      `
      INSERT INTO subscriptions
      (user_id, plan_id, plan_type, razorpay_payment_id, duration_days, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `,
      [
        userId,
        plan_id,
        plan.type,
        razorpay_payment_id,
        durationDays,
        startDate,
        endDate
      ]
    );

    console.log("Subscription created successfully, ID:", result.insertId);

    res.json({
      success: true,
      message: `${plan.type} subscription activated successfully`
    });

  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ success: false, message: "Payment verification failed: " + error.message });
  }
};

export const getMySubscriptionPlans = async (req, res) => {
  try {
    const userId = req.query.userId || req.params.userId || req.body.user_id || req.user?.userId;

    const [subscriptions] = await pool.query(
      `
      SELECT 
        s.id,
        sp.name AS plan_name,
        s.plan_type,
        s.start_date,
        s.end_date,
        s.status
      FROM subscriptions s
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE s.user_id=?
      ORDER BY s.start_date DESC
      `,
      [userId]
    );

    res.json({
      success: true,
      subscriptions
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch subscriptions" });
  }
};

export const checkSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.query.userId || req.params.userId || req.body.user_id || req.user?.userId;
    console.log("Checking subscription for userId:", userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const [[activeSub]] = await pool.query(
      `SELECT id, plan_type, end_date FROM subscriptions
       WHERE user_id=? AND status='active' AND end_date >= NOW()
       LIMIT 1`,
      [userId]
    );

    res.json({
      success: true,
      hasActiveSubscription: !!activeSub,
      subscription: activeSub || null
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to check subscription status"
    });
  }
};
