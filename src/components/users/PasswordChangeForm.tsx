
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
import { PasswordChangeData } from "@/services/passwordService";

interface PasswordChangeFormProps {
  onSubmit: (data: PasswordChangeData) => void;
  isCurrentUser?: boolean;
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password")
}).refine((data) => data.newPassword === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});

const adminResetSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm the password")
}).refine((data) => data.newPassword === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});

export function PasswordChangeForm({ onSubmit, isCurrentUser = true }: PasswordChangeFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  
  const formSchema = isCurrentUser ? passwordSchema : adminResetSchema;
  
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: isCurrentUser ? {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    } : {
      newPassword: "",
      confirmPassword: ""
    }
  });

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    setServerError("");
    
    try {
      await onSubmit(data);
      form.reset();
    } catch (error: any) {
      setServerError(error.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <p className="text-sm">{serverError}</p>
          </div>
        )}

        {isCurrentUser && (
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Enter current password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter new password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm New Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Confirm new password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : isCurrentUser ? "Change Password" : "Reset Password"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
