
import { useState, useEffect } from 'react';
import { usePrintSpecifications } from './usePrintSpecifications';

interface UseJobSpecificationsProps {
  productType: string;
  onSpecificationChange?: (specifications: Record<string, any>) => void;
}

export const useJobSpecifications = ({ 
  productType, 
  onSpecificationChange 
}: UseJobSpecificationsProps) => {
  const { getCompatibleSpecifications } = usePrintSpecifications();
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, any>>({});
  const [availableSpecs, setAvailableSpecs] = useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const categories = [
    'paper_type',
    'paper_weight', 
    'size',
    'lamination_type',
    'uv_varnish'
  ];

  useEffect(() => {
    const loadSpecifications = async () => {
      setIsLoading(true);
      const specs: Record<string, any[]> = {};
      
      for (const category of categories) {
        const categorySpecs = await getCompatibleSpecifications(productType, category);
        specs[category] = categorySpecs;
      }
      
      setAvailableSpecs(specs);
      setIsLoading(false);
    };

    loadSpecifications();
  }, [productType]);

  const handleSpecificationChange = (category: string, specificationId: string, specification: any) => {
    const newSpecs = {
      ...selectedSpecs,
      [category]: {
        id: specificationId,
        ...specification
      }
    };
    
    setSelectedSpecs(newSpecs);
    onSpecificationChange?.(newSpecs);
  };

  const getSpecificationValue = (category: string, field: 'display_name' | 'name' = 'display_name') => {
    return selectedSpecs[category]?.[field] || '';
  };

  return {
    selectedSpecs,
    availableSpecs,
    isLoading,
    handleSpecificationChange,
    getSpecificationValue
  };
};
