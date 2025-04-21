
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export const QuantityAndDateFields = () => {
  const { control } = useFormContext();

  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={control}
        name="quantity"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Quantity*</FormLabel>
            <FormControl>
              <Input type="number" min={1} placeholder="Enter quantity" {...field} />
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
            <FormControl>
              <Input type="date" {...field}
                value={field.value ? new Date(field.value).toISOString().substring(0, 10) : ""}
                onChange={e => field.onChange(new Date(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
