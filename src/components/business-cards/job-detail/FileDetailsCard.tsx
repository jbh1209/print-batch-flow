
import React from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FileDetailsCardProps {
  file_name?: string;
  pdf_url?: string;
  onViewPDF: () => void;
}

const FileDetailsCard: React.FC<FileDetailsCardProps> = ({ file_name, pdf_url, onViewPDF }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>File Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm">
          <div className="font-medium text-gray-500">Filename</div>
          <div className="mt-1 break-all">{file_name || 'No file name'}</div>
        </div>

        {pdf_url && (
          <Button 
            className="w-full mt-4"
            onClick={onViewPDF}
          >
            <Eye size={16} className="mr-2" />
            Open PDF
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default FileDetailsCard;
