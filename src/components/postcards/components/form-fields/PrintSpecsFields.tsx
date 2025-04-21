
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const paperTypeOptions = ["350gsm Matt", "350gsm Gloss"];
const sideOptions = ["single", "double"];
const laminateOptions = [
  { value: "gloss", label: "Front Gloss Laminate" },
  { value: "matt", label: "Front Matt Laminate" },
  { value: "none", label: "None" }
];

export const PrintSpecsFields = () => {
  const { control } = useFormContext();

  return (
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
        name="sides"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Sides*</FormLabel>
            <RadioGroup
              onValueChange={field.onChange}
              defaultValue={field.value}
              className="flex flex-row space-x-4"
            >
              <FormItem className="flex items-center">
                <FormControl>
                  <RadioGroupItem value="single" />
                </FormControl>
                <FormLabel className="ml-2 font-normal">Single Sided</FormLabel>
              </FormItem>
              <FormItem className="flex items-center">
                <FormControl>
                  <RadioGroupItem value="double" />
                </FormControl>
                <FormLabel className="ml-2 font-normal">Double Sided</FormLabel>
              </FormItem>
            </RadioGroup>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="lamination_type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Lamination*</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select lamination type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {laminateOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
