
import { format, differenceInDays, isPast } from "date-fns";
import { CircleCheck, CircleAlert, CircleX, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { productConfigs } from "@/config/productTypes";
import { useState, useEffect } from "react";
import { getWorkingDaysBetween } from "@/utils/dateCalculations";

interface DueDateIndicatorProps {
  dueDate: string;
  productType?: string;
}

const DueDateIndicator = ({ dueDate, productType = "Business Cards" }: DueDateIndicatorProps) => {
  const today = new Date();
  const dueDateObj = new Date(dueDate);
  const isPastDueDate = isPast(dueDateObj);
  const [workingDaysUntilDue, setWorkingDaysUntilDue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get SLA setting for this product type
  const slaTargetDays = productConfigs[productType]?.slaTargetDays || 3;
  
  useEffect(() => {
    const calculateWorkingDays = async () => {
      setIsLoading(true);
      try {
        const days = await getWorkingDaysBetween(today, dueDateObj);
        setWorkingDaysUntilDue(days);
      } catch (error) {
        console.error('Error calculating working days:', error);
        // Fallback to calendar days calculation
        setWorkingDaysUntilDue(differenceInDays(dueDateObj, today));
      } finally {
        setIsLoading(false);
      }
    };

    calculateWorkingDays();
  }, [dueDate, today, dueDateObj]);
  
  const getIndicator = () => {
    if (isLoading) {
      return {
        icon: <Clock className="h-5 w-5 text-gray-400" />,
        text: "Loading...",
        color: "text-gray-700",
        urgency: "none"
      };
    }

    if (isPastDueDate) {
      return {
        icon: <CircleX className="h-5 w-5 text-red-500" />,
        text: "Overdue",
        color: "text-red-700",
        urgency: "critical"
      };
    } else if (workingDaysUntilDue <= 1) {
      // Critical - Due within 1 working day
      return {
        icon: <CircleAlert className="h-5 w-5 text-red-500" />,
        text: "Critical",
        color: "text-red-700",
        urgency: "high"
      };
    } else if (workingDaysUntilDue <= Math.ceil(slaTargetDays / 2)) {
      // Warning - Due within half of SLA target days
      return {
        icon: <CircleAlert className="h-5 w-5 text-amber-500" />,
        text: "Due Soon",
        color: "text-amber-700",
        urgency: "medium"
      };
    } else if (workingDaysUntilDue <= slaTargetDays) {
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
            {!isLoading && (
              workingDaysUntilDue >= 0 ? (
                <span className="text-muted-foreground font-normal">
                  {' '}({workingDaysUntilDue} working days remaining)
                </span>
              ) : (
                <span className="text-muted-foreground font-normal">
                  {' '}({Math.abs(workingDaysUntilDue)} working days ago)
                </span>
              )
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            SLA Target: {slaTargetDays} working days (excluding weekends & holidays)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default DueDateIndicator;
