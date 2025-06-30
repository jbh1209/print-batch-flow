
import React, { useEffect, useState } from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFormContext } from 'react-hook-form';
import { usePrintSpecifications } from '@/hooks/usePrintSpecifications';

interface PrintSpecificationSelectorProps {
  productType: string;
  onSpecificationChange?: (category: string, specificationId: string, specification: any) => void;
  selectedSpecifications?: Record<string, string>;
  disabled?: boolean;
}

export const PrintSpecificationSelector: React.FC<PrintSpecificationSelectorProps> = ({
  productType,
  onSpecificationChange,
  selectedSpecifications = {},
  disabled = false
}) => {
  const { control, setValue, watch } = useFormContext();
  const { getCompatibleSpecifications, getAvailableCategories } = usePrintSpecifications();
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [specificationOptions, setSpecificationOptions] = useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCategoriesAndSpecifications = async () => {
      setIsLoading(true);
      
      // First, get all available categories for this product type
      const categories = await getAvailableCategories(productType);
      setAvailableCategories(categories);
      
      // Then load specifications for each category
      const options: Record<string, any[]> = {};
      
      for (const category of categories) {
        const specs = await getCompatibleSpecifications(productType, category);
        options[category] = specs;
      }
      
      setSpecificationOptions(options);
      setIsLoading(false);
    };

    loadCategoriesAndSpecifications();
  }, [productType]);

  const handleSpecificationChange = (category: string, specificationId: string) => {
    const specification = specificationOptions[category]?.find(spec => spec.id === specificationId);
    if (specification) {
      // Update form field with display name
      setValue(category, specification.display_name);
      
      // Notify parent component
      onSpecificationChange?.(category, specificationId, specification);
    }
  };

  const getCategoryLabel = (category: string) => {
    // Convert category key to readable label
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2 w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (availableCategories.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Print Specifications</h3>
        <p className="text-sm text-gray-500">No specifications available for this product type.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Print Specifications</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availableCategories.map(category => {
          const options = specificationOptions[category] || [];
          const categoryLabel = getCategoryLabel(category);
          
          return (
            <FormField
              key={category}
              control={control}
              name={category}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{categoryLabel}</FormLabel>
                  <Select
                    disabled={disabled || options.length === 0}
                    onValueChange={(value) => {
                      field.onChange(value);
                      const spec = options.find(opt => opt.display_name === value);
                      if (spec) {
                        handleSpecificationChange(category, spec.id);
                      }
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue 
                          placeholder={
                            options.length === 0 
                              ? "No options available" 
                              : `Select ${categoryLabel.toLowerCase()}`
                          } 
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {options.map((spec) => (
                        <SelectItem key={spec.id} value={spec.display_name}>
                          <div>
                            <div className="font-medium">{spec.display_name}</div>
                            {spec.description && (
                              <div className="text-sm text-gray-500">{spec.description}</div>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        })}
      </div>
    </div>
  );
};
