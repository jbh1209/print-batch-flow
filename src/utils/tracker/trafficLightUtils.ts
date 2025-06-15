
export function getDueStatusColor(dueDate?: string, slaTargetDays: number = 3): {
  color: string;
  label: string;
  code: "green" | "yellow" | "red";
} {
  if (!dueDate) {
    return { color: "gray", label: "No Due", code: "green" };
  }
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return { color: "#EF4444", label: "Overdue", code: "red" }; // Tailwind red-500
  }
  if (diffDays <= Math.ceil(slaTargetDays / 2)) {
    return { color: "#F59E42", label: "Due Soon", code: "yellow" }; // Tailwind amber-400
  }
  if (diffDays <= slaTargetDays) {
    return { color: "#FBBF24", label: "Upcoming", code: "yellow" }; // Tailwind yellow-400
  }
  return { color: "#22C55E", label: "On Track", code: "green" }; // Tailwind green-500
}
