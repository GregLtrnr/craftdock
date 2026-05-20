"use client";

import { useEffect, useRef } from "react";
import { getSocketBase } from "@/lib/api";

/**
 * Live Minecraft console via xterm + Socket.IO.
 * Browser-only deps are imported inside useEffect to avoid SSR `self is not defined`.
 */
export function ServerTerminal({ serverId }: { serverId: string }) {
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!termRef.current) return;

    let disposed = false;
    const inputRef = { current: "" };
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

      if (disposed || !termRef.current) return;

      const fit = new FitAddon();
      term = new Terminal({
        theme: {
          background: "#0a0e17",
          foreground: "#e8edf5",
          cursor: "#22c55e",
        },
        fontFamily: "Menlo, Monaco, monospace",
        fontSize: 13,
        convertEol: true,
      });
      term.loadAddon(fit);
      term.loadAddon(new WebLinksAddon());
      term.open(termRef.current);
      fit.fit();
      term.writeln("\x1b[90mConnecting to console…\x1b[0m");

      socket = io(getSocketBase(), {
        path: "/socket.io",
        withCredentials: true,
        transports: ["websocket", "polling"],
        timeout: 10000,
      });

      socket.on("connect_error", (err: Error) => {
        term.writeln(`\x1b[31mConnection failed: ${err.message}\x1b[0m`);
        term.writeln(
          "\x1b[33mCheck backend reachability on :4000 from your browser/network (e.g. http://192.168.1.170:4000/api/system/health).\x1b[0m"
        );
      });

      socket.on("console:error", (msg: { message: string }) => {
        term.writeln(`\x1b[31m${msg.message}\x1b[0m`);
      });

      socket.on("connect", () => {
        socket.emit("console:join", serverId, (err?: string) => {
          if (err) {
            term.writeln(`\x1b[31mFailed to join console: ${err}\x1b[0m`);
          }
        });
      });

      socket.on("console:output", (msg: { data: string }) => {
        term.write(msg.data);
      });

      term.onData((data: string) => {
        if (data === "\r") {
          const cmd = inputRef.current;
          inputRef.current = "";
          if (cmd.trim()) {
            socket.emit("console:command", { serverId, command: cmd });
          }
          term.write("\r\n");
        } else if (data === "\x7f") {
          if (inputRef.current.length > 0) {
            inputRef.current = inputRef.current.slice(0, -1);
            term.write("\b \b");
          }
        } else {
          inputRef.current += data;
          term.write(data);
        }
      });

      const onResize = () => fit.fit();
      window.addEventListener("resize", onResize);
      removeResize = () => window.removeEventListener("resize", onResize);
    })();

    return () => {
      disposed = true;
      removeResize?.();
      socket?.emit("console:leave");
      socket?.disconnect();
      term?.dispose();
    };
  }, [serverId]);

  return (
    <div className="h-[480px] overflow-hidden rounded-lg border border-border bg-[#0a0e17]">
      <div ref={termRef} className="h-full w-full p-2" />
    </div>
  );
}
