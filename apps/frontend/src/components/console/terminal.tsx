"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "xterm/css/xterm.css";

export function ServerTerminal({ serverId }: { serverId: string }) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const inputRef = useRef("");

  useEffect(() => {
    if (!termRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#0a0e17",
        foreground: "#e8edf5",
        cursor: "#22c55e",
      },
      fontFamily: "Menlo, Monaco, monospace",
      fontSize: 13,
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(termRef.current);
    fit.fit();
    xtermRef.current = term;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
    const socket = io(apiUrl, {
      path: "/socket.io",
      withCredentials: true,
      auth: { token: document.cookie.match(/craftdock_token=([^;]+)/)?.[1] },
    });
    socketRef.current = socket;

    socket.emit("console:join", serverId, (err?: string) => {
      if (err) term.writeln(`\x1b[31mFailed to join console: ${err}\x1b[0m`);
    });

    socket.on("console:output", (msg: { data: string; type: string }) => {
      term.write(msg.data);
    });

    term.onData((data) => {
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

    return () => {
      window.removeEventListener("resize", onResize);
      socket.emit("console:leave");
      socket.disconnect();
      term.dispose();
    };
  }, [serverId]);

  return (
    <div className="h-[480px] overflow-hidden rounded-lg border border-border bg-[#0a0e17]">
      <div ref={termRef} className="h-full w-full p-2" />
    </div>
  );
}
