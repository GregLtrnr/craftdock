"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { ModpackSearchResult, ModpackSource, ModpackVersion } from "@craftdock/shared";

export default function ModpacksPage() {
  const [source, setSource] = useState<ModpackSource>("modrinth");
  const [cfAvailable, setCfAvailable] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ModpackSearchResult[]>([]);
  const [selected, setSelected] = useState<ModpackSearchResult | null>(null);
  const [files, setFiles] = useState<ModpackVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<{ modrinth: { available: boolean }; curseforge: { available: boolean; configured: boolean } }>(
        "/api/modpacks/status"
      )
      .then((s) => setCfAvailable(s.curseforge.available))
      .catch(() => setCfAvailable(false));
  }, []);

  const search = async () => {
    setLoading(true);
    setError("");
    setSelected(null);
    setFiles([]);
    try {
      const { results: r } = await api.get<{ results: ModpackSearchResult[] }>(
        `/api/modpacks/search?query=${encodeURIComponent(query)}&source=${source}`
      );
      setResults(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const selectModpack = async (mod: ModpackSearchResult) => {
    setSelected(mod);
    setError("");

    if (mod.versions?.length) {
      setFiles(mod.versions);
      return;
    }

    setFiles([]);
    setFilesLoading(true);
    try {
      const { files: f } = await api.get<{ files: ModpackVersion[] }>(
        `/api/modpacks/${encodeURIComponent(mod.id)}/versions?source=${mod.source}&slug=${encodeURIComponent(mod.slug)}`
      );
      setFiles(f);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFilesLoading(false);
    }
  };

  const install = async (versionId: string) => {
    if (!selected) return;
    const port = 25566 + Math.floor(Math.random() * 100);
    await api.post("/api/modpacks/install", {
      source: selected.source,
      projectId: selected.id,
      versionId,
      slug: selected.slug,
      name: `${selected.name} Server`,
      ramMb: 4096,
      port,
      runtimeMode: "NATIVE",
    });
    alert("Modpack server created! Check dashboard.");
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Hosting</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Modpacks</h1>
        <p className="mt-2 max-w-xl text-muted">
          Modrinth by default — no API key. CurseForge is optional if your key still works.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={source === "modrinth" ? "default" : "secondary"}
          size="sm"
          onClick={() => setSource("modrinth")}
        >
          Modrinth
        </Button>
        <Button
          variant={source === "curseforge" ? "default" : "secondary"}
          size="sm"
          onClick={() => setSource("curseforge")}
          disabled={!cfAvailable}
          title={cfAvailable ? undefined : "CurseForge API unavailable — check CURSEFORGE_API_KEY"}
        >
          CurseForge
        </Button>
      </div>

      {!cfAvailable && source === "curseforge" && (
        <p className="mt-2 text-sm text-muted">
          CurseForge API blocked or key missing. Use Modrinth or regenerate a key at console.curseforge.com.
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <Input
          placeholder="Search modpacks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <Button onClick={search} disabled={loading}>
          Search
        </Button>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {results.map((mod) => (
            <div
              key={`${mod.source}-${mod.id}`}
              role="button"
              tabIndex={0}
              className="cursor-pointer"
              onClick={() => selectModpack(mod)}
              onKeyDown={(e) => e.key === "Enter" && selectModpack(mod)}
            >
              <Card className="p-4 hover:border-primary/40">
                <h3 className="font-medium">{mod.name}</h3>
                <p className="text-xs text-muted line-clamp-2">{mod.summary}</p>
                <p className="mt-1 text-xs text-muted">
                  {mod.downloadCount.toLocaleString()} downloads
                  {mod.versions?.length ? ` · ${mod.versions.length} version(s)` : ""}
                </p>
              </Card>
            </div>
          ))}
        </div>

        {selected && (
          <Card>
            <h3 className="font-semibold">{selected.name} — Versions</h3>
            {filesLoading && <p className="mt-4 text-sm text-muted">Loading versions…</p>}
            {!filesLoading && files.length === 0 && !error && (
              <p className="mt-4 text-sm text-muted">No versions found.</p>
            )}
            <ul className="mt-4 space-y-2">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between text-sm">
                  <span>
                    {f.name} ({f.gameVersion})
                  </span>
                  <Button size="sm" onClick={() => install(f.id)}>
                    Install
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
