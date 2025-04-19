import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { laminationOptions, laminationLabels, paperTypeOptions } from "../schema/postcardJobFormSchema";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface PostcardJobFormFieldsProps {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEdit?: boolean;
}

export const PostcardJobFormFields = ({ 
  selectedFile, 
  setSelectedFile, 
  handleFileChange,
  isEdit = false
}: PostcardJobFormFieldsProps) => {
  const { control, watch } = useFormContext();
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileRemove = () => {
    setSelectedFile(null);
    setFileError(null);
  };

  return (
    <>
      {/* Job details section */}
      <div>
        <h3 className="text-lg font-medium mb-4">Job Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client*</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                <FormLabel>Job Number*</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Print specifications section */}
      <div>
        <h3 className="text-lg font-medium mb-4">Print Specifications</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="size"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Size*</FormLabel>
                <FormControl>
                  <Input value="A6" disabled {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={control}
            name="paper_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paper Type*</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select paper type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {paperTypeOptions.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="double_sided"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between space-y-0">
                <FormLabel>Double Sided</FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="mt-4">
          <FormField
            control={control}
            name="lamination_type"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Lamination Options*</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex flex-col space-y-1"
                  >
                    {laminationOptions.map(option => (
                      <FormItem key={option} className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value={option} />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {laminationLabels[option]}
                        </FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Quantity and due date section */}
      <div>
        <h3 className="text-lg font-medium mb-4">Quantity and Due Date</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity*</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
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
                <FormLabel>Due Date*</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Select a date</span>
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
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* File upload section */}
      <div>
        <h3 className="text-lg font-medium mb-4">PDF Upload</h3>
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
          <input
            type="file"
            id="file-upload"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          
          {selectedFile ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
                <span className="text-lg font-medium">{selectedFile.name}</span>
              </div>
              <p className="text-sm text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleFileRemove}
              >
                Remove
              </Button>
            </div>
          ) : (
            <>
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              <p className="mt-2 text-sm text-gray-600">
                {isEdit ? "Upload a new PDF to replace the current one (optional)" : "Upload a PDF file of your postcard design"}
              </p>
              <p className="mt-1 text-xs text-gray-500">PDF up to 10MB</p>
              
              <Button 
                type="button" 
                variant="outline" 
                className="mt-2"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                Select PDF
              </Button>
              
              {fileError && (
                <p className="mt-2 text-sm text-red-600">{fileError}</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};
