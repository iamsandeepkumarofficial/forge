import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WebPreviewStage } from "./web-preview-stage";

const useWebPreviewStage = vi.fn(
  (opts: { sessionId: string; surface: string }) => ({
    sessionId: opts.sessionId,
    surface: opts.surface
  })
);

vi.mock("./use-web-preview-stage.js", () => ({
  useWebPreviewStage: (opts: { sessionId: string; surface: string }) =>
    useWebPreviewStage(opts)
}));

vi.mock("./web-preview-stage-body.js", () => ({
  WebPreviewStageBody: ({
    s
  }: {
    s: { sessionId: string; surface: string };
  }) => (
    <div data-testid="stage-body">
      {s.sessionId}:{s.surface}
    </div>
  )
}));

describe("WebPreviewStage", () => {
  it("passes the hook stage into WebPreviewStageBody", () => {
    render(
      <WebPreviewStage
        sessionId="s1"
        apps={[]}
        active={undefined}
        surface="browser"
        webRunningNoUrl={[]}
        reloadNonce={0}
        onSelect={() => undefined}
        onReload={() => undefined}
      />
    );
    expect(useWebPreviewStage).toHaveBeenCalled();
    expect(screen.getByTestId("stage-body").textContent).toBe("s1:browser");
  });

  it("forwards session options into the stage hook", () => {
    render(
      <WebPreviewStage
        sessionId="s2"
        apps={[]}
        active={undefined}
        surface="api"
        webRunningNoUrl={[]}
        reloadNonce={3}
        onSelect={() => undefined}
        onReload={() => undefined}
      />
    );
    expect(useWebPreviewStage.mock.calls.at(-1)?.[0]).toMatchObject({
      sessionId: "s2",
      surface: "api",
      reloadNonce: 3
    });
    expect(screen.getByTestId("stage-body").textContent).toBe("s2:api");
  });
});
