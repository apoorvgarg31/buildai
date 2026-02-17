// DEPRECATED: Use Clerk auth instead. Kept for reference only.
// Fake auth for investor demo — no real authentication
export type Role = "admin" | "user";

export interface DemoUser {
  email: string;
  password: string;
  role: Role;
  name: string;
  title: string;
  avatar: string; // initials
  agentId?: string; // assigned agent (for chat routing)
}

export const DEMO_USERS: DemoUser[] = [
  {
    email: "admin@buildai.com",
    password: "admin123",
    role: "admin",
    name: "Sarah Chen",
    title: "PMO Director",
    avatar: "SC",
  },
  {
    email: "pm@buildai.com",
    password: "demo123",
    role: "user",
    name: "Mike Torres",
    title: "Senior Project Manager",
    avatar: "MT",
    agentId: "sarah-pm-agent", // default demo agent
  },
];

export function authenticate(
  email: string,
  password: string
): DemoUser | null {
  return (
    DEMO_USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    ) ?? null
  );
}
