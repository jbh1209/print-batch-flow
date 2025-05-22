
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
import { Switch } from "@/components/ui/switch";

interface SleeveJobFormFieldsProps {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEdit?: boolean;
}

export const SleeveJobFormFields = ({
  selectedFile,
  setSelectedFile,
  handleFileChange,
  isEdit = false
}: SleeveJobFormFieldsProps) => {
  const { control, formState } = useFormContext();

  return (
    <div className="space-y-6">
      {/* Basic Job Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client Name*</FormLabel>
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
                <Input placeholder="e.g. SL-12345" {...field} />
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

      {/* Sleeve Specific Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="stock_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stock Type*</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select stock type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="White">White</SelectItem>
                  <SelectItem value="Kraft">Kraft</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="single_sided"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Single Sided</FormLabel>
              </div>
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
