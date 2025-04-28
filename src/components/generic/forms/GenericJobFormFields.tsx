
import { useFormContext } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { JobDetailsFields } from "@/components/flyers/components/form-fields/JobDetailsFields";
import { QuantityAndDateFields } from "@/components/flyers/components/form-fields/QuantityAndDateFields";
import { FileUploadField } from "@/components/flyers/components/form-fields/FileUploadField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  const { control } = useFormContext();

  return (
    <div className="space-y-6">
      {/* Common Fields */}
      <JobDetailsFields />
      <QuantityAndDateFields />

      {/* Product-specific Fields */}
      {config.productType === "Sleeves" && (
        <>
          {/* Stock Type Field */}
          <FormField
            control={control}
            name="stock_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock Type*</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
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

          {/* Single-sided Toggle */}
          <FormField
            control={control}
            name="single_sided"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Single Sided</FormLabel>
                  <FormMessage />
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
        </>
      )}

      {/* Size Field (for products that have sizes) */}
      {config.hasSize && (
        <FormField
          control={control}
          name="size"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Size*</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {config.availableSizes?.map((size) => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Paper Type Field (for products that have paper types) */}
      {config.hasPaperType && (
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
                  {config.availablePaperTypes?.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Paper Weight Field (for products that have paper weights) */}
      {config.hasPaperWeight && (
        <FormField
          control={control}
          name="paper_weight"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Paper Weight*</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select paper weight" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {config.availablePaperWeights?.map((weight) => (
                    <SelectItem key={weight} value={weight}>{weight}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Sides Field (for products that have sides) */}
      {config.hasSides && (
        <FormField
          control={control}
          name="sides"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sides*</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sides" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {config.availableSidesTypes?.map((side) => (
                    <SelectItem key={side} value={side}>{side === 'single' ? 'Single Side' : 'Double Side'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* File Upload Field */}
      <FileUploadField
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        handleFileChange={handleFileChange}
        isEdit={isEdit}
      />
    </div>
  );
};
