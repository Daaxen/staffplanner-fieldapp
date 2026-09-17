import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface PlaceSelection {
  address: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (place: PlaceSelection) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  inputClassName?: string;
}

interface Suggestion {
  placeId: string;
  text: string;
}

const newToken = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const cache = new Map<string, Suggestion[]>();

const AddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = 'Search address...',
  id,
  className,
  inputClassName,
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const sessionToken = useRef<string>(newToken());
  const requestId = useRef(0);
  const skipNext = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const cached = cache.get(query.toLowerCase());
    if (cached) {
      setSuggestions(cached);
      setOpen(cached.length > 0);
      return;
    }
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('maps-places', {
          body: { action: 'autocomplete', input: query, sessionToken: sessionToken.current },
        });
        if (error) throw error;
        const list: Suggestion[] = (data?.suggestions ?? [])
          .map((s: any) => ({
            placeId: s?.placePrediction?.placeId,
            text: s?.placePrediction?.text?.text,
          }))
          .filter((s: Suggestion) => s.placeId && s.text);
        cache.set(query.toLowerCase(), list);
        if (id === requestId.current) {
          setSuggestions(list);
          setOpen(list.length > 0);
        }
      } catch (err) {
        console.error('Address suggestions failed', err);
        if (id === requestId.current) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);

  const handlePick = async (s: Suggestion) => {
    skipNext.current = true;
    onChange(s.text);
    setOpen(false);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke('maps-places', {
        body: { action: 'details', placeId: s.placeId, sessionToken: sessionToken.current },
      });
      if (error) throw error;
      const address = data?.formattedAddress ?? s.text;
      skipNext.current = true;
      onChange(address);
      onSelect?.({
        address,
        lat: data?.location?.latitude,
        lng: data?.location?.longitude,
        placeId: s.placeId,
      });
    } catch (err) {
      console.error('Address details failed', err);
      onSelect?.({ address: s.text, placeId: s.placeId });
    } finally {
      sessionToken.current = newToken();
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className={cn('pl-8', inputClassName)}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      {loading && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-md">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => handlePick(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              {s.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
