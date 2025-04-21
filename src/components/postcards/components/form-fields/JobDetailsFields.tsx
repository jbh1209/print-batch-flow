
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export const JobDetailsFields = () => {
  const { control } = useFormContext();

  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Client Name*</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Enter client name" />
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
              <Input {...field} placeholder="Enter job number" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
