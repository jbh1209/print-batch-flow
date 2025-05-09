
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: "group toast border-b border-border bg-background text-foreground",
          description: "text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // Force unique class names to avoid duplicate toasts
          error: `error-toast-${Math.random().toString(36).substring(7)}`,
          success: `success-toast-${Math.random().toString(36).substring(7)}`,
          warning: `warning-toast-${Math.random().toString(36).substring(7)}`,
          info: `info-toast-${Math.random().toString(36).substring(7)}`,
        },
        id: (id) => `${id}-${Date.now()}`  // Add timestamp to make IDs unique
      }}
      {...props}
    />
  );
}

export { Toaster };
