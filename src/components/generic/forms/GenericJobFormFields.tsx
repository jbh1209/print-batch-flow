
import React, { useState } from 'react';
import { Control, useFormContext } from "react-hook-form";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon, Upload } from "lucide-react";

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ProductConfig } from "@/config/productTypes";
import { PrintSpecificationSelector } from "@/components/shared/PrintSpecificationSelector";

interface GenericJobFormFieldsProps {
  config: ProductConfig;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEdit?: boolean;
  onSpecificationChange?: (category: string, specificationId: string, specification: any) => void;
}

export const GenericJobFormFields: React.FC<GenericJobFormFieldsProps> = ({
  config,
  selectedFile,
  setSelectedFile,
  handleFileChange,
  isEdit = false,
  onSpecificationChange
}) => {
  const { control } = useFormContext();
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, any>>({});

  const handleSpecificationChange = (category: string, specificationId: string, specification: any) => {
    setSelectedSpecs(prev => ({
      ...prev,
      [category]: {
        id: specificationId,
        ...specification
      }
    }));
    
    // Notify parent component
    onSpecificationChange?.(category, specificationId, specification);
  };

  return (
    <div className="space-y-6">
      {/* Basic Job Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter client name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="job_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter job number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min="1" 
                  placeholder="Enter quantity"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="due_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Due Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Dynamic Print Specifications */}
      <PrintSpecificationSelector
        productType={config.productType.toLowerCase()}
        onSpecificationChange={handleSpecificationChange}
        selectedSpecifications={{}}
        disabled={false}
      />

      {/* File Upload */}
      <FormField
        control={control}
        name="file"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              PDF File
              {!isEdit && <span className="text-red-500 ml-1">*</span>}
            </FormLabel>
            <FormControl>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <div className="text-sm text-gray-600">
                    {selectedFile ? (
                      <div>
                        <p className="font-medium text-green-600">{selectedFile.name}</p>
                        <p className="text-xs">Click to change file</p>
                      </div>
                    ) : (
                      <div>
                        <p>Click to upload PDF file</p>
                        <p className="text-xs">Maximum file size: 10MB</p>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
