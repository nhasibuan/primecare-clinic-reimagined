import * as React from "react";
import { GripVerticalIcon } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

type Orientation = "horizontal" | "vertical";

/**
 * react-resizable-panels v4 wrapper.
 *
 * The v3 `direction` prop is accepted as a deprecated alias and mapped to
 * v4's `orientation`, so older call sites keep working. The wrapper mirrors
 * the resolved orientation onto `data-orientation` (the library no longer
 * exposes `data-panel-group-direction`), which the handle's group variants
 * below key off of.
 */
function ResizablePanelGroup({
  className,
  direction,
  orientation,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Group> & {
  /** Deprecated v3 alias for `orientation`. */
  direction?: Orientation;
}) {
  const resolved = (orientation ?? direction ?? "horizontal") as Orientation;
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      data-orientation={resolved}
      orientation={resolved}
      className={cn(
        "group/resizable flex h-full w-full data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  );
}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden group-data-[orientation=vertical]/resizable:h-px group-data-[orientation=vertical]/resizable:w-full group-data-[orientation=vertical]/resizable:after:left-0 group-data-[orientation=vertical]/resizable:after:h-1 group-data-[orientation=vertical]/resizable:after:w-full group-data-[orientation=vertical]/resizable:after:translate-x-0 group-data-[orientation=vertical]/resizable:after:-translate-y-1/2",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
