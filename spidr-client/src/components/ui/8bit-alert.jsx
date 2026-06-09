import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  Alert as ShadcnAlert,
  AlertDescription as ShadcnAlertDescription,
  AlertTitle as ShadcnAlertTitle,
} from "@/components/ui/alert";

export const alertVariants = cva("", {
  variants: {
    font: {
      normal: "",
      retro: "retro",
    },
    variant: {
      default: "bg-card text-card-foreground",
      destructive:
        "text-destructive bg-card [&>svg]:text-current",
    },
  },
  defaultVariants: {
    variant: "default",
    font: "retro",
  },
});

function Alert({ children, className, font = "retro", variant, pixelColor, ...props }) {
  // pixelColor lets callers override the corner/border pixel color (e.g. "#FF3333")
  const cornerStyle = pixelColor ? { backgroundColor: pixelColor } : undefined;
  const cornerCls = pixelColor ? "" : "bg-foreground dark:bg-ring";

  return (
    <div className="relative">
      <ShadcnAlert
        {...props}
        variant={variant}
        className={cn(
          "relative rounded-none border-none bg-background",
          font !== "normal" && "retro",
          className
        )}
      >
        {children}
      </ShadcnAlert>

      {/* Pixel-art border corners */}
      {[
        "absolute -top-1.5 w-1/2 left-1.5 h-1.5",
        "absolute -top-1.5 w-1/2 right-1.5 h-1.5",
        "absolute -bottom-1.5 w-1/2 left-1.5 h-1.5",
        "absolute -bottom-1.5 w-1/2 right-1.5 h-1.5",
        "absolute top-0 left-0 size-1.5",
        "absolute top-0 right-0 size-1.5",
        "absolute bottom-0 left-0 size-1.5",
        "absolute bottom-0 right-0 size-1.5",
        "absolute top-1.5 -left-1.5 h-1/2 w-1.5",
        "absolute bottom-1.5 -left-1.5 h-1/2 w-1.5",
        "absolute top-1.5 -right-1.5 h-1/2 w-1.5",
        "absolute bottom-1.5 -right-1.5 h-1/2 w-1.5",
      ].map((pos, i) => (
        <div key={i} className={cn(pos, cornerCls)} style={cornerStyle} />
      ))}
    </div>
  );
}

function AlertTitle({ className, ...props }) {
  return (
    <ShadcnAlertTitle
      className={cn("line-clamp-1 font-medium tracking-tight", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }) {
  return (
    <ShadcnAlertDescription
      className={cn(
        "text-muted-foreground grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
export default Alert;
