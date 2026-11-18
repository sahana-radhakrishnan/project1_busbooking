const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const adminController = require("../controllers/adminController");

// Every route below requires an authenticated ADMIN
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
            status: "error",
            message: "Administrator access required."
        });
    }
    next();
};

router.use(verifyToken, requireAdmin);

router.get("/buses", adminController.getBuses);
router.post("/buses", adminController.addBus);
router.patch("/buses/:id/status", adminController.updateBusStatus);

router.get("/routes", adminController.getRoutes);
router.post("/routes", adminController.addRoute);

router.get("/schedules", adminController.getSchedules);
router.post("/schedules", adminController.addSchedule);
router.patch("/schedules/:id/status", adminController.updateScheduleStatus);

module.exports = router;