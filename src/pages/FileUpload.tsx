
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Upload } from 'lucide-react';
import { toast } from "sonner";

const FileUpload = () => {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(e.target.files);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast.error("Please select files to upload");
      return;
    }

    setUploading(true);
    setUploadStatus('idle');
    setUploadedFiles([]);
    setErrorMessage('');

    try {
      const fileArray = Array.from(selectedFiles);
      const uploadSuccessFiles: string[] = [];
      
      // Here we'd normally upload to a server
      // For now, we'll just simulate a successful upload
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Process each file
      for (const file of fileArray) {
        uploadSuccessFiles.push(file.name);
        
        // Here's where you would store/process the file contents
        // For example, read file content and store in localStorage or IndexedDB
        const reader = new FileReader();
        
        reader.onload = (event) => {
          if (event.target && event.target.result) {
            const content = event.target.result as string;
            // Store file content in localStorage (limited by size)
            try {
              localStorage.setItem(`file_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`, content);
            } catch (e) {
              console.error("Error storing file in localStorage:", e);
              // If localStorage fails (due to size limits), you could use IndexedDB
            }
          }
        };
        
        reader.readAsText(file);
      }
      
      setUploadedFiles(uploadSuccessFiles);
      setUploadStatus('success');
      toast.success(`Successfully uploaded ${uploadSuccessFiles.length} files`);
    } catch (error) {
      console.error("Error uploading files:", error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : "An unknown error occurred");
      toast.error("Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Upload Project Files</CardTitle>
          <CardDescription>
            Upload your deployed project files to restore your working version
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-2">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-700">
                    Choose files or drag and drop
                  </span>
                  <Input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Select the TypeScript files from your deployed version
              </p>
              {selectedFiles && (
                <p className="mt-2 text-sm text-gray-500">
                  {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected
                </p>
              )}
            </div>

            <Button 
              onClick={handleFileUpload} 
              disabled={!selectedFiles || uploading}
              className="w-full"
            >
              {uploading ? 'Uploading...' : 'Upload Files'}
            </Button>

            {uploadStatus === 'success' && (
              <Alert variant="default" className="bg-green-50 text-green-900 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle>Upload Successful</AlertTitle>
                <AlertDescription>
                  <p>Successfully uploaded {uploadedFiles.length} files.</p>
                  <ul className="mt-2 text-xs max-h-40 overflow-y-auto">
                    {uploadedFiles.map((file, index) => (
                      <li key={index}>{file}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {uploadStatus === 'error' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Upload Failed</AlertTitle>
                <AlertDescription>
                  {errorMessage || "There was an error uploading your files. Please try again."}
                </AlertDescription>
              </Alert>
            )}

            <div className="mt-6">
              <h3 className="text-md font-medium">Instructions:</h3>
              <ol className="list-decimal pl-4 mt-2 space-y-1 text-sm">
                <li>Go to your deployed version in the browser</li>
                <li>Open the browser's developer tools (F12 or right-click {'>'} Inspect)</li>
                <li>Navigate to the Sources tab</li>
                <li>Find your project's source files (usually under a folder with your project name)</li>
                <li>Right-click on each TypeScript file and save it locally</li>
                <li>Upload those files here</li>
              </ol>
              <p className="text-sm mt-2">
                Note: This is a temporary solution. The files are stored in your browser's local storage
                which has size limitations (typically 5-10MB).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Uploaded Files Manager</CardTitle>
          <CardDescription>
            Manage your uploaded project files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm">
              This section will show all files you've uploaded. You can download them or delete them.
            </p>
            <div className="border rounded-md p-4">
              <p className="text-center text-gray-500">
                {localStorage && Object.keys(localStorage).filter(key => key.startsWith('file_')).length > 0 ? (
                  <>Files available for download</>
                ) : (
                  <>No files uploaded yet</>
                )}
              </p>
              {localStorage && (
                <ul className="mt-4 divide-y">
                  {Object.keys(localStorage)
                    .filter(key => key.startsWith('file_'))
                    .map((key, index) => (
                      <li key={index} className="py-2 flex justify-between items-center">
                        <span>{key.replace('file_', '').replace(/_/g, '-')}</span>
                        <div className="space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const content = localStorage.getItem(key) || '';
                              const blob = new Blob([content], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = key.replace('file_', '').replace(/_/g, '-');
                              document.body.appendChild(a);
                              a.click();
                              URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                            }}
                          >
                            Download
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => {
                              localStorage.removeItem(key);
                              // Force a re-render
                              setUploadedFiles([...uploadedFiles]);
                              toast.success("File removed");
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
            {localStorage && Object.keys(localStorage).filter(key => key.startsWith('file_')).length > 0 && (
              <Button 
                variant="destructive"
                onClick={() => {
                  Object.keys(localStorage)
                    .filter(key => key.startsWith('file_'))
                    .forEach(key => localStorage.removeItem(key));
                  setUploadedFiles([]);
                  toast.success("All files removed");
                }}
              >
                Clear All Files
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FileUpload;
