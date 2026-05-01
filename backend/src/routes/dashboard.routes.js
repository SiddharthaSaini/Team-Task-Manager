const express = require("express");
const auth = require("../middleware/auth");
const Task = require("../models/Task");

const router = express.Router();

router.get("/stats", auth, async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { assignedTo: req.user.id };
  const tasks = await Task.find(filter);

  const now = new Date();
  const stats = {
    total: tasks.length,
    todo: tasks.filter((task) => task.status === "todo").length,
    inProgress: tasks.filter((task) => task.status === "in-progress").length,
    done: tasks.filter((task) => task.status === "done").length,
    overdue: tasks.filter((task) => task.status !== "done" && new Date(task.dueDate) < now).length,
  };

  return res.json(stats);
});

module.exports = router;
