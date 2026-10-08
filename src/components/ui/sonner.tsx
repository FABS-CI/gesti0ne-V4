import { Toaster as Sonner, toast } from "sonner";

// Style unique : succès 4 s, erreurs visibles jusqu'à fermeture.
const baseError = toast.error;
if (!(baseError as { __patched?: boolean }).__patched) {
  const patched = ((message: Parameters<typeof baseError>[0], data?: Parameters<typeof baseError>[1]) =>
    baseError(message, { duration: Infinity, closeButton: true, ...data })) as typeof baseError & { __patched?: boolean };
  patched.__patched = true;
  toast.error = patched;
}

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      duration={4000}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-sm",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
