
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
          error: "error-toast-with-unique-identifier",
          success: "success-toast-with-unique-identifier",
          warning: "warning-toast-with-unique-identifier",
          info: "info-toast-with-unique-identifier",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
