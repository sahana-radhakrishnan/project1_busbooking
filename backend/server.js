const express = require("express");
const path = require("path");
const db = require("./db");

const authRoutes = require("./routes/authRoutes");
const busRoutes = require("./routes/busRoutes");
const seatRoutes = require("./routes/seatRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const adminRoutes = require("./routes/adminRoutes");

const verifyToken = require("./middleware/authMiddleware");

const app = express();
const PORT = 3000;

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/seats", seatRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (req, res) => {
    db.query("SELECT DATABASE() AS database_name", (err, results) => {
        if (err) {
            return res.status(500).json({
                status: "error",
                message: "Database connection failed"
            });
        }

        res.json({
            status: "success",
            server: "TRANSITIQ",
            database: results[0].database_name,
            message: "Database is connected successfully!"
        });
    });
});

app.get("/api/auth/profile", verifyToken, (req, res) => {
    res.json({
        status: "success",
        message: "Authenticated successfully!",
        user: {
            user_id: req.user.user_id,
            role: req.user.role
        }
    });
});

app.use(express.static(path.join(__dirname, "../frontend")));

app.listen(PORT, () => {
    console.log(`TRANSITIQ running at http://localhost:${PORT}`);
});