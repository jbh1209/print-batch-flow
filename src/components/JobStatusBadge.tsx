
import { Badge } from "@/components/ui/badge";

interface JobStatusBadgeProps {
  status: string;
}

const JobStatusBadge = ({ status }: JobStatusBadgeProps) => {
  const getVariant = () => {
    switch (status) {
      case "queued":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "batched":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      case "sent_to_print":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getDisplayText = () => {
    if (status === "sent_to_print") {
      return "Sent to Print";
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <Badge className={`font-medium ${getVariant()}`} variant="outline">
      {getDisplayText()}
    </Badge>
  );
};

export default JobStatusBadge;
