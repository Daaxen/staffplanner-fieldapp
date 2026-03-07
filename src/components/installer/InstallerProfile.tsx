import { MapPin, Briefcase, Calendar } from 'lucide-react';
import { type Installer } from '@/data/mockData';

interface InstallerProfileProps {
  installer: Installer;
  projectCount: number;
}

const InstallerProfile = ({ installer, projectCount }: InstallerProfileProps) => {
  return (
    <div className="p-4 space-y-4">
      {/* Avatar & Name */}
      <div className="flex flex-col items-center py-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary mb-3">
          {installer.name.split(' ').map(n => n[0]).join('')}
        </div>
        <h2 className="text-lg font-bold text-foreground">{installer.name}</h2>
        <p className="text-sm text-muted-foreground">
          {installer.type === 'sub-vendor' ? 'Sub-vendor' : 'Internal Installer'}
        </p>
      </div>

      {/* Info Cards */}
      <div className="rounded-xl bg-card p-3 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Base Location</p>
            <p className="text-sm font-medium text-foreground">{installer.baseLocation}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Briefcase className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Active Projects</p>
            <p className="text-sm font-medium text-foreground">{projectCount}</p>
          </div>
        </div>
      </div>

      {/* Upcoming Absences */}
      {installer.absences.length > 0 && (
        <div className="rounded-xl bg-card p-3 shadow-sm">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Planned Absences</h3>
          {installer.absences.map(absence => (
            <div key={absence.id} className="flex items-center gap-2 py-1.5">
              <Calendar className="w-4 h-4 text-destructive/70" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {absence.type === 'vacation' ? '🏖️' : absence.type === 'sick' ? '🤒' : '📅'} {absence.label || absence.type}
                </p>
                <p className="text-xs text-muted-foreground">{absence.startDate} → {absence.endDate}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InstallerProfile;
