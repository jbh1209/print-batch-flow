
export function getDueStatusColor(
  dueDate?: string,
  slaTargetDays: number = 3
): {
  color: string;
  label: string;
  code: "green" | "yellow" | "red";
  warning?: boolean;
} {
  if (!dueDate) {
    return {
      color: "#F59E42", // amber-400 for missing due dates
      label: "Missing Due Date",
      code: "yellow",
      warning: true,
    };
  }
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return { color: "#EF4444", label: "Overdue", code: "red" };
  }
  if (diffDays <= Math.ceil(slaTargetDays / 2)) {
    return { color: "#F59E42", label: "Due Soon", code: "yellow" };
  }
  if (diffDays <= slaTargetDays) {
    return { color: "#FBBF24", label: "Upcoming", code: "yellow" };
  }
  return { color: "#22C55E", label: "On Track", code: "green" };
}
