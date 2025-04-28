
import { format, differenceInDays } from "date-fns";
import { CircleCheck, CircleAlert, CircleX, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { productConfigs } from "@/config/productTypes";

interface DueDateIndicatorProps {
  dueDate: string;
  productType?: string;
}

const DueDateIndicator = ({ dueDate, productType = "Business Cards" }: DueDateIndicatorProps) => {
  const today = new Date();
  const dueDateObj = new Date(dueDate);
  const daysUntilDue = differenceInDays(dueDateObj, today);
  
  // Get SLA setting for this product type
  const slaTargetDays = productConfigs[productType]?.slaTargetDays || 3;
  
  const getIndicator = () => {
    if (daysUntilDue < 0) {
      return {
        icon: <CircleX className="h-5 w-5 text-red-500" />,
        text: "Overdue",
        color: "text-red-700",
        urgency: "high"
      };
    } else if (daysUntilDue <= 1) {
      // Critical - Due within 1 day
      return {
        icon: <CircleAlert className="h-5 w-5 text-red-500" />,
        text: "Critical",
        color: "text-red-700",
        urgency: "high"
      };
    } else if (daysUntilDue <= Math.ceil(slaTargetDays / 2)) {
      // Warning - Due within half of SLA target days
      return {
        icon: <CircleAlert className="h-5 w-5 text-amber-500" />,
        text: "Due Soon",
        color: "text-amber-700",
        urgency: "medium"
      };
    } else if (daysUntilDue <= slaTargetDays) {
      // Caution - Due within SLA target days
      return {
        icon: <Clock className="h-5 w-5 text-blue-500" />,
        text: "Upcoming",
        color: "text-blue-700",
        urgency: "low"
      };
    } else {
      // Good - Due after SLA target days
      return {
        icon: <CircleCheck className="h-5 w-5 text-green-500" />,
        text: "On Track",
        color: "text-green-700",
        urgency: "none"
      };
    }
  };

  const indicator = getIndicator();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="flex items-center gap-2">
          {indicator.icon}
          <span className="text-sm">{format(dueDateObj, 'MMM dd, yyyy')}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className={`${indicator.color} font-medium`}>
            {indicator.text}
            {daysUntilDue >= 0 ? (
              <span className="text-muted-foreground font-normal">
                {' '}({daysUntilDue} days remaining)
              </span>
            ) : (
              <span className="text-muted-foreground font-normal">
                {' '}({Math.abs(daysUntilDue)} days ago)
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            SLA Target: {slaTargetDays} days
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default DueDateIndicator;
