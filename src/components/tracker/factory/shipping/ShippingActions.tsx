import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs/types";
import { ShippingCompletionDialog } from "./ShippingCompletionDialog";

interface ShippingActionsProps {
  job: AccessibleJob;
  stageInstanceId: string;
  onComplete: () => void;
}

export const ShippingActions = ({
  job,
  stageInstanceId,
  onComplete
}: ShippingActionsProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Button 
          onClick={() => setIsDialogOpen(true)}
          className="flex-1"
        >
          <Package className="h-4 w-4 mr-2" />
          Complete Shipping
        </Button>
      </div>

      <ShippingCompletionDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        job={job}
        stageInstanceId={stageInstanceId}
        onComplete={onComplete}
      />
    </>
  );
};
