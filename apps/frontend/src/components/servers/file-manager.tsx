"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Folder, Save, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isEditableTextFile } from "@/lib/editable-files";

type FileEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
};

function parentPath(current: string): string {
  if (current === "." || current === "") return ".";
  const parts = current.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? parts.join("/") : ".";
}

export function FileManager({ serverId }: { serverId: string }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [path, setPath] = useState(".");
  const [loadingList, setLoadingList] = useState(false);

  const [openFile, setOpenFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState("");

  const loadDir = useCallback(() => {
    setLoadingList(true);
    api
      .get<{ files: FileEntry[] }>(
        `/api/${serverId}/files?path=${encodeURIComponent(path)}`,
      )
      .then((d) => setFiles(d.files))
      .catch(() => setFiles([]))
      .finally(() => setLoadingList(false));
  }, [serverId, path]);

  useEffect(() => {
    loadDir();
  }, [loadDir]);

  const openTextFile = async (filePath: string, name: string) => {
    if (!isEditableTextFile(name)) return;
    setOpenFile(filePath);
    setFileError("");
    setLoadingFile(true);
    setEditorContent("");
    setSavedContent("");
    try {
      const { content } = await api.get<{ content: string }>(
        `/api/${serverId}/files/content?path=${encodeURIComponent(filePath)}`,
      );
      setEditorContent(content);
      setSavedContent(content);
    } catch (err) {
      setFileError((err as Error).message);
      setOpenFile(null);
    } finally {
      setLoadingFile(false);
    }
  };

  const closeEditor = () => {
    if (
      openFile &&
      editorContent !== savedContent &&
      !confirm("Discard unsaved changes?")
    ) {
      return;
    }
    setOpenFile(null);
    setFileError("");
  };

  const saveFile = async () => {
    if (!openFile) return;
    setSaving(true);
    setFileError("");
    try {
      await api.put(`/api/${serverId}/files/content`, {
        path: openFile,
        content: editorContent,
      });
      setSavedContent(editorContent);
    } catch (err) {
      setFileError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const dirty = openFile !== null && editorContent !== savedContent;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="min-h-[320px] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="truncate font-mono text-sm text-muted">/{path}</p>
          {loadingList && (
            <span className="shrink-0 text-xs text-muted">Loading…</span>
          )}
        </div>
        <ul className="space-y-0.5 font-mono text-sm">
          {path !== "." && (
            <li>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-card-hover"
                onClick={() => {
                  closeEditor();
                  setPath(parentPath(path));
                }}
              >
                <Folder className="h-4 w-4 shrink-0 text-muted" />
                ..
              </button>
            </li>
          )}
          {files.map((f) => {
            const editable = !f.isDirectory && isEditableTextFile(f.name);
            return (
              <li key={f.path}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left",
                    f.isDirectory || editable
                      ? "hover:bg-card-hover cursor-pointer"
                      : "cursor-default opacity-60",
                    openFile === f.path && "bg-primary-muted text-primary",
                  )}
                  onClick={() => {
                    if (f.isDirectory) {
                      closeEditor();
                      setPath(f.path);
                      return;
                    }
                    if (editable) void openTextFile(f.path, f.name);
                  }}
                  title={
                    editable
                      ? "Click to edit"
                      : f.isDirectory
                        ? "Open folder"
                        : "Not editable in browser"
                  }
                >
                  {f.isDirectory ? (
                    <Folder className="h-4 w-4 shrink-0 text-amber-500/90" />
                  ) : (
                    <FileText
                      className={cn(
                        "h-4 w-4 shrink-0",
                        editable ? "text-primary" : "text-muted",
                      )}
                    />
                  )}
                  <span className="truncate">{f.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {files.length === 0 && !loadingList && (
          <p className="mt-4 text-sm text-muted">Empty folder</p>
        )}
      </Card>

      <Card className="flex min-h-[320px] flex-col p-4">
        {!openFile ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-muted">
            <FileText className="mb-2 h-10 w-10 opacity-40" />
            <p>Select a text file (.txt, .sh, .properties, .json, …)</p>
            <p className="mt-1 text-xs">Scripts, configs and logs are editable here</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="truncate font-mono text-sm font-medium" title={openFile}>
                {openFile}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  onClick={closeEditor}
                  disabled={saving}
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1"
                  onClick={() => void saveFile()}
                  disabled={saving || loadingFile || !dirty}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>

            {fileError && (
              <p className="mb-2 rounded-lg bg-danger-muted px-3 py-2 text-sm text-danger">
                {fileError}
              </p>
            )}

            {loadingFile ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted">
                Loading file…
              </div>
            ) : (
              <textarea
                className="min-h-[260px] flex-1 resize-y rounded-xl border border-border bg-background-subtle p-3 font-mono text-xs leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                spellCheck={false}
              />
            )}

            {dirty && !loadingFile && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Unsaved changes
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
