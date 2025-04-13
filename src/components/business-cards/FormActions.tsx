
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Save, X } from "lucide-react";

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
    } else {
      navigate(cancelPath);
    }
  };
  
  return (
    <div className="flex justify-end gap-4 pt-6 border-t">
      <Button 
        type="button" 
        variant="outline" 
        disabled={isSubmitting} 
        onClick={handleCancel}
        className="flex items-center gap-1"
      >
        <X size={16} />
        {cancelLabel}
      </Button>
      
      <Button 
        type="submit" 
        disabled={isSubmitting}
        className="flex items-center gap-1"
      >
        {isSubmitting ? (
          <>
            <div className="animate-spin h-4 w-4 mr-1 border-2 border-b-transparent border-white rounded-full"></div>
            {submitLabel === "Create Job" ? "Creating..." : "Saving..."}
          </>
        ) : (
          <>
            <Save size={16} />
            {submitLabel}
          </>
        )}
      </Button>
    </div>
  );
};

export default FormActions;
