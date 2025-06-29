
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { productConfigs } from '@/config/productTypes';
import { useFileUpload } from '@/hooks/useFileUpload';
import { JobFormFields } from './JobFormFields';
import { FileUploadSection } from './FileUploadSection';
import { SpecificationSection } from './SpecificationSection';
import { FormActions } from './FormActions';

interface JobData {
  wo_no: string;
  customer: string;
  qty: number;
  due_date: string;
}

interface BatchJobFormProps {
  jobData: JobData;
  batchCategory: string;
  onJobCreated: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export const BatchJobForm: React.FC<BatchJobFormProps> = ({
  jobData,
  batchCategory,
  onJobCreated,
  onCancel,
  isProcessing
}) => {
  const { user } = useAuth();
  const [jobNumber, setJobNumber] = useState(jobData.wo_no);
  const [clientName, setClientName] = useState(jobData.customer);
  const [quantity, setQuantity] = useState(jobData.qty);
  const [specifications, setSpecifications] = useState<Record<string, any>>({});
  const [isUploading, setIsUploading] = useState(false);

  // File upload hook
  const { 
    selectedFile, 
    setSelectedFile, 
    handleFileChange, 
    fileInfo,
    clearSelectedFile 
  } = useFileUpload({
    acceptedTypes: ['application/pdf'],
    maxSizeInMB: 10
  });

  // Map category key to config key
  const configKey = batchCategory === 'business_cards' ? 'BusinessCards' : batchCategory;
  const config = productConfigs[configKey as keyof typeof productConfigs];
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast.error('Please select a PDF file to upload');
      return;
    }
    
    try {
      setIsUploading(true);

      // Upload file to Supabase storage using the same approach as BatchFlow
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `batch-jobs/${fileName}`;

      console.log('Uploading file:', { fileName, filePath, size: selectedFile.size });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pdf_files')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`File upload failed: ${uploadError.message}`);
      }

      console.log('File uploaded successfully:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('pdf_files')
        .getPublicUrl(filePath);

      console.log('Public URL generated:', publicUrl);

      // Get the table name for this batch category
      const tableName = config?.tableName;
      if (!tableName) {
        throw new Error(`No table configuration found for category: ${batchCategory}`);
      }

      // Create the job data based on the batch category
      const baseJobData = {
        user_id: user?.id,
        name: clientName,
        job_number: jobNumber,
        quantity: quantity,
        due_date: new Date(jobData.due_date).toISOString(),
        status: 'queued',
        pdf_url: publicUrl,
        file_name: selectedFile.name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add category-specific fields based on specifications
      let categorySpecificData = {};
      if (batchCategory === 'business_cards') {
        categorySpecificData = {
          paper_type: specifications.paperType || '350gsm Matt',
          lamination_type: specifications.laminationType || 'none',
          double_sided: specifications.doubleSided || false,
          paper_weight: specifications.paperWeight || '350gsm'
        };
      }
      // Add other category handlers as needed

      const finalJobData = {
        ...baseJobData,
        ...categorySpecificData
      };

      console.log('Inserting job data:', finalJobData);

      // Insert into the appropriate job table
      const { data: insertedData, error: insertError } = await supabase
        .from(tableName as any)
        .insert(finalJobData)
        .select();

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw new Error(`Database insert failed: ${insertError.message}`);
      }

      console.log('Job created successfully:', insertedData);

      toast.success(`${config?.ui.jobFormTitle || 'Job'} created successfully`);
      onJobCreated();
    } catch (error) {
      console.error('Error creating batch job:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create batch job');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSpecificationChange = (category: string, specificationId: string, specification: any) => {
    setSpecifications(prev => ({
      ...prev,
      [category === 'paper_type' ? 'paperType' : 
       category === 'lamination_type' ? 'laminationType' :
       category === 'paper_weight' ? 'paperWeight' : category]: specification.display_name
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create {config?.ui.jobFormTitle || 'Batch Job'}</CardTitle>
        <p className="text-sm text-gray-600">
          Job details pre-populated from production order. Please upload the PDF file for this job.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <JobFormFields
            jobNumber={jobNumber}
            clientName={clientName}
            quantity={quantity}
            dueDate={jobData.due_date}
            onJobNumberChange={setJobNumber}
            onClientNameChange={setClientName}
            onQuantityChange={setQuantity}
          />

          <FileUploadSection
            selectedFile={selectedFile}
            onFileChange={handleFileChange}
            onClearFile={clearSelectedFile}
            fileInfo={fileInfo}
          />

          <SpecificationSection
            batchCategory={batchCategory}
            specifications={specifications}
            onSpecificationChange={handleSpecificationChange}
            disabled={isProcessing || isUploading}
          />

          <FormActions
            isProcessing={isProcessing}
            isUploading={isUploading}
            hasSelectedFile={!!selectedFile}
            onCancel={onCancel}
          />
        </form>
      </CardContent>
    </Card>
  );
};
