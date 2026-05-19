declare module "dockerode" {
  import { EventEmitter } from "events";

  export default class Docker {
    constructor(options?: { socketPath?: string });
    createContainer(options: Record<string, unknown>): Promise<Container>;
    getContainer(id: string): Container;
  }

  export interface Container {
    id: string;
    start(): Promise<void>;
    stop(options?: { t?: number }): Promise<void>;
    kill(): Promise<void>;
    restart(): Promise<void>;
    logs(options: Record<string, unknown>): Promise<NodeJS.ReadableStream>;
    attach(options: Record<string, unknown>): Promise<NodeJS.ReadWriteStream>;
    stats(options: { stream: boolean }): Promise<Record<string, unknown>>;
  }
}
