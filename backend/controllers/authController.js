
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const pool = db.promise();

// ------------------------------------
// PASSENGER REGISTRATION
// ------------------------------------
const registerPassenger = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                status: "error",
                message: "Name, email and password are required."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                status: "error",
                message: "Password must contain at least 8 characters."
            });
        }

        const [existing] = await pool.query(
            "SELECT user_id FROM users WHERE email = ?",
            [email]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                status: "error",
                message: "Email is already registered."
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            `INSERT INTO users (name, email, phone, password_hash, role)
             VALUES (?, ?, ?, ?, 'PASSENGER')`,
            [name, email, phone || null, passwordHash]
        );

        return res.status(201).json({
            status: "success",
            message: "Registration successful!",
            user: {
                user_id: result.insertId,
                name,
                email,
                role: "PASSENGER"
            }
        });

    } catch (error) {
        console.error("Registration error:", error);

        return res.status(500).json({
            status: "error",
            message: "Registration failed."
        });
    }
};

// ------------------------------------
// PASSENGER / ADMIN LOGIN
// ------------------------------------
const loginPassenger = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: "error",
                message: "Email and password are required."
            });
        }

        const [users] = await pool.query(
            `SELECT user_id, name, email, phone, password_hash, role
             FROM users
             WHERE email = ?`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                status: "error",
                message: "Invalid email or password."
            });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                status: "error",
                message: "Invalid email or password."
            });
        }

        const token = jwt.sign(
            {
                user_id: user.user_id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.json({
            status: "success",
            message: "Login successful!",
            token,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            status: "error",
            message: "Login failed."
        });
    }
};

// ------------------------------------
// FORGOT PASSWORD - GENERATE OTP
// ------------------------------------
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: "error",
                message: "Email is required."
            });
        }

        const [users] = await pool.query(
            "SELECT user_id FROM users WHERE email = ?",
            [email]
        );

        // Generic response prevents revealing whether an email exists.
        const responseMessage =
            "If the email is registered, an OTP has been generated. Check the backend terminal for this local demo.";

        if (users.length === 0) {
            return res.json({
                status: "success",
                message: responseMessage
            });
        }

        const userId = users[0].user_id;
        const otp = crypto.randomInt(100000, 1000000).toString();
        const otpHash = await bcrypt.hash(otp, 10);

        await pool.query(
            `UPDATE password_reset_otps
             SET used_at = NOW()
             WHERE user_id = ? AND used_at IS NULL`,
            [userId]
        );

        await pool.query(
            `INSERT INTO password_reset_otps
             (user_id, otp_hash, expires_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
            [userId, otpHash]
        );

        // Local college-project demonstration only.
        console.log("----------------------------------");
        console.log("TRANSITIQ PASSWORD RESET OTP");
        console.log("Email:", email);
        console.log("OTP:", otp);
        console.log("Valid for: 10 minutes");
        console.log("----------------------------------");

        return res.json({
            status: "success",
            message: responseMessage
        });

    } catch (error) {
        console.error("Forgot password error:", error);

        return res.status(500).json({
            status: "error",
            message: "Unable to generate OTP. Please check the database table."
        });
    }
};

// ------------------------------------
// RESET PASSWORD - VERIFY OTP
// ------------------------------------
const resetPassword = async (req, res) => {
    let connection;

    try {
        const { email, otp, new_password } = req.body;

        if (!email || !otp || !new_password) {
            return res.status(400).json({
                status: "error",
                message: "Email, OTP and new password are required."
            });
        }

        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                status: "error",
                message: "Enter a valid 6-digit OTP."
            });
        }

        if (new_password.length < 8) {
            return res.status(400).json({
                status: "error",
                message: "New password must contain at least 8 characters."
            });
        }

        const [users] = await pool.query(
            "SELECT user_id FROM users WHERE email = ?",
            [email]
        );

        if (users.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid email or OTP."
            });
        }

        const userId = users[0].user_id;

        const [otpRows] = await pool.query(
            `SELECT reset_id, otp_hash
             FROM password_reset_otps
             WHERE user_id = ?
               AND used_at IS NULL
               AND expires_at > NOW()
             ORDER BY reset_id DESC
             LIMIT 1`,
            [userId]
        );

        if (otpRows.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "OTP is invalid or expired. Generate a new OTP."
            });
        }

        const otpMatch = await bcrypt.compare(
            otp,
            otpRows[0].otp_hash
        );

        if (!otpMatch) {
            return res.status(400).json({
                status: "error",
                message: "Incorrect OTP."
            });
        }

        const passwordHash = await bcrypt.hash(new_password, 10);

        connection = await pool.getConnection();
        await connection.beginTransaction();

        await connection.query(
            "UPDATE users SET password_hash = ? WHERE user_id = ?",
            [passwordHash, userId]
        );

        await connection.query(
            "UPDATE password_reset_otps SET used_at = NOW() WHERE reset_id = ?",
            [otpRows[0].reset_id]
        );

        await connection.commit();

        return res.json({
            status: "success",
            message: "Password reset successfully! You can now log in."
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Reset password error:", error);

        return res.status(500).json({
            status: "error",
            message: "Password reset failed."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// ------------------------------------
// EXPORT ALL FOUR FUNCTIONS
// ------------------------------------
module.exports = {
    registerPassenger,
    loginPassenger,
    forgotPassword,
    resetPassword
};
