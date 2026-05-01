export type Role = "admin" | "member";
export type TaskStatus = "todo" | "in-progress" | "done";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ProjectMember {
  _id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Project {
  _id: string;
  name: string;
  description: string;
  members: ProjectMember[];
}

export interface Task {
  _id: string;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string;
  project: string;
  assignedTo: ProjectMember;
}

export interface DashboardStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
}
