
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface FormActionsProps {
  isSubmitting: boolean;
  cancelPath: string;
  submitLabel?: string;
  cancelLabel?: string;
}

const FormActions = ({ 
  isSubmitting, 
  cancelPath, 
  submitLabel = "Create Job",
  cancelLabel = "Cancel"
}: FormActionsProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-end space-x-2">
      <Button 
        type="button" 
        variant="outline" 
        onClick={() => navigate(cancelPath)}
      >
        {cancelLabel}
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Uploading..." : submitLabel}
      </Button>
    </div>
  );
};

export default FormActions;
