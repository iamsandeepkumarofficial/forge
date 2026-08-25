// Type declarations for tar-stream module
export as namespace tar;

declare module "tar-stream" {
  export interface Header {
    name: string;
    mode?: number;
    uid?: number;
    gid?: number;
    size: number;
    mtime?: Date;
    type?:
      | "file"
      | "directory"
      | "link"
      | "symlink"
      | "device"
      | "char"
      | "block"
      | "unknown";
    linkname?: string;
    uname?: string;
    gname?: string;
    devmajor?: number;
    devminor?: number;
    prefix?: string;
    atime?: Date;
    ctime?: Date;
  }

  export interface Readable {
    read(): Buffer;
    on(event: string, listener: (event: string, data?: Buffer) => void): this;
    pause(): this;
    resume(): this;
    isPaused(): boolean;
    destroy(error?: Error): boolean;
    _destroy(
      error: Error | null,
      callback: (error: Error | null) => void
    ): void;
  }

  export interface Writable {
    write(
      chunk: Buffer,
      encoding?: BufferEncoding,
      callback?: (error?: Error) => void
    ): boolean;
    end(
      chunk?: Buffer,
      encoding?: BufferEncoding,
      callback?: (error?: Error) => void
    ): this;
    on(event: string, listener: (event: string, data?: Buffer) => void): this;
  }

  export class Extract extends Writable {
    constructor(options?: {
      strip?: number;
      onentry?: (header: Header) => void;
      onend?: () => void;
      onwarn?: (warning: string, header: Header) => void;
    });
  }

  export class Parse extends Readable {
    constructor(options?: {
      onentry?: (header: Header, stream: Readable) => void;
      onend?: () => void;
      onwarn?: (warning: string, header: Header) => void;
    });
  }

  export class Pack extends Writable {
    constructor(options?: {
      port?: number;
      size?: number;
      onentry?: (header: Header) => void;
      onwarn?: (warning: string, header: Header) => void;
    });
  }
}
