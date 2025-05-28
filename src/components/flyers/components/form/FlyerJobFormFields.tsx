
import { useFormContext } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, Upload } from "lucide-react";
import { 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  flyerSizeOptions, 
  flyerPaperTypeOptions, 
  flyerPaperWeightOptions 
} from "../../schema/flyerJobSchema";

interface FlyerJobFormFieldsProps {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEdit?: boolean;
}

export const FlyerJobFormFields = ({ 
  selectedFile, 
  setSelectedFile, 
  handleFileChange,
  isEdit = false 
}: FlyerJobFormFieldsProps) => {
  const { control, formState } = useFormContext();

  return (
    <div className="space-y-6">
      {/* Client and Job Number */}
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

      {/* Flyer Specifications - ONLY flyer fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  {flyerSizeOptions.map((size) => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select paper type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {flyerPaperTypeOptions.map((type) => (
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
                  {flyerPaperWeightOptions.map((weight) => (
                    <SelectItem key={weight} value={weight}>{weight}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : "Select a date"}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={(date) => field.onChange(date || new Date())}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
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
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setSelectedFile(null)}
                >
                  Change
                </Button>
              </div>
            </div>
          ) : (
            <label 
              htmlFor="file-upload" 
              className="flex flex-col items-center justify-center h-32 border border-dashed rounded-md cursor-pointer hover:bg-gray-50"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="mb-2 h-10 w-10 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">
                  {isEdit 
                    ? "Upload a new PDF file to replace the current one (Optional)" 
                    : "Drag and drop your PDF file here, or click to browse"}
                </p>
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
