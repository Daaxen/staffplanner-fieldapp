import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  loadPortalData,
  logPortalAccess,
  signPortalPhotos,
  type PortalData,
  type PortalProject,
} from '@/lib/portal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { CalendarDays, MapPin, Users, LogOut, ArrowLeft, ShieldCheck } from 'lucide-react';

const dateRange = (p: PortalProject) => {
  if (!p.startDate) return 'Not scheduled yet';
  const end = p.endDate && p.endDate !== p.startDate ? ` – ${p.endDate}` : '';
  const time = p.startTime ? ` · ${p.startTime.slice(0, 5)}${p.endTime ? `–${p.endTime.slice(0, 5)}` : ''}` : '';
  return `${p.startDate}${end}${time}`;
};

const statusLabel = (s: string) => s.replace(/-/g, ' ');

const CustomerPortal = () => {
  const { user, signOut } = useAuth();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    loadPortalData().then(d => {
      if (!alive) return;
      setData(d);
      setLoading(false);
      if (d.clientId) logPortalAccess('portal', 'open', d.clientId, { projects: d.projects.length });
    });
    return () => {
      alive = false;
    };
  }, []);

  const project = useMemo(
    () => data?.projects.find(p => p.id === openId) ?? null,
    [data, openId],
  );
  const reports = useMemo(
    () => (project ? (data?.reports ?? []).filter(r => r.projectId === project.id) : []),
    [data, project],
  );
  const deviations = useMemo(
    () => (project ? (data?.deviations ?? []).filter(d => d.projectId === project.id) : []),
    [data, project],
  );

  useEffect(() => {
    if (!project) return;
    const paths = [
      ...reports.flatMap(r => r.photoPaths),
      ...deviations.flatMap(d => d.photoPaths),
    ];
    signPortalPhotos(paths).then(setPhotoUrls);
    logPortalAccess('project', 'view', project.id, { name: project.name });
  }, [project, reports, deviations]);

  const filtered = (data?.projects ?? []).filter(p =>
    `${p.name} ${p.ref ?? ''} ${p.location ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!data?.clientId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <ShieldCheck className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">No customer access</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This account is not connected to a customer. Please contact your project manager.
        </p>
        <Button variant="outline" onClick={signOut}>Sign out</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer portal</p>
            <h1 className="text-lg font-semibold">{data.clientName ?? 'Your projects'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Read only</Badge>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 p-4">
        {!project && (
          <>
            <Input
              placeholder="Search your projects…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-sm"
            />
            {filtered.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">No projects to show yet.</p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map(p => (
                <Card
                  key={p.id}
                  className="cursor-pointer transition hover:shadow-md"
                  onClick={() => setOpenId(p.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Badge variant="outline" className="capitalize">{statusLabel(p.status)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> {dateRange(p)}
                    </p>
                    {(p.location || p.street) && (
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> {p.location ?? `${p.street}, ${p.postalCode ?? ''}`}
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {p.installers.length ? p.installers.join(', ') : 'Not assigned yet'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {project && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> All projects
            </Button>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{project.name}</CardTitle>
                  <Badge variant="outline" className="capitalize">{statusLabel(project.status)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm md:grid-cols-2">
                <p className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" /> {dateRange(project)}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {project.location ?? [project.street, project.postalCode, project.region].filter(Boolean).join(', ') || '—'}
                </p>
                <p className="flex items-center gap-2 md:col-span-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {project.installers.length ? project.installers.join(', ') : 'Not assigned yet'}
                </p>
                {project.description && (
                  <p className="md:col-span-2 text-muted-foreground">{project.description}</p>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="reports">
              <TabsList>
                <TabsTrigger value="reports">Reports & sign-offs</TabsTrigger>
                <TabsTrigger value="photos">Photos</TabsTrigger>
                <TabsTrigger value="deviations">Deviations ({deviations.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="reports" className="space-y-3">
                {reports.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No reports yet.</p>
                )}
                {reports.map(r => (
                  <Card key={r.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        {r.submittedAt ? `Report submitted ${new Date(r.submittedAt).toLocaleString()}` : 'Report in progress'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {r.reportText && <p className="whitespace-pre-wrap">{r.reportText}</p>}
                      <Separator />
                      <div>
                        <p className="mb-1 font-medium">Sign-offs</p>
                        {Array.isArray(r.signOffs) && r.signOffs.length > 0 ? (
                          <ul className="list-inside list-disc text-muted-foreground">
                            {(r.signOffs as Record<string, unknown>[]).map((s, i) => (
                              <li key={i}>
                                {String(s.label ?? s.role ?? 'Sign-off')}
                                {s.name ? ` — ${String(s.name)}` : ''}
                                {s.signedAt ? ` (${new Date(String(s.signedAt)).toLocaleString()})` : ''}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-muted-foreground">
                            {r.signature ? 'Signed on site' : 'Not signed yet'}
                          </p>
                        )}
                      </div>
                      {r.signature && (
                        <img src={r.signature} alt="Customer signature" className="h-20 rounded border bg-card p-1" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="photos">
                {(() => {
                  const paths = [...reports.flatMap(r => r.photoPaths), ...deviations.flatMap(d => d.photoPaths)];
                  if (paths.length === 0) {
                    return <p className="py-8 text-center text-sm text-muted-foreground">No photos yet.</p>;
                  }
                  return (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {paths.map(path => (
                        <a
                          key={path}
                          href={photoUrls[path]}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => logPortalAccess('photo', 'view', path)}
                          className="overflow-hidden rounded-lg border"
                        >
                          {photoUrls[path] ? (
                            <img src={photoUrls[path]} alt="Project photo" className="aspect-square w-full object-cover" />
                          ) : (
                            <div className="aspect-square w-full animate-pulse bg-muted" />
                          )}
                        </a>
                      ))}
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="deviations" className="space-y-3">
                {deviations.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No deviations reported.</p>
                )}
                {deviations.map(d => (
                  <Card key={d.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm capitalize">{d.category.replace(/-/g, ' ')}</CardTitle>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="capitalize">{d.severity}</Badge>
                          <Badge variant={d.status === 'resolved' ? 'secondary' : 'destructive'} className="capitalize">
                            {d.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p>{d.description}</p>
                      <p className="text-muted-foreground">
                        Reported {new Date(d.occurredAt).toLocaleString()}
                        {d.resolvedAt ? ` · resolved ${new Date(d.resolvedAt).toLocaleString()}` : ''}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <p className="pb-6 text-center text-xs text-muted-foreground">
          Signed in as {user?.email}. This portal is read-only and all activity is logged.
        </p>
      </main>
    </div>
  );
};

export default CustomerPortal;
