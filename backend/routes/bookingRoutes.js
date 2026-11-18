
const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");

const { createBooking } = require("../controllers/bookingController");
const { cancelBooking } = require("../controllers/cancellationController");

// Create booking
router.post("/", verifyToken, createBooking);

// Cancel selected seats
router.post("/:booking_id/cancel", verifyToken, cancelBooking);

module.exports = router;
