import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

export type SearchOption = { value: string; label: string; keywords?: string };

export const normalizeSearch = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/** True when every word typed appears in the option's label or keywords. */
export function matchesSearch(option: SearchOption, query: string) {
  const hay = normalizeSearch(`${option.label} ${option.keywords ?? ''}`);
  return normalizeSearch(query).split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}

const NONE = '__none';

export function SearchSelect({
  options, value, onChange, placeholder = 'Välj', emptyText = 'Ingen träff', noneLabel, disabled,
}: {
  options: SearchOption[]; value: string; onChange: (v: string) => void;
  placeholder?: string; emptyText?: string; noneLabel?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find(o => o.value === value);
  const shown = options.filter(o => matchesSearch(o, query));
  const pick = (v: string) => { onChange(v); setOpen(false); setQuery(''); };

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" disabled={disabled}
          className="w-full justify-between font-normal">
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected?.label ?? (noneLabel && !value ? noneLabel : placeholder)}
          </span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Skriv för att söka…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-64">
            {shown.length === 0 && <CommandEmpty>{emptyText}</CommandEmpty>}
            <CommandGroup>
              {noneLabel && !query && (
                <CommandItem value={NONE} onSelect={() => pick('')}>
                  <Check className={cn('w-4 h-4 mr-2', value ? 'opacity-0' : 'opacity-100')} />{noneLabel}
                </CommandItem>
              )}
              {shown.slice(0, 100).map(o => (
                <CommandItem key={o.value} value={o.value} onSelect={() => pick(o.value)}>
                  <Check className={cn('w-4 h-4 mr-2', o.value === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
