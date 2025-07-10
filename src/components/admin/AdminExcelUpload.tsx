import React from "react";
import { useExcelUpload } from "@/hooks/useExcelUpload";
import { FileDropZone } from "@/components/admin/upload/FileDropZone";
import { UploadTips } from "@/components/admin/upload/UploadTips";
import { MatrixMappingDialog } from "@/components/tracker/MatrixMappingDialog";

interface AdminExcelUploadProps {
  onDataUploaded: (data: any) => void;
}

export const AdminExcelUpload: React.FC<AdminExcelUploadProps> = ({ onDataUploaded }) => {
  const {
    isProcessing,
    uploadProgress,
    showMatrixDialog,
    setShowMatrixDialog,
    matrixData,
    handleFileUpload,
    handleMatrixMappingConfirmed,
  } = useExcelUpload({ onDataUploaded });

  return (
    <div className="space-y-4">
      <FileDropZone
        isProcessing={isProcessing}
        uploadProgress={uploadProgress}
        onFileUpload={handleFileUpload}
      />
      
      <UploadTips />
      
      <MatrixMappingDialog
        open={showMatrixDialog}
        onOpenChange={setShowMatrixDialog}
        matrixData={matrixData}
        onMappingConfirmed={handleMatrixMappingConfirmed}
      />
    </div>
  );
};