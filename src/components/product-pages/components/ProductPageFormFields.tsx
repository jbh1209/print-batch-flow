import { useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FieldDefinition, 
  ProductPageTemplate 
} from "../types/ProductPageTypes";
import { FileUploadField } from "@/components/flyers/components/form-fields/FileUploadField";

interface ProductPageFormFieldsProps {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEdit: boolean;
  templates: ProductPageTemplate[];
  selectedTemplateId: string | null;
  onTemplateChange: (templateId: string) => void;
}

export function ProductPageFormFields({
  selectedFile,
  setSelectedFile,
  handleFileChange,
  isEdit,
  templates,
  selectedTemplateId,
  onTemplateChange
}: ProductPageFormFieldsProps) {
  const { control, formState, setValue, watch } = useFormContext();

  // Get the currently selected template
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  // Render custom fields based on the selected template
  const renderCustomField = (field: FieldDefinition) => {
    return (
      <FormField
        key={field.id}
        control={control}
        name={`custom_fields.${field.name}`}
        render={({ field: formField }) => (
          <FormItem>
            <FormLabel>{field.label}{field.required ? ' *' : ''}</FormLabel>
            <FormControl>
              {renderFieldInput(field, formField)}
            </FormControl>
            {field.description && (
              <FormDescription>{field.description}</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  // Render the appropriate input for each field type
  const renderFieldInput = (fieldDef: FieldDefinition, formField: any) => {
    switch (fieldDef.type) {
      case 'text':
        return (
          <Input
            {...formField}
            placeholder={fieldDef.placeholder || ''}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...formField}
            placeholder={fieldDef.placeholder || ''}
            rows={4}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            {...formField}
            onChange={(e) => formField.onChange(parseFloat(e.target.value))}
            min={fieldDef.min}
            max={fieldDef.max}
            placeholder={fieldDef.placeholder || ''}
          />
        );

      case 'select':
        return (
          <Select
            value={formField.value || ''}
            onValueChange={formField.onChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select option" />
            </SelectTrigger>
            <SelectContent>
              {fieldDef.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full pl-3 text-left font-normal",
                    !formField.value && "text-muted-foreground"
                  )}
                >
                  {formField.value ? (
                    format(new Date(formField.value), "PPP")
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
                selected={formField.value ? new Date(formField.value) : undefined}
                onSelect={formField.onChange}
                disabled={(date) => date < new Date("1900-01-01")}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case 'checkbox':
        return (
          <Checkbox
            checked={formField.value || false}
            onCheckedChange={formField.onChange}
          />
        );

      default:
        return <Input {...formField} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Job Name */}
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job Name *</FormLabel>
              <FormControl>
                <Input placeholder="Enter job name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Job Number */}
        <FormField
          control={control}
          name="job_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job Number *</FormLabel>
              <FormControl>
                <Input placeholder="Enter job number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      {/* Template Selection */}
      <FormField
        control={control}
        name="template_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Page Template *</FormLabel>
            <Select
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                onTemplateChange(value);
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              This will determine the input fields below
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quantity */}
        <FormField
          control={control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity *</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min={1} 
                  placeholder="Enter quantity" 
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Due Date */}
        <FormField
          control={control}
          name="due_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Due Date *</FormLabel>
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
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* PDF Upload */}
      {!isEdit && (
        <FileUploadField
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          handleFileChange={handleFileChange}
          required={true}
        />
      )}

      {/* Conditional rendering of custom fields based on selected template */}
      {selectedTemplate && selectedTemplate.fields.length > 0 && (
        <>
          <div className="border-t border-gray-200 pt-6 mt-6">
            <h3 className="font-medium mb-4">Template Fields</h3>
            <div className="grid grid-cols-1 gap-6">
              {selectedTemplate.fields.map((field) => renderCustomField(field))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
