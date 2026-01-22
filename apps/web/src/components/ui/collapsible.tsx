import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { ComponentProps, ComponentPropsWithoutRef, ElementRef, forwardRef } from "react"

function Collapsible({
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

const CollapsibleTrigger = forwardRef<
  ElementRef<typeof CollapsiblePrimitive.CollapsibleTrigger>,
  ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleTrigger>
>((props, ref) => {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      ref={ref}
      {...props}
    />
  )
})

CollapsibleTrigger.displayName = "CollapsibleTrigger"

function CollapsibleContent({
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
