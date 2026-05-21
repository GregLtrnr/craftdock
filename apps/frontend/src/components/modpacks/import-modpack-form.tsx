"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileArchive, X } from "lucide-react";
import { apiUpload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Server } from "@/lib/api";
import { MAX_MODPACK_UPLOAD_BYTES } from "@craftdock/shared";

const ACCEPT = ".zip,.mrpack";
const MAX_GB = MAX_MODPACK_UPLOAD_BYTES / 1024 / 1024 / 1024;

export function ImportModpackForm({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState("");
  const [ramMb, setRamMb] = useState(4096);
  const [port, setPort] = useState(25566 + Math.floor(Math.random() * 100));
  const [minecraftVersion, setMinecraftVersion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pickFile = (f: File | null) => {
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".zip") && !lower.endsWith(".mrpack")) {
      setError("Use a .zip or .mrpack file (CurseForge “Download server pack”).");
      return;
    }
    if (f.size > MAX_MODPACK_UPLOAD_BYTES) {
      setError(`File must be under ${MAX_GB} GB.`);
      return;
    }
    setFile(f);
    setError("");
    if (!name) {
      const base = f.name.replace(/\.(zip|mrpack)$/i, "");
      setName(`${base} Server`);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    pickFile(f ?? null);
  }, [name]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Drop or select a modpack archive.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());
      fd.append("ramMb", String(ramMb));
      fd.append("port", String(port));
      if (minecraftVersion.trim()) {
        fd.append("minecraftVersion", minecraftVersion.trim());
      }
      fd.append("runtimeMode", "NATIVE");

      const { server } = await apiUpload<{ server: Server }>("/api/modpacks/import", fd);
      router.push(`/servers/${server.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Import modpack</h2>
          <p className="mt-1 text-sm text-muted">
            Upload a <strong className="text-foreground">server pack .zip</strong> from CurseForge
            (“Download server pack”) or a Modrinth <strong className="text-foreground">.mrpack</strong>.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-card-hover hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 transition-colors",
            dragOver
              ? "border-primary bg-primary-muted"
              : file
                ? "border-primary/50 bg-primary-muted/50"
                : "border-border bg-background-subtle/80"
          )}
        >
          {file ? (
            <>
              <FileArchive className="h-10 w-10 text-primary" />
              <p className="mt-3 font-medium">{file.name}</p>
              <p className="text-sm text-muted">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => setFile(null)}
              >
                Remove file
              </Button>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted" />
              <p className="mt-3 text-sm font-medium">Drag & drop your modpack here</p>
              <p className="mt-1 text-xs text-muted">or click to browse (.zip, .mrpack, max {MAX_GB} GB)</p>
              <label className="mt-4 cursor-pointer">
                <span className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-card-hover">
                  Choose file
                </span>
                <input
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Server name
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              RAM — {Math.floor(ramMb / 1024)} Go
            </label>
            <input
              type="range"
              min={512}
              max={10 * 1024}
              step={256}
              value={ramMb}
              onChange={(e) => setRamMb(parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Port
            </label>
            <Input
              type="number"
              min={1024}
              max={65535}
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value, 10))}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Minecraft version (optional)
            </label>
            <Input
              placeholder="Auto-detect from manifest.json if empty (e.g. 1.20.1)"
              value={minecraftVersion}
              onChange={(e) => setMinecraftVersion(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-danger-muted px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading || !file} className="gap-2">
            <Upload className="h-4 w-4" />
            {loading ? "Installing…" : "Create server from pack"}
          </Button>
          {onClose && (
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
