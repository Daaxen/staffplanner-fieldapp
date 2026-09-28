# Filer och dokument på en arbetsorder

## Läget idag
- Dokument hanteras i modulen **Documents & Guides** (menyn). Där väljer man syfte "Order document" och kopplar till en order — men det finns bara ett **länkfält**, ingen möjlighet att ladda upp en riktig fil.
- Det finns ingen filyt eller uppladdning i orderdetaljvyn (Planning → öppna order).
- Ingen lagringsyta ("documents") finns ännu i molnlagringen.

## Vad som byggs

### 1. Ny lagringsyta i molnet: `documents` (privat bucket)
- Mappstruktur per dokument-id; bara inloggade får ladda ner via signerade kortlivade länkar (samma mönster som befintliga foton).
- Läsbehörighet följer befintliga dokumentregler: orderdokument syns för tilldelade montörer, känsliga orderdokument bara för beviljade personer, etc.

### 2. Uppladdning av riktiga filer
- Ny kolumn `storage_path` på dokument-tabellen (url behålls för länkar/video).
- I **Documents & Guides → Add/Edit document** kan man välja mellan att klistra in en länk eller **ladda upp en fil** (pdf, bild, word, excel, video; max 25 MB). Filens namn sätter filtypen automatiskt.

### 3. Direkt på arbetsordern i Planning
- Nytt avsnitt **"Files & docs"** i orderdetaljpanelen (samma panel som Edit work order / Cancel):
  - Lista över orderns dokument (namn, typ, syfte) med knapp för att öppna/ladda ner.
  - **"Upload file"** som skapar ett nytt orderdokument direkt (syfte förvaltas till den här ordern, döljs för kännare av "Commercially sensitive"-regeln).
  - Administratör kan även ta bort ett dokument härifrån.
- Orderdokument länkas också från **Orders/Projects → Work orders** via detaljpanelen — alltså samma ställe som redan används för att redigera.

### 4. Montörerna ser orderns filer i mobilappen
- På ordern i montörappen visas filerna som hör till ordern, inklusive känsliga bara om de har beviljad åtkomst (befintliga regler gäller oförändrade).
- Filerna öppnas i ny flik via signerad länk.

## Tekniskt (kort)
- Migrering: ny kolumn `storage_path text` på `public.documents` + ny privat bucket `documents` med policyer: authenticated kan läsa sina tillåtna sökvägar, admin kan ladda upp; uppladdning kräver inloggning.
- `useDocuments` utökas med `uploadDoc()` (sparar fil i bucket + rad i tabellen) och signerad-URL-hjälpfunktion.
- Ny komponent `OrderDocumentsSection` används i `ProjectDetailPanel` och återanvänds av DocumentsManager-dialogen (delad uppladdningslogik).
- Montörappen: filtrera befintliga `useDocuments`-dokument på `projectId === aktuell order` på ordersidan (befintliga RLS-regler gör jobbet).
- Typkontroll + tester; e2e-verifiering i preview (ladda upp, öppna, känslig åtkomst).

## Urval av begränsningar
- Endast admin/HR kan ladda upp och ta bort orderdokument; montörer kan bara läsa de som reglerna tillåter.
- Ingen filversionering: uppladdad fil ersätts bara genom att ta bort och ladda upp ny.
