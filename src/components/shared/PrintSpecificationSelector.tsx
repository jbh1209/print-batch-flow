
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePrintSpecifications } from '@/hooks/usePrintSpecifications';
import { Separator } from '@/components/ui/separator';

interface PrintSpecificationSelectorProps {
  productType: string;
  onSpecificationChange: (category: string, specificationId: string, specification: any) => void;
  selectedSpecifications?: Record<string, string>;
  disabled?: boolean;
}

export const PrintSpecificationSelector = ({
  productType,
  onSpecificationChange,
  selectedSpecifications = {},
  disabled = false
}: PrintSpecificationSelectorProps) => {
  const { getCompatibleSpecifications } = usePrintSpecifications();
  const [availableSpecs, setAvailableSpecs] = useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const categories = [
    { key: 'paper_type', label: 'Paper Type', required: true },
    { key: 'paper_weight', label: 'Paper Weight', required: true },
    { key: 'size', label: 'Size', required: true },
    { key: 'lamination_type', label: 'Lamination', required: false },
    { key: 'uv_varnish', label: 'UV Varnish', required: false }
  ];

  useEffect(() => {
    const loadSpecifications = async () => {
      setIsLoading(true);
      const specs: Record<string, any[]> = {};
      
      for (const category of categories) {
        const categorySpecs = await getCompatibleSpecifications(productType, category.key);
        specs[category.key] = categorySpecs;
      }
      
      setAvailableSpecs(specs);
      setIsLoading(false);
    };

    loadSpecifications();
  }, [productType]);

  const handleSpecificationChange = (category: string, specificationId: string) => {
    const specification = availableSpecs[category]?.find(spec => spec.id === specificationId);
    if (specification) {
      onSpecificationChange(category, specificationId, specification);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Print Specifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading specifications...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Print Specifications</CardTitle>
        <p className="text-sm text-muted-foreground">
          Select the print specifications for this job
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.map((category, index) => {
          const specs = availableSpecs[category.key] || [];
          const selectedSpec = specs.find(spec => spec.id === selectedSpecifications[category.key]);
          
          return (
            <div key={category.key}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor={category.key}>
                    {category.label}
                  </Label>
                  {category.required && (
                    <Badge variant="destructive" className="text-xs">Required</Badge>
                  )}
                  {selectedSpec?.is_default && (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  )}
                </div>
                
                <Select
                  value={selectedSpecifications[category.key] || ''}
                  onValueChange={(value) => handleSpecificationChange(category.key, value)}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${category.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {specs.length === 0 ? (
                      <SelectItem value="" disabled>
                        No {category.label.toLowerCase()} options available
                      </SelectItem>
                    ) : (
                      specs.map((spec) => (
                        <SelectItem key={spec.id} value={spec.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{spec.display_name}</span>
                            {spec.is_default && (
                              <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                
                {selectedSpec?.description && (
                  <p className="text-xs text-muted-foreground">
                    {selectedSpec.description}
                  </p>
                )}
              </div>
              
              {index < categories.length - 1 && <Separator className="my-4" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
