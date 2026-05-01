import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api, setAuthToken } from "./api";
import type { AuthResponse, DashboardStats, Project, Task, TaskStatus, User } from "./types";

const defaultStats: DashboardStats = { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0 };

const App = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "member",
  });
  const [projectForm, setProjectForm] = useState({ name: "", description: "", memberIds: [] as string[] });
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assignedTo: [] as string[],
    dueDate: "",
    status: "todo" as TaskStatus,
  });
  const [editableProjectMemberIds, setEditableProjectMemberIds] = useState<string[]>([]);

  const selectedProject = useMemo(
    () => projects.find((project) => project._id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const assignableMembers = useMemo(() => users.filter((teamUser) => teamUser.role === "member"), [users]);
  const taskAssignableMembers = useMemo(
    () => (selectedProject?.members || []).filter((member) => member.role === "member"),
    [selectedProject]
  );

  useEffect(() => {
    if (!selectedProject) {
      setEditableProjectMemberIds([]);
      return;
    }
    setEditableProjectMemberIds(
      selectedProject.members.filter((member) => member.role === "member").map((member) => member._id)
    );
  }, [selectedProject]);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  useEffect(() => {
    if (!token || !user) {
      return;
    }
    void loadInitialData();
  }, [token, user]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload =
        mode === "signup"
          ? authForm
          : {
              email: authForm.email,
              password: authForm.password,
            };

      const { data } = await api.post<AuthResponse>(`/auth/${mode}`, payload);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      const isNetworkIssue = !err?.response;
      setError(
        backendMessage ||
          (isNetworkIssue
            ? "Cannot reach backend API. Start backend and check MongoDB connection."
            : "Authentication failed")
      );
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setProjects([]);
    setTasks([]);
    setUsers([]);
    setStats(defaultStats);
    setSelectedProjectId("");
  };

  const loadInitialData = async () => {
    try {
      const [projectsRes, statsRes] = await Promise.all([api.get<Project[]>("/projects"), api.get<DashboardStats>("/dashboard/stats")]);
      setProjects(projectsRes.data);
      setStats(statsRes.data);
      if (projectsRes.data.length) {
        const projectId = selectedProjectId || projectsRes.data[0]._id;
        setSelectedProjectId(projectId);
        await loadProjectTasks(projectId);
      }

      if (user?.role === "admin") {
        const usersRes = await api.get<User[]>("/users");
        setUsers(usersRes.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load data");
    }
  };

  const loadProjectTasks = async (projectId: string) => {
    if (!projectId) {
      setTasks([]);
      return;
    }

    try {
      const { data } = await api.get<Task[]>(`/projects/${projectId}/tasks`);
      setTasks(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load tasks");
    }
  };

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    try {
      await api.post("/projects", projectForm);
      setProjectForm({ name: "", description: "", memberIds: [] });
      await loadInitialData();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create project");
    }
  };

  const createTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId) return;
    setError("");

    try {
      await api.post("/tasks", { ...taskForm, projectId: selectedProjectId });
      setTaskForm({ title: "", description: "", assignedTo: [], dueDate: "", status: "todo" });
      await Promise.all([loadProjectTasks(selectedProjectId), loadInitialData()]);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create task");
    }
  };

  const toggleTaskAssignee = (memberId: string) => {
    setTaskForm((prev) => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(memberId)
        ? prev.assignedTo.filter((id) => id !== memberId)
        : [...prev.assignedTo, memberId],
    }));
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status });
      if (selectedProjectId) {
        await Promise.all([loadProjectTasks(selectedProjectId), loadInitialData()]);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update task status");
    }
  };

  const toggleProjectMember = (memberId: string) => {
    setProjectForm((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(memberId)
        ? prev.memberIds.filter((id) => id !== memberId)
        : [...prev.memberIds, memberId],
    }));
  };

  const toggleEditableProjectMember = (memberId: string) => {
    setEditableProjectMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const saveProjectMembers = async () => {
    if (!selectedProjectId) return;
    setError("");
    try {
      await api.put(`/projects/${selectedProjectId}/members`, {
        memberIds: editableProjectMemberIds,
      });
      await loadInitialData();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update project members");
    }
  };

  if (!token || !user) {
    return (
      <main className="container">
        <h1>Team Task Manager</h1>
        <p className="subtext">Role-based project and task tracking (MERN)</p>
        <form className="card" onSubmit={handleAuth}>
          {mode === "signup" && (
            <>
              <label>Name</label>
              <input value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} required />
              <label>Role</label>
              <select value={authForm.role} onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </>
          )}
          <label>Email</label>
          <input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required />
          <label>Password</label>
          <input type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} required />
          <button disabled={loading} type="submit">
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>
          <button type="button" className="link-btn" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Login"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>Team Task Manager</h1>
          <p className="subtext">
            Welcome {user.name} ({user.role})
          </p>
        </div>
        <button onClick={logout}>Logout</button>
      </header>

      <section className="stats-grid">
        <article className="card"><h3>Total</h3><p>{stats.total}</p></article>
        <article className="card"><h3>To Do</h3><p>{stats.todo}</p></article>
        <article className="card"><h3>In Progress</h3><p>{stats.inProgress}</p></article>
        <article className="card"><h3>Done</h3><p>{stats.done}</p></article>
        <article className="card"><h3>Overdue</h3><p>{stats.overdue}</p></article>
      </section>

      {user.role === "admin" && (
        <section className="card">
          <h2>Create Project</h2>
          <form className="grid-form" onSubmit={createProject}>
            <input
              placeholder="Project name"
              value={projectForm.name}
              onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              required
            />
            <input
              placeholder="Description"
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
            />
            {assignableMembers.length === 0 ? (
              <p className="subtext">No members available. Create member accounts first.</p>
            ) : (
              <div className="member-list">
                {assignableMembers.map((teamUser) => (
                  <label key={teamUser.id} className="member-option">
                    <input
                      type="checkbox"
                      checked={projectForm.memberIds.includes(teamUser.id)}
                      onChange={() => toggleProjectMember(teamUser.id)}
                    />
                    {teamUser.name} ({teamUser.email})
                  </label>
                ))}
              </div>
            )}
            <p className="subtext">Selected members: {projectForm.memberIds.length}</p>
            <button type="submit">Create Project</button>
          </form>
        </section>
      )}

      <section className="card">
        <h2>Projects</h2>
        <select
          value={selectedProjectId}
          onChange={async (e) => {
            const projectId = e.target.value;
            setSelectedProjectId(projectId);
            await loadProjectTasks(projectId);
          }}
        >
          <option value="">Select a project</option>
          {projects.map((project) => (
            <option key={project._id} value={project._id}>
              {project.name}
            </option>
          ))}
        </select>
        {selectedProject && <p className="subtext">{selectedProject.description}</p>}
      </section>

      {user.role === "admin" && selectedProject && (
        <section className="card">
          <h2>Manage Project Members</h2>
          {assignableMembers.length === 0 ? (
            <p className="subtext">No members available. Create member accounts first.</p>
          ) : (
            <>
              <div className="member-list">
                {assignableMembers.map((teamUser) => (
                  <label key={teamUser.id} className="member-option">
                    <input
                      type="checkbox"
                      checked={editableProjectMemberIds.includes(teamUser.id)}
                      onChange={() => toggleEditableProjectMember(teamUser.id)}
                    />
                    {teamUser.name} ({teamUser.email})
                  </label>
                ))}
              </div>
              <p className="subtext">Selected members: {editableProjectMemberIds.length}</p>
              <button type="button" onClick={saveProjectMembers}>
                Save Project Members
              </button>
            </>
          )}
        </section>
      )}

      {selectedProjectId && (
        <>
          <section className="card">
            <h2>Create Task</h2>
            <form className="grid-form" onSubmit={createTask}>
              <input
                placeholder="Task title"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                required
              />
              <input
                placeholder="Description"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              />
              <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} required />
              <select value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as TaskStatus })}>
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              {taskAssignableMembers.length > 0 && (
                <div className="member-list">
                  {taskAssignableMembers.map((member) => (
                    <label key={member._id} className="member-option">
                      <input
                        type="checkbox"
                        checked={taskForm.assignedTo.includes(member._id)}
                        onChange={() => toggleTaskAssignee(member._id)}
                      />
                      {member.name} ({member.email})
                    </label>
                  ))}
                </div>
              )}
              <p className="subtext">Selected assignees: {taskForm.assignedTo.length}</p>
              {taskAssignableMembers.length === 0 && (
                <p className="subtext">No member assigned to this project yet. Edit project members first.</p>
              )}
              <button type="submit" disabled={taskAssignableMembers.length > 0 && taskForm.assignedTo.length === 0}>
                Add Task
              </button>
            </form>
          </section>

          <section className="card">
            <h2>Tasks</h2>
            {tasks.length === 0 ? (
              <p className="subtext">No tasks available for this project.</p>
            ) : (
              tasks.map((task) => (
                <article key={task._id} className="task-item">
                  <div>
                    <h3>{task.title}</h3>
                    <p>{task.description || "No description"}</p>
                    <small>
                      Assigned to: {task.assignedTo?.name || "Unknown"} | Due: {new Date(task.dueDate).toLocaleDateString()}
                    </small>
                  </div>
                  <select value={task.status} onChange={(e) => void updateTaskStatus(task._id, e.target.value as TaskStatus)}>
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </article>
              ))
            )}
          </section>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </main>
  );
};

export default App;
