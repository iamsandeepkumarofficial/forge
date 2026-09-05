import { describe, it, expect } from "vitest";
import {
  AppLogXtermPane,
  FollowXtermPane,
  JobLogXtermPane,
  ShellXtermPane
} from "./terminal-xterm-view";
import { ShellXtermPane as ShellFromModule } from "./terminal-xterm-shell";
import {
  AppLogXtermPane as AppLogFromModule,
  FollowXtermPane as FollowFromModule,
  JobLogXtermPane as JobLogFromModule
} from "./terminal-xterm-follow";

describe("terminal-xterm-view", () => {
  it("re-exports ShellXtermPane from the shell module", () => {
    expect(ShellXtermPane).toBe(ShellFromModule);
  });

  it("re-exports follow panes from the follow module", () => {
    expect(FollowXtermPane).toBe(FollowFromModule);
    expect(AppLogXtermPane).toBe(AppLogFromModule);
    expect(JobLogXtermPane).toBe(JobLogFromModule);
  });
});
