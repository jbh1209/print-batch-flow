
import React, { useEffect, useState } from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFormContext } from 'react-hook-form';
import { usePrintSpecifications } from '@/hooks/usePrintSpecifications';

interface BusinessCardPrintSpecificationSelectorProps {
  onSpecificationChange?: (category: string, specificationId: string, specification: any) => void;
  selectedSpecifications?: Record<string, string>;
  disabled?: boolean;
}

export const BusinessCardPrintSpecificationSelector: React.FC<BusinessCardPrintSpecificationSelectorProps> = ({
  onSpecificationChange,
  selectedSpecifications = {},
  disabled = false
}) => {
  const { control, setValue, watch } = useFormContext();
  const { getCompatibleSpecifications } = usePrintSpecifications();
  const [specificationOptions, setSpecificationOptions] = useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Only show categories relevant to business cards
  const categories = [
    { key: 'paper_type', label: 'Paper Type', required: true },
    { key: 'lamination_type', label: 'Lamination Type', required: true }
  ];

  useEffect(() => {
    const loadSpecifications = async () => {
      setIsLoading(true);
      const options: Record<string, any[]> = {};
      
      for (const category of categories) {
        const specs = await getCompatibleSpecifications('business_cards', category.key);
        options[category.key] = specs;
      }
      
      setSpecificationOptions(options);
      setIsLoading(false);
    };

    loadSpecifications();
  }, []);

  const handleSpecificationChange = (category: string, specificationId: string) => {
    const specification = specificationOptions[category]?.find(spec => spec.id === specificationId);
    if (specification) {
      // Update form field with display name to maintain compatibility with existing validation
      setValue(category === 'paper_type' ? 'paperType' : 'laminationType', specification.display_name);
      
      // Notify parent component for future automated batching logic
      onSpecificationChange?.(category, specificationId, specification);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {categories.map(category => (
          <div key={category.key} className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2 w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map(category => {
          const options = specificationOptions[category.key] || [];
          const formFieldName = category.key === 'paper_type' ? 'paperType' : 'laminationType';
          
          return (
            <FormField
              key={category.key}
              control={control}
              name={formFieldName}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {category.label}
                    {category.required && <span className="text-red-500 ml-1">*</span>}
                  </FormLabel>
                  <Select
                    disabled={disabled || options.length === 0}
                    onValueChange={(value) => {
                      field.onChange(value);
                      const spec = options.find(opt => opt.display_name === value);
                      if (spec) {
                        handleSpecificationChange(category.key, spec.id);
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
                              : `Select ${category.label.toLowerCase()}`
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
