const express = require("express");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const User = require("../models/User");

const router = express.Router();

router.get("/", auth, allowRoles("admin"), async (_req, res) => {
  const users = await User.find().select("name email role");
  return res.json(
    users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    }))
  );
});

module.exports = router;
