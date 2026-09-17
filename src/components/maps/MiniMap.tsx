import { ExternalLink, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MiniMapProps {
  address: string;
  lat?: number;
  lng?: number;
  height?: number;
  className?: string;
  showLink?: boolean;
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;

export const googleMapsLink = (address: string, lat?: number, lng?: number) =>
  lat != null && lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const MiniMap = ({ address, lat, lng, height = 140, className, showLink = true }: MiniMapProps) => {
  const trimmed = address?.trim();
  if (!trimmed) return null;

  const embedUrl = BROWSER_KEY
    ? lat != null && lng != null
      ? `https://www.google.com/maps/embed/v1/view?key=${BROWSER_KEY}&center=${lat},${lng}&zoom=15`
      : `https://www.google.com/maps/embed/v1/place?key=${BROWSER_KEY}&q=${encodeURIComponent(trimmed)}&zoom=15`
    : null;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        className="rounded-md border border-border overflow-hidden bg-muted/30"
        style={{ height }}
      >
        {embedUrl ? (
          <iframe
            title={`Map of ${trimmed}`}
            src={embedUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full border-0"
            allowFullScreen={false}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <MapPin className="h-5 w-5 text-primary" />
            <span className="text-xs">{trimmed}</span>
          </div>
        )}
      </div>
      {showLink && (
        <a
          href={googleMapsLink(trimmed, lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Open in Google Maps
        </a>
      )}
    </div>
  );
};

export default MiniMap;
