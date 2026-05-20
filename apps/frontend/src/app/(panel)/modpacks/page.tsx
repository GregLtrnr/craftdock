"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface Modpack {
  id: number;
  name: string;
  slug: string;
  summary: string;
  downloadCount: number;
  logoUrl?: string;
}

export default function ModpacksPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Modpack[]>([]);
  const [selected, setSelected] = useState<Modpack | null>(null);
  const [files, setFiles] = useState<{ id: number; name: string; gameVersion: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async () => {
    setLoading(true);
    setError("");
    try {
      const { results: r } = await api.get<{ results: Modpack[] }>(
        `/api/modpacks/search?query=${encodeURIComponent(query)}`
      );
      setResults(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const selectModpack = async (mod: Modpack) => {
    setSelected(mod);
    setFiles([]);
    setFilesLoading(true);
    setError("");
    try {
      const { files: f } = await api.get<{
        files: { id: number; name: string; gameVersion: string }[];
      }>(`/api/modpacks/${mod.id}/files`);
      setFiles(f);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFilesLoading(false);
    }
  };

  const install = async (fileId: number, gameVersion: string) => {
    const port = 25566 + Math.floor(Math.random() * 100);
    await api.post("/api/modpacks/install", {
      modpackId: selected!.id,
      fileId,
      name: `${selected!.name} Server`,
      ramMb: 4096,
      port,
      runtimeMode: "NATIVE",
    });
    alert("Modpack server created! Check dashboard.");
  };

  return (
    <div>
      <h1 className="text-3xl font-bold">CurseForge Modpacks</h1>
      <p className="text-muted">Search and install modpacks in one click</p>

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
              key={mod.id}
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
                  <Button size="sm" onClick={() => install(f.id, f.gameVersion)}>
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
