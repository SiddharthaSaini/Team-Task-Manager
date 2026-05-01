const express = require("express");
const { body, param } = require("express-validator");
const mongoose = require("mongoose");
const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

router.use(auth);

router.post(
  "/",
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("projectId").custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage("Valid projectId is required"),
    body("assignedTo")
      .isArray({ min: 1 })
      .withMessage("assignedTo must be a non-empty array of member IDs"),
    body("assignedTo.*").custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage("Each assignedTo ID must be valid"),
    body("dueDate").isISO8601().withMessage("Valid dueDate is required"),
    body("status").optional().isIn(["todo", "in-progress", "done"]).withMessage("Invalid status"),
  ],
  validate,
  async (req, res) => {
    const { title, description = "", projectId, assignedTo, dueDate, status = "todo" } = req.body;
    const uniqueAssigneeIds = [...new Set(assignedTo)];

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const isProjectMember = project.members.some((memberId) => memberId.toString() === req.user.id);
    if (!isProjectMember && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const assignees = await User.find({ _id: { $in: uniqueAssigneeIds } }).select("_id role");
    if (assignees.length !== uniqueAssigneeIds.length) {
      return res.status(404).json({ message: "One or more assignees not found" });
    }
    if (assignees.some((assignee) => assignee.role !== "member")) {
      return res.status(400).json({ message: "Only members can be assigned tasks" });
    }

    const projectMemberIds = new Set(project.members.map((memberId) => memberId.toString()));
    const hasNonProjectAssignee = uniqueAssigneeIds.some((assigneeId) => !projectMemberIds.has(assigneeId));
    if (hasNonProjectAssignee) {
      return res.status(400).json({ message: "Every assignee must be a member of the selected project" });
    }

    const tasksPayload = uniqueAssigneeIds.map((assigneeId) => ({
      title,
      description,
      project: projectId,
      assignedTo: assigneeId,
      createdBy: req.user.id,
      dueDate,
      status,
    }));
    const createdTasks = await Task.insertMany(tasksPayload);
    const created = await Task.find({ _id: { $in: createdTasks.map((task) => task._id) } }).populate("assignedTo", "name email role");
    return res.status(201).json(created);
  }
);

router.patch(
  "/:taskId/status",
  [
    param("taskId").custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage("Invalid task ID"),
    body("status").isIn(["todo", "in-progress", "done"]).withMessage("Invalid status"),
  ],
  validate,
  async (req, res) => {
    const task = await Task.findById(req.params.taskId).populate("project");
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const canUpdate =
      req.user.role === "admin" ||
      task.assignedTo.toString() === req.user.id ||
      task.createdBy.toString() === req.user.id ||
      task.project.members.some((memberId) => memberId.toString() === req.user.id);

    if (!canUpdate) {
      return res.status(403).json({ message: "Forbidden" });
    }

    task.status = req.body.status;
    await task.save();
    return res.json(task);
  }
);

module.exports = router;
