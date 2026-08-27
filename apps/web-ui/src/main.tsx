import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandThemeProvider } from "@/brand/use-brand-theme";
import "./index.css";
const el = document.getElementById("root");
if (!el) {
  throw new Error("#root missing");
}
createRoot(el).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <BrandThemeProvider>
        <Suspense
          fallback={
            <p
              className="text-muted-foreground p-6 text-sm"
              style={{ fontFamily: "system-ui" }}
            >
              Loading Forge UI…
            </p>
          }
        >
          <App />
        </Suspense>
      </BrandThemeProvider>
    </ThemeProvider>
  </StrictMode>
);
