
import { useState } from "react";
import { toast } from "sonner";

type FileUploadOptions = {
  acceptedTypes?: string[];
  maxSizeInMB?: number;
  onFileSelected?: (file: File) => void;
};

export function useFileUpload(options: FileUploadOptions = {}) {
  const { 
    acceptedTypes = ["application/pdf"], 
    maxSizeInMB = 10,
    onFileSelected
  } = options;
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024; // Convert MB to bytes

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) return;

    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      toast.error("Invalid file type", {
        description: `Please upload ${acceptedTypes.map(type => type.split('/')[1]).join(' or ')} file`
      });
      return;
    }

    // Validate file size
    if (file.size > maxSizeInBytes) {
      toast.error("File too large", {
        description: `File size should not exceed ${maxSizeInMB}MB`
      });
      return;
    }

    // Set the selected file and call the onFileSelected callback if provided
    setSelectedFile(file);
    
    if (onFileSelected) {
      onFileSelected(file);
    }
    
    // Show notification that file was selected
    toast.success("File selected", {
      description: file.name
    });
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
  };

  return {
    selectedFile,
    setSelectedFile,
    handleFileChange,
    clearSelectedFile,
    fileInfo: selectedFile ? {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
      sizeInKB: Math.round(selectedFile.size / 1024)
    } : null
  };
}
