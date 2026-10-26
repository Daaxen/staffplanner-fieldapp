import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  photoCount: number;
  minPhotos: number;
  onAddPhotos: () => void;
  onSkip: () => void;
}

/** Asks the installer to actively choose: add photos, or finish without them. */
const SkipPhotosDialog = ({ open, photoCount, minPhotos, onAddPhotos, onSkip }: Props) => (
  <AlertDialog open={open} onOpenChange={o => !o && onAddPhotos()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Inga foton tillagda</AlertDialogTitle>
        <AlertDialogDescription>
          Du har {photoCount} av {minPhotos} rekommenderade foton. Foton hjälper vid reklamationer och
          uppföljning. Vill du lägga till foton eller avsluta ändå? Valet sparas på ordern.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onAddPhotos}>Lägg till foton</AlertDialogCancel>
        <AlertDialogAction onClick={onSkip}>Avsluta utan foton</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default SkipPhotosDialog;
