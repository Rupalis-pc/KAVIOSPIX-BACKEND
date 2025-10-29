const express = require("express");
const router = express.Router();
const User = require("../models/user.model");
const verifyJWT = require("../utils/verifyJWT");

// GET /users - return all users (protected)
router.get("/", verifyJWT, async (req, res) => {
  try {
    const users = await User.find().select("userId email name picture");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

module.exports = router;
