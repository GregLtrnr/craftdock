"use client";

import { useEffect, useRef, useState } from "react";
import { getSocketBase } from "@/lib/api";
import { Button } from "@/components/ui/button";

/**
 * Live Minecraft console via xterm + Socket.IO.
 * Browser-only deps are imported inside useEffect to avoid SSR `self is not defined`.
 */
export function ServerTerminal({ serverId }: { serverId: string }) {
  const termContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socketRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const termRef = useRef<any>(null);

  const [connected, setConnected] = useState(false);
  const [command, setCommand] = useState("");

  useEffect(() => {
    if (!termContainerRef.current) return;

    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let socket: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let term: any = null;
    let removeResize: (() => void) | undefined;

    (async () => {
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }, { io }] = await Promise.all([
        import("xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-web-links"),
        import("socket.io-client"),
      ]);

      if (disposed || !termContainerRef.current) return;

      const fit = new FitAddon();
      const dark = document.documentElement.getAttribute("data-theme") !== "light";
      term = new Terminal({
        theme: {
          background: dark ? "#09090b" : "#f4f4f5",
          foreground: dark ? "#fafafa" : "#18181b",
          cursor: dark ? "#34d399" : "#059669",
        },
        fontFamily: "Menlo, Monaco, monospace",
        fontSize: 13,
        convertEol: true,
        disableStdin: true,
      });
      term.loadAddon(fit);
      term.loadAddon(new WebLinksAddon());
      term.open(termContainerRef.current);
      fit.fit();
      term.writeln("\x1b[90mConnecting to console…\x1b[0m");

      termRef.current = term;

      socket = io(getSocketBase(), {
        path: "/socket.io",
        withCredentials: true,
        transports: ["websocket", "polling"],
        timeout: 10000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);
        socket.emit("console:join", serverId, (err?: string) => {
          if (err) {
            term.writeln(`\x1b[31mFailed to join console: ${err}\x1b[0m`);
          }
        });
      });

      socket.on("disconnect", () => setConnected(false));

      socket.on("connect_error", (err: Error) => {
        setConnected(false);
        term.writeln(`\x1b[31mConnection failed: ${err.message}\x1b[0m`);
        term.writeln(
          "\x1b[33mCheck backend reachability on :4000 from your browser/network (e.g. http://192.168.1.170:4000/api/system/health).\x1b[0m"
        );
      });

      socket.on("console:error", (msg: { message: string }) => {
        term.writeln(`\x1b[31m${msg.message}\x1b[0m`);
      });

      socket.on("console:output", (msg: { data: string }) => {
        term.write(msg.data);
      });

      const onResize = () => fit.fit();
      window.addEventListener("resize", onResize);
      removeResize = () => window.removeEventListener("resize", onResize);
    })();

    return () => {
      disposed = true;
      setConnected(false);
      removeResize?.();
      socketRef.current?.emit("console:leave");
      socketRef.current?.disconnect();
      socketRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, [serverId]);

  const sendCommand = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = command.trim();
    if (!trimmed || !socketRef.current?.connected) return;

    socketRef.current.emit("console:command", { serverId, command: trimmed });
    termRef.current?.writeln(`\x1b[90m> ${trimmed}\x1b[0m`);
    setCommand("");
  };

  return (
    <div className="space-y-2">
      <div className="h-[480px] overflow-hidden rounded-2xl border border-border bg-background">
        <div ref={termContainerRef} className="h-full w-full p-2" />
      </div>

      <form onSubmit={sendCommand} className="flex gap-2">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={
            connected
              ? "Enter command (e.g. list, say Hello, op Steve)"
              : "Waiting for console connection…"
          }
          disabled={!connected}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary disabled:opacity-50"
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" disabled={!connected || !command.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
