import { useReleaseAnnouncements } from '@/hooks/useReleaseAnnouncements';
import { ReleaseAnnouncementModal } from './ReleaseAnnouncementModal';

export function ReleaseAnnouncementGate() {
  const {
    current,
    remaining,
    acknowledging,
    acknowledgeError,
    acknowledge,
    postpone,
  } = useReleaseAnnouncements();

  return (
    <ReleaseAnnouncementModal
      announcement={current}
      open={Boolean(current)}
      remaining={remaining}
      acknowledging={acknowledging}
      error={acknowledgeError}
      onAcknowledge={() => void acknowledge()}
      onPostpone={postpone}
    />
  );
}

export default ReleaseAnnouncementGate;
