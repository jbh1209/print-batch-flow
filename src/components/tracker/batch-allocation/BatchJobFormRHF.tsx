
import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useFileUpload } from '@/hooks/useFileUpload';
import { getProductConfigByCategory, getCategorySpecificFields } from '@/utils/batch/categoryMapper';
import { batchJobFormSchema, BatchJobFormData } from './batchJobFormSchema';
import { JobFormFieldsRHF } from './JobFormFieldsRHF';
import { FileUploadSectionRHF } from './FileUploadSectionRHF';
import { SpecificationSectionRHF } from './SpecificationSectionRHF';
import { FormActionsRHF } from './FormActionsRHF';

interface JobData {
  wo_no: string;
  customer: string;
  qty: number;
  due_date: string;
}

interface BatchJobFormRHFProps {
  jobData: JobData;
  batchCategory: string;
  onJobCreated: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export const BatchJobFormRHF: React.FC<BatchJobFormRHFProps> = ({
  jobData,
  batchCategory,
  onJobCreated,
  onCancel,
  isProcessing
}) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  // Initialize form with React Hook Form
  const form = useForm<BatchJobFormData>({
    resolver: zodResolver(batchJobFormSchema),
    defaultValues: {
      jobNumber: jobData.wo_no,
      clientName: jobData.customer,
      quantity: jobData.qty,
      dueDate: jobData.due_date,
    }
  });

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

  // Get product configuration using the category mapper
  let config;
  try {
    config = getProductConfigByCategory(batchCategory);
  } catch (error) {
    console.error('Category mapping error:', error);
    toast.error(error instanceof Error ? error.message : 'Invalid batch category');
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Error: Invalid batch category "{batchCategory}"</p>
            <button onClick={onCancel} className="mt-4 px-4 py-2 bg-gray-500 text-white rounded">
              Go Back
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const handleSubmit = async (data: BatchJobFormData) => {
    if (!selectedFile) {
      toast.error('Please select a PDF file to upload');
      return;
    }
    
    try {
      setIsUploading(true);

      // Upload file to Supabase storage
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
      const tableName = config.tableName;
      if (!tableName) {
        throw new Error(`No table configuration found for category: ${batchCategory}`);
      }

      // Create the job data based on the batch category
      const baseJobData = {
        user_id: user?.id,
        name: data.clientName,
        job_number: data.jobNumber,
        quantity: data.quantity,
        due_date: new Date(jobData.due_date).toISOString(),
        status: 'queued',
        pdf_url: publicUrl,
        file_name: selectedFile.name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add category-specific fields based on form data
      const categorySpecificData = getCategorySpecificFields(batchCategory, data);

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

      toast.success(`${config.ui.jobFormTitle} created successfully`);
      onJobCreated();
    } catch (error) {
      console.error('Error creating batch job:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create batch job');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create {config.ui.jobFormTitle}</CardTitle>
        <p className="text-sm text-gray-600">
          Job details pre-populated from production order. Please upload the PDF file for this job.
        </p>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <JobFormFieldsRHF />

            <FileUploadSectionRHF
              selectedFile={selectedFile}
              onFileChange={handleFileChange}
              onClearFile={clearSelectedFile}
              fileInfo={fileInfo}
            />

            <SpecificationSectionRHF
              batchCategory={batchCategory}
              disabled={isProcessing || isUploading}
            />

            <FormActionsRHF
              isProcessing={isProcessing}
              isUploading={isUploading}
              hasSelectedFile={!!selectedFile}
              onCancel={onCancel}
            />
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
};
