const express = require("express");
const { body, param } = require("express-validator");
const mongoose = require("mongoose");
const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const validate = require("../middleware/validate");

const router = express.Router();

router.use(auth);

const ensureMemberRoleUsers = async (memberIds) => {
  if (!memberIds.length) {
    return true;
  }

  const members = await User.find({ _id: { $in: memberIds } }).select("role");
  return members.length === memberIds.length && members.every((member) => member.role === "member");
};

router.get("/", async (req, res) => {
  const query = req.user.role === "admin" ? {} : { members: req.user.id };
  const projects = await Project.find(query).populate("members", "name email role");
  return res.json(projects);
});

router.post(
  "/",
  allowRoles("admin"),
  [
    body("name").trim().notEmpty().withMessage("Project name is required"),
    body("description").optional().trim(),
    body("memberIds").optional().isArray().withMessage("memberIds must be an array"),
  ],
  validate,
  async (req, res) => {
    const { name, description = "", memberIds = [] } = req.body;
    const uniqueMemberIds = [...new Set(memberIds)];

    const validMembers = await ensureMemberRoleUsers(uniqueMemberIds);
    if (!validMembers) {
      return res.status(400).json({ message: "One or more selected users are invalid or not members" });
    }

    const project = await Project.create({
      name,
      description,
      createdBy: req.user.id,
      members: [...uniqueMemberIds, req.user.id],
    });

    const created = await Project.findById(project._id).populate("members", "name email role");
    return res.status(201).json(created);
  }
);

router.put(
  "/:projectId/members",
  allowRoles("admin"),
  [
    param("projectId").custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage("Invalid project ID"),
    body("memberIds").isArray({ min: 1 }).withMessage("memberIds is required"),
  ],
  validate,
  async (req, res) => {
    const { projectId } = req.params;
    const { memberIds } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const uniqueMemberIds = [...new Set(memberIds)];
    const validMembers = await ensureMemberRoleUsers(uniqueMemberIds);
    if (!validMembers) {
      return res.status(400).json({ message: "One or more selected users are invalid or not members" });
    }

    project.members = [...uniqueMemberIds, project.createdBy.toString()];
    await project.save();

    const updated = await Project.findById(projectId).populate("members", "name email role");
    return res.json(updated);
  }
);

router.get("/:projectId/tasks", [param("projectId").custom((value) => mongoose.Types.ObjectId.isValid(value))], validate, async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  const isMember = project.members.some((memberId) => memberId.toString() === req.user.id);
  if (!isMember && req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const tasks = await Task.find({ project: projectId })
    .populate("assignedTo", "name email role")
    .populate("createdBy", "name email role")
    .sort({ dueDate: 1 });

  return res.json(tasks);
});

module.exports = router;
