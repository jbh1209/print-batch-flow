
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
  isEdit = false
}: FileUploadFieldProps) => {
  const handleFileRemove = () => {
    setSelectedFile(null);
  };

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">PDF Upload</h3>
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
        <input
          type="file"
          id="file-upload"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        
        {selectedFile ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
              <span className="text-lg font-medium">{selectedFile.name}</span>
            </div>
            <p className="text-sm text-gray-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button 
              type="button"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              onClick={handleFileRemove}
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              {isEdit ? "Upload a new PDF to replace the current one (optional)" : "Upload a PDF file of your postcard design"}
            </p>
            <p className="mt-1 text-xs text-gray-500">PDF up to 10MB</p>
            
            <button 
              type="button"
              className="mt-2 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              Select PDF
            </button>
          </>
        )}
      </div>
    </div>
  );
};
