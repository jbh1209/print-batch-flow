
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface FormActionsProps {
  isSubmitting: boolean;
  cancelPath: string;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
}

const FormActions = ({ 
  isSubmitting, 
  cancelPath, 
  submitLabel = "Create Job",
  cancelLabel = "Cancel",
  onCancel
}: FormActionsProps) => {
  const navigate = useNavigate();

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    navigate(cancelPath);
  };

  return (
    <div className="flex justify-end space-x-2">
      <Button 
        type="button" 
        variant="outline" 
        onClick={handleCancel}
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
