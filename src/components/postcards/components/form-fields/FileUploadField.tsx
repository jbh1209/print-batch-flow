
interface FileUploadFieldProps {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEdit?: boolean;
}

export const FileUploadField = ({
  selectedFile,
  setSelectedFile,
  handleFileChange,
  isEdit = false,
}: FileUploadFieldProps) => {
  return (
    <div className="my-4">
      <label className="block font-semibold mb-1">PDF File*</label>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="block"
      />
      {selectedFile && (
        <div className="mt-1 text-sm text-gray-600">
          Selected file: {selectedFile.name}
          <button
            type="button"
            onClick={() => setSelectedFile(null)}
            className="ml-2 text-red-600 underline text-xs"
          >
            Remove
          </button>
        </div>
      )}
      {isEdit && (
        <p className="text-xs text-muted-foreground">
          You can leave this blank to keep the existing file.
        </p>
      )}
    </div>
  );
};
