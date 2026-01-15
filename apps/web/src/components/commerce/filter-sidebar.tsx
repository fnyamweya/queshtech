import { useState } from 'react'
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
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Filters</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-8 text-xs"
          >
            Clear All
          </Button>
        )}
      </div>

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
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 hover:text-foreground transition-colors">
              <span className="text-sm font-medium">{group.label}</span>
              <CaretDown
                size={16}
                className={cn(
                  'transition-transform',
                  expandedGroups.includes(group.id) && 'rotate-180'
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 pt-3 pb-2">
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
