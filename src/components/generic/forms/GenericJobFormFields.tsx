
import React from "react";
import { useFormContext } from "react-hook-form";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Upload } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ProductConfig } from "@/config/productTypes";

interface GenericJobFormFieldsProps {
  config: ProductConfig;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEdit?: boolean;
}

export const GenericJobFormFields = ({
  config,
  selectedFile,
  setSelectedFile,
  handleFileChange,
  isEdit = false
}: GenericJobFormFieldsProps) => {
  const { control, formState } = useFormContext();

  // Helper function to get lamination type display name
  const getLaminationDisplayName = (type: string) => {
    switch (type) {
      case "none": return "None";
      case "matt": return "Matt";
      case "gloss": return "Gloss";
      case "soft_touch": return "Soft Touch";
      case "front_gloss_lam": return "Front Gloss Lamination";
      case "front_matt_lam": return "Front Matt Lamination";
      case "no_lam": return "No Lamination";
      default: return type;
    }
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
              <FormLabel>Client*</FormLabel>
              <FormControl>
                <Input placeholder="e.g. John Smith" {...field} />
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
                <Input placeholder="e.g. JOB-12345" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Quantity and Due Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity*</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min={1} 
                  placeholder="e.g. 100"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || '')}
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
            <FormItem>
              <FormLabel>Due Date*</FormLabel>
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

      {/* Product Specific Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Size Selection - for products with sizes */}
        {config.availableSizes && (
          <FormField
            control={control}
            name="size"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Size*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {config.availableSizes.map((size) => (
                      <SelectItem key={size} value={size}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Paper Type Selection */}
        {config.availablePaperTypes && (
          <FormField
            control={control}
            name="paper_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paper Type*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select paper type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {config.availablePaperTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Paper Weight Selection */}
        {config.availablePaperWeights && (
          <FormField
            control={control}
            name="paper_weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paper Weight*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select paper weight" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {config.availablePaperWeights.map((weight) => (
                      <SelectItem key={weight} value={weight}>{weight}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Lamination Type Selection */}
        {config.availableLaminationTypes && (
          <FormField
            control={control}
            name="lamination_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lamination Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select lamination type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {config.availableLaminationTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {getLaminationDisplayName(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* UV Varnish Selection - for covers */}
        {config.availableUVVarnishTypes && (
          <FormField
            control={control}
            name="uv_varnish"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UV Varnish</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "none"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select UV varnish type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {config.availableUVVarnishTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type === "none" ? "None" : 
                         type === "gloss" ? "Gloss" : type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Sides Selection - for products with sides */}
        {config.availableSidesTypes && (
          <FormField
            control={control}
            name="sides"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sides*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sides" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {config.availableSidesTypes.map((side) => (
                      <SelectItem key={side} value={side}>
                        {side === "single" ? "Single Sided" : "Double Sided"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      {/* File Upload */}
      <div className="space-y-2">
        <FormLabel>PDF File{isEdit ? '' : '*'}</FormLabel>
        <div className="border rounded-md p-4">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept="application/pdf"
            onChange={handleFileChange}
          />
          {selectedFile ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selectedFile.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(selectedFile.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setSelectedFile(null)}
                  >
                    Change
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <label 
              htmlFor="file-upload" 
              className="flex flex-col items-center justify-center h-32 border border-dashed rounded-md cursor-pointer hover:bg-gray-50"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="mb-2 h-10 w-10 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">Drag and drop your PDF file here, or click to browse</p>
                <p className="text-xs text-gray-500">PDF only, max 10MB</p>
              </div>
            </label>
          )}
          {formState.errors.file && (
            <p className="text-sm font-medium text-destructive mt-2">
              {formState.errors.file.message?.toString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
