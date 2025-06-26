
import { isPublicHoliday, isWorkingDay, getWorkingDaysBetween } from "@/utils/dateCalculations";

export async function getDueStatusColor(
  dueDate?: string,
  slaTargetDays: number = 3
): Promise<{
  color: string;
  label: string;
  code: "green" | "yellow" | "red";
  warning?: boolean;
}> {
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
  
  // Check if due date is in the past
  if (due < now && due.toDateString() !== now.toDateString()) {
    return { color: "#EF4444", label: "Overdue", code: "red" };
  }

  // Calculate working days between now and due date
  const workingDaysUntilDue = await getWorkingDaysBetween(now, due);

  if (workingDaysUntilDue < 0) {
    return { color: "#EF4444", label: "Overdue", code: "red" };
  }
  if (workingDaysUntilDue <= Math.ceil(slaTargetDays / 2)) {
    return { color: "#F59E42", label: "Due Soon", code: "yellow" };
  }
  if (workingDaysUntilDue <= slaTargetDays) {
    return { color: "#FBBF24", label: "Upcoming", code: "yellow" };
  }
  return { color: "#22C55E", label: "On Track", code: "green" };
}
