import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSettings, saveSettings, setGitLabToken, backupDatabase } from "../../api";
import { keys } from "../../lib/queryKeys";
import { errorMessage, unwrap } from "../../lib/errors";
import { PageHeader } from "../../components/PageHeader";
import { ErrorNote } from "../../components/ErrorNote";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { ThemeSettings } from "./ThemeSettings";

const APP_VERSION = "0.0.1";

export function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: keys.settings(),
    queryFn: async () => unwrap(await getSettings()),
  });

  const [gitlabUrl, setGitlabUrl] = useState("");
  const [intervalMin, setIntervalMin] = useState("5");
  const [token, setToken] = useState("");
  const [backupPath, setBackupPath] = useState("");

  useEffect(() => {
    if (settings.data) {
      setGitlabUrl(settings.data.gitlabUrl);
      setIntervalMin(String(Math.round(settings.data.syncIntervalSec / 60)));
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await saveSettings({
          gitlabUrl: gitlabUrl.trim(),
          syncIntervalSec: Math.max(1, Number(intervalMin) || 5) * 60,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings() }),
    meta: { successToast: "Einstellungen gespeichert", silentError: true },
  });

  // Token & Backup zeigen Erfolg/Fehler bereits inline → kein doppelter Toast.
  const saveToken = useMutation({
    mutationFn: async () => unwrap(await setGitLabToken(token)),
    onSuccess: () => setToken(""),
    meta: { silentError: true },
  });

  const backup = useMutation({
    mutationFn: async () => unwrap(await backupDatabase(backupPath.trim())),
    meta: { silentError: true },
  });

  return (
    <div>
      <PageHeader title="Settings" description="GitLab-Verbindung, Sync und Backup" />

      {settings.isError ? <ErrorNote error={settings.error} className="mb-3" /> : null}

      <ThemeSettings />

      <div className="mt-6 space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">GitLab</h2>
        <div>
          <Label htmlFor="s-url">GitLab URL</Label>
          <Input
            id="s-url"
            value={gitlabUrl}
            onChange={(e) => setGitlabUrl(e.target.value)}
            placeholder="https://gitlab.example.com"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Synchronisiert projektübergreifend alle Tickets, auf die dein Token Zugriff hat — keine
          Projekt-ID nötig.
        </p>
        <div>
          <Label htmlFor="s-interval">Sync-Intervall (Minuten)</Label>
          <Input
            id="s-interval"
            type="number"
            value={intervalMin}
            onChange={(e) => setIntervalMin(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Speichern
          </Button>
          {save.isSuccess ? (
            <span className="text-sm text-success-accent">Gespeichert</span>
          ) : null}
          {save.isError ? (
            <span className="text-sm text-danger-accent">
              {errorMessage(save.error)}
            </span>
          ) : null}
        </div>

        <Separator />

        <div>
          <Label htmlFor="s-token">GitLab Token</Label>
          <Input
            id="s-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="wird im OS-Keychain gespeichert"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={token === "" || saveToken.isPending}
            onClick={() => saveToken.mutate()}
          >
            Token speichern
          </Button>
          {saveToken.isSuccess ? (
            <span className="text-sm text-success-accent">Token gespeichert</span>
          ) : null}
          {saveToken.isError ? (
            <span className="text-sm text-danger-accent">
              {errorMessage(saveToken.error)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Datenbank</h2>
        <div>
          <Label htmlFor="s-backup">Backup-Pfad</Label>
          <Input
            id="s-backup"
            value={backupPath}
            onChange={(e) => setBackupPath(e.target.value)}
            placeholder="/pfad/zu/entries.backup.db"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={backupPath.trim() === "" || backup.isPending}
            onClick={() => backup.mutate()}
          >
            Datenbank sichern
          </Button>
          {backup.isSuccess ? (
            <span className="text-sm text-success-accent">Backup erstellt</span>
          ) : null}
          {backup.isError ? (
            <span className="text-sm text-danger-accent">
              {errorMessage(backup.error)}
            </span>
          ) : null}
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">entries v{APP_VERSION}</p>
    </div>
  );
}
