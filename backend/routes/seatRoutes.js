const express = require("express");
const router = express.Router();

const {
    getSeatAvailability
} = require("../controllers/seatController");

router.get("/:schedule_id", getSeatAvailability);

module.exports = router;