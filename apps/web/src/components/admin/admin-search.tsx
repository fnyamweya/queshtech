import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import {
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { axisNavToSearchLinks } from './nav.config'

export function AdminSearch() {
  const [, setLocation] = useLocation()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  const links = useMemo(() => axisNavToSearchLinks(), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      setOpen(true)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const filteredLinks = useMemo(() => {
    if (!value) return links
    const term = value.toLowerCase()
    return links.filter((link) => link.label.toLowerCase().includes(term) || link.description?.toLowerCase().includes(term))
  }, [links, value])

  return (
    <>
      <Button
        variant="outline"
        className="bg-muted/25 group text-muted-foreground hover:bg-accent relative h-10 w-full sm:w-64 md:w-72 lg:w-96 flex-1 justify-start rounded-md text-sm font-normal shadow-none"
        onClick={() => setOpen(true)}
        aria-label="Open admin search"
      >
        <Search aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
        <span className="pl-8 truncate">Search orders, customers, inventory...</span>
        <kbd className="bg-muted group-hover:bg-accent pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search admin..."
          value={value}
          onValueChange={setValue}
        />
        <CommandList>
          <CommandEmpty>No matches found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {filteredLinks.map((link) => (
              <CommandItem
                key={link.href}
                value={link.label}
                className="flex items-center gap-3"
                onSelect={() => {
                  setOpen(false)
                  setValue('')
                  setLocation(link.href)
                }}
              >
                <link.icon className="h-4 w-4" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium leading-tight">{link.label}</p>
                  {link.description && (
                    <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
