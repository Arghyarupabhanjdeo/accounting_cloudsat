import pool from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const createUser = async (req, res) => {
  const { name, email, password } = req.body;
  console.log(req.body);


  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email, password, are required.",
    });
  }

  try {
    // 1️⃣ Check if user already exists
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already registered.",
      });
    }

    // 2️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3️⃣ Insert new user
    const [result] = await pool.query(
      `INSERT INTO users (name ,email, password) 
       VALUES (?,?, ?)`,
      [name, email, hashedPassword]
    );

    // 4️⃣ Return success response
    res.status(201).json({
      success: true,
      message: "User created successfully.",
      userId: result.insertId,
    });

  } catch (error) {
    console.error("CREATE USER ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email, password,  are required.",
    });
  }

  try {
    // 1️⃣ Check user by email
    const [rows] = await pool.query(
      `SELECT * FROM users WHERE email = ? `,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invalid email or subdomain.",
      });
    }

    const user = rows[0];

    // 2️⃣ Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid password.",
      });
    }

    // 3️⃣ Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || "user", employee_id: user.employee_id || null },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 4️⃣ Set token in HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // 5️⃣ Response
    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        subdomain: user.subdomain,
        employee_id: user.employee_id || null,
      },
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("LOGOUT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error during logout",
      error: error.message,
    });
  }
};

export const AllUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM  users`)
    res.json({
      message: "users fetched SuccessFully",
      users: rows
    })
  } catch (error) {
    console.log(error);
  }
}

// Get authenticated user from JWT token in cookie
export const getAuthenticatedUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT id, name, email, subdomain, role, employee_id FROM users WHERE id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = rows[0];

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subdomain: user.subdomain,
        role: user.role || "user",
        employee_id: user.employee_id || null,
      },
    });
  } catch (error) {
    console.error("GET AUTH USER ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ✅ Sync user from SuperAdmin (Cloudsat) into accounting DB
// Upserts user, auto-creates company if none exists, returns accounting JWT
export const syncUser = async (req, res) => {
  try {
    const { name, email, subdomain, role, employee_id, company_id } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required for sync." });
    }

    // 0️⃣ Ensure subdomain + role columns exist (safe, idempotent)
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subdomain VARCHAR(255) DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'`).catch(() => {});
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id INT DEFAULT NULL`).catch(() => {});

    // 1️⃣ Upsert user by email
    const [existing] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);

    let accountingUser;

    if (existing.length > 0) {
      // Update name/subdomain/role
      await pool.query(
        "UPDATE users SET name = ?, subdomain = ?, role = ?, employee_id = ? WHERE email = ?",
        [
          name || existing[0].name,
          subdomain || existing[0].subdomain,
          role || existing[0].role || "superadmin",
          employee_id ?? existing[0].employee_id ?? null,
          email
        ]
      );
      const [updated] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
      accountingUser = updated[0];
    } else {
      // Insert new user (no password — auth is via Cloudsat)
      const [result] = await pool.query(
        "INSERT INTO users (name, email, subdomain, role, employee_id, password) VALUES (?, ?, ?, ?, ?, ?)",
        [name, email, subdomain, role || "superadmin", employee_id ?? null, ""]
      );
      const [newUser] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
      accountingUser = newUser[0];
    }

    // 2️⃣ Check if this user already has a company
    let company = null;
    if (company_id) {
      const [selectedCompany] = await pool.query(
        "SELECT * FROM companies WHERE id = ? LIMIT 1",
        [company_id]
      );
      company = selectedCompany[0] || null;
    }

    if (!company) {
      const [existingCompanies] = await pool.query(
        "SELECT * FROM companies WHERE userId = ? ORDER BY id ASC LIMIT 1",
        [accountingUser.id]
      );
      company = existingCompanies[0] || null;
    }

    if (!company) {
      // 3️⃣ Auto-create a default company using subdomain/name
      const companyName = name || subdomain || email.split("@")[0];
      const [insertResult] = await pool.query(
        `INSERT INTO companies (name, email, userId, gstRegistered, gstin) VALUES (?, ?, ?, ?, ?)`,
       [companyName, email, accountingUser.id, "No", null]
      );
      const [newCompany] = await pool.query("SELECT * FROM companies WHERE id = ?", [insertResult.insertId]);
      company = newCompany[0];
      console.log(`✅ Auto-created company "${companyName}" for user ${email}`);
    }

    // 4️⃣ Issue accounting-signed JWT
    const accountingToken = jwt.sign(
      {
        id: accountingUser.id,
        email: accountingUser.email,
        role: accountingUser.role || "superadmin",
        employee_id: accountingUser.employee_id || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 5️⃣ Set cookie
    res.cookie("token", accountingToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "User synced successfully",
      token: accountingToken,
      user: {
        id: accountingUser.id,
        name: accountingUser.name,
        email: accountingUser.email,
        subdomain: accountingUser.subdomain,
        role: accountingUser.role || "superadmin",
        employee_id: accountingUser.employee_id || null,
      },
      company: {
        id: company.id,
        name: company.name,
        email: company.email,
      },
    });

  } catch (error) {
    console.error("SYNC USER ERROR:", error);
    res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};
