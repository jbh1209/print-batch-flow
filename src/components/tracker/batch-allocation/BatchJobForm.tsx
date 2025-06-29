
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { BusinessCardPrintSpecificationSelector } from '@/components/business-cards/BusinessCardPrintSpecificationSelector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { productConfigs } from '@/config/productTypes';

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

  const config = productConfigs[batchCategory as keyof typeof productConfigs];
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
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

      // Insert into the appropriate job table
      const { error } = await supabase
        .from(tableName as any)
        .insert(finalJobData);

      if (error) throw error;

      toast.success(`${config?.ui.jobFormTitle || 'Job'} created successfully`);
      onJobCreated();
    } catch (error) {
      console.error('Error creating batch job:', error);
      toast.error('Failed to create batch job');
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
          Job details pre-populated from production order
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="jobNumber">Job Number</Label>
              <Input
                id="jobNumber"
                value={jobNumber}
                onChange={(e) => setJobNumber(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value))}
                min="1"
                required
              />
            </div>
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={jobData.due_date}
                disabled
                className="bg-gray-50"
              />
            </div>
          </div>

          {batchCategory === 'business_cards' && (
            <BusinessCardPrintSpecificationSelector
              onSpecificationChange={handleSpecificationChange}
              selectedSpecifications={specifications}
              disabled={isProcessing}
            />
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Create Batch Job
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
