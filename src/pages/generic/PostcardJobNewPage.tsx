
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { productConfigs } from '@/config/productTypes';
import { GenericJobForm } from '@/components/generic/GenericJobForm';
import { useGenericJobCreation } from '@/hooks/generic/useGenericJobCreation';

const PostcardJobNewPage = () => {
  const navigate = useNavigate();
  const config = productConfigs["Postcards"];
  const { createJob, isLoading } = useGenericJobCreation(config);

  return (
    <div className="container mx-auto py-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">New {config.ui.jobFormTitle} Job</h1>
        <Button 
          variant="outline" 
          onClick={() => navigate(config.routes.jobsPath)}
        >
          <ArrowLeft size={16} className="mr-1" />
          <span>Back to Jobs</span>
        </Button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <GenericJobForm 
          config={config}
          mode="create"
          initialData={{
            name: '',
            job_number: '',
            quantity: 100,
            due_date: new Date().toISOString().split('T')[0],
            size: config.availableSizes?.[0] || '',
            paper_type: config.availablePaperTypes?.[0] || '',
            paper_weight: config.availablePaperWeights?.[0] || '',
            lamination_type: 'none',
            pdf_url: '',
            file_name: ''
          } as any}
        />
      </div>
    </div>
  );
};

export default PostcardJobNewPage;
