import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { CaretDown, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface FilterOption {
  id: string
  label: string
  count?: number
}

interface FilterGroup {
  id: string
  label: string
  options: FilterOption[]
}

interface FilterSidebarProps {
  filters: FilterGroup[]
  selectedFilters: Record<string, string[]>
  onFilterChange: (groupId: string, optionId: string, checked: boolean) => void
  priceRange: [number, number]
  onPriceChange: (range: [number, number]) => void
  onClearAll: () => void
  className?: string
}

export function FilterSidebar({
  filters,
  selectedFilters,
  onFilterChange,
  priceRange,
  onPriceChange,
  onClearAll,
  className,
}: FilterSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>(
    filters.map((f) => f.id)
  )

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    )
  }

  const hasActiveFilters =
    Object.values(selectedFilters).some((v) => v.length > 0) ||
    priceRange[0] > 0 ||
    priceRange[1] < 1000

  return (
    <div
      className={cn(
        'rounded-md border border-border/60 bg-background/70 backdrop-blur-xl p-4',
        'space-y-5',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">Filters</h3>
          <p className="text-xs text-muted-foreground">Refine products by price and attributes.</p>
        </div>
        {hasActiveFilters ? (
          <Button variant="outline" size="sm" onClick={onClearAll} className="h-8">
            <X size={14} weight="bold" className="mr-1" />
            Clear
          </Button>
        ) : null}
      </div>

      {hasActiveFilters ? (
        <div className="flex flex-wrap gap-2">
          {priceRange[0] > 0 || priceRange[1] < 1000 ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 text-xs cursor-pointer transition-[transform,box-shadow,background-color,color,border-color,opacity] active:translate-y-px active:scale-[0.99] hover:bg-muted"
              onClick={() => onPriceChange([0, 1000])}
              aria-label="Remove price range filter"
            >
              <span>Price: {priceRange[0]}–{priceRange[1]}</span>
              <X size={12} weight="bold" />
            </button>
          ) : null}

          {filters.flatMap((group) =>
            (selectedFilters[group.id] || []).map((optionId) => {
              const label = group.options.find((o) => o.id === optionId)?.label || optionId
              return (
                <button
                  key={`${group.id}:${optionId}`}
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 text-xs cursor-pointer transition-[transform,box-shadow,background-color,color,border-color,opacity] active:translate-y-px active:scale-[0.99] hover:bg-muted"
                  onClick={() => onFilterChange(group.id, optionId, false)}
                  aria-label={`Remove ${group.label} filter ${label}`}
                >
                  <span className="text-muted-foreground">{group.label}:</span>
                  <span className="font-medium">{label}</span>
                  <X size={12} weight="bold" />
                </button>
              )
            })
          )}
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium mb-4 block">
            Price Range
          </Label>
          <div className="px-2">
            <Slider
              value={priceRange}
              onValueChange={onPriceChange as (value: number[]) => void}
              max={1000}
              step={10}
              className="mb-4"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>${priceRange[0]}</span>
              <span>${priceRange[1]}</span>
            </div>
          </div>
        </div>

        <Separator />

        {filters.map((group) => (
          <Collapsible
            key={group.id}
            open={expandedGroups.includes(group.id)}
            onOpenChange={() => toggleGroup(group.id)}
          >
            <CollapsibleTrigger className="flex w-full cursor-pointer select-none items-center justify-between rounded-md px-2 py-2 hover:bg-muted transition-[background-color,color]">
              <span className="text-sm font-medium">
                {group.label}
                {selectedFilters[group.id]?.length ? (
                  <Badge variant="secondary" className="ml-2 px-2 py-0 text-[10px]">
                    {selectedFilters[group.id].length}
                  </Badge>
                ) : null}
              </span>
              <CaretDown
                size={16}
                className={cn(
                  'transition-transform',
                  expandedGroups.includes(group.id) && 'rotate-180'
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 pt-3 pb-2 px-2">
                {group.options.map((option) => {
                  const isChecked =
                    selectedFilters[group.id]?.includes(option.id) || false

                  return (
                    <div key={option.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`${group.id}-${option.id}`}
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          onFilterChange(
                            group.id,
                            option.id,
                            checked as boolean
                          )
                        }
                      />
                      <Label
                        htmlFor={`${group.id}-${option.id}`}
                        className="flex-1 text-sm cursor-pointer flex items-center justify-between"
                      >
                        <span>{option.label}</span>
                        {option.count !== undefined && (
                          <span className="text-muted-foreground">
                            ({option.count})
                          </span>
                        )}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  )
}
