
const express = require("express");
const router = express.Router();

const {
    registerPassenger,
    loginPassenger,
    forgotPassword,
    resetPassword
} = require("../controllers/authController");

router.post("/register", registerPassenger);
router.post("/login", loginPassenger);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;
