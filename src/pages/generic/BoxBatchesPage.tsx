
import React, { useEffect, useState } from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericBatchesPage from '@/components/generic/GenericBatchesPage';
import { useGenericBatches } from '@/hooks/generic/useGenericBatches';
import { getProductTypeCode } from '@/utils/batch/productTypeCodes';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from '@/integrations/supabase/client';

const BoxBatchesPage = () => {
  const config = productConfigs["Boxes"];
  const [debugVisible, setDebugVisible] = useState(false);
  
  useEffect(() => {
    const productCode = getProductTypeCode("Boxes");
    console.log(`BoxBatchesPage initialized with product code: ${productCode}`);
    console.log('Box config:', {
      productType: config.productType,
      tableName: config.tableName,
      jobNumberPrefix: config.jobNumberPrefix
    });
  }, []);
  
  // Use the useGenericBatches hook directly to expose more debugging info
  const batchesHook = () => {
    const hook = useGenericBatches(config);
    console.log('Boxes batches data:', hook.batches);
    
    if (hook.batches.length === 0 && !hook.isLoading) {
      console.warn('No boxes batches found! This might indicate a filtering issue.');
      
      // Enhanced debug logging for product code issues
      const productCode = getProductTypeCode(config.productType);
      console.log(`Product type: ${config.productType}, Product code: ${productCode}`);
      console.log(`Expected batch names should include patterns like: DXB-${productCode}-XXXXX`);
      
      // Manually try to print all batches to diagnose
      supabase
        .from('batches')
        .select('name')
        .then(({ data }) => {
          if (data && data.length > 0) {
            console.log('All available batch names in database:', data.map(b => b.name).join(', '));
          }
        });
    } else {
      console.log('Box batch names:', hook.batches.map(b => b.name).join(', '));
    }
    
    return hook;
  };

  const toggleDebug = () => {
    setDebugVisible(!debugVisible);
  };

  const forceFetch = () => {
    window.location.href = window.location.pathname + '?refresh=' + Date.now();
    toast.success('Forcing refresh of batches data');
  };
  
  return (
    <div>
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4">
          <Button variant="outline" size="sm" onClick={toggleDebug}>
            {debugVisible ? 'Hide Debug Info' : 'Show Debug Info'}
          </Button>
          <Button variant="outline" size="sm" className="ml-2" onClick={forceFetch}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Force Refresh
          </Button>
        </div>
      )}
      
      {debugVisible && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Debug Information</AlertTitle>
          <AlertDescription>
            <div>Product Type: {config.productType}</div>
            <div>Product Code: {getProductTypeCode(config.productType)}</div>
            <div>Table Name: {config.tableName}</div>
            <div>Job Number Prefix: {config.jobNumberPrefix}</div>
            <div>Expected Batch Name Pattern: DXB-{getProductTypeCode(config.productType)}-#####</div>
          </AlertDescription>
        </Alert>
      )}
      
      <GenericBatchesPage config={config} useBatchesHook={batchesHook} />
    </div>
  );
};

export default BoxBatchesPage;
