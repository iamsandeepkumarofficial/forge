import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { Home } from "./routes/home.js";
import { ChatWorkbench } from "./routes/chat-workbench.js";
import { ProjectShell } from "./components/project-shell.js";
import { ChatsPage } from "./routes/chats.js";
import { SettingsPage } from "./routes/settings.js";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/projects/:projectId" element={<ProjectShell />}>
          <Route index element={<Navigate to="chats" replace />} />
          <Route path="chats" element={<ChatsPage />} />
        </Route>
        <Route
          path="/projects/:projectId/chats/:chatId"
          element={<ChatWorkbench />}
        />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
