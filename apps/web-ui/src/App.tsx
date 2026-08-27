import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { Home } from "./routes/home.js";
import { ChatWorkbench } from "./routes/chat-workbench.js";
import { ProjectShell } from "./components/project-shell.js";
import { WorkspaceShell } from "./components/workspace-shell.js";
import { ChatsPage } from "./routes/chats.js";
import { SettingsPage } from "./routes/settings.js";
import { WorkspaceIndexRedirect } from "./routes/workspace-index-redirect.js";
import { WorkspaceChatsView } from "./routes/workspace-chats-view.js";
import { WorkspaceSettingsView } from "./routes/workspace-settings-view.js";
import { WorkspaceChatWorkbench } from "./routes/workspace-chat.js";
import { WorkspacesListPage } from "./routes/workspaces-list.js";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/workspaces" element={<WorkspacesListPage />} />
        <Route path="/workspaces/:workspaceId" element={<WorkspaceShell />}>
          <Route index element={<WorkspaceIndexRedirect />} />
          <Route path="chats" element={<WorkspaceChatsView />} />
          <Route path="settings" element={<WorkspaceSettingsView />} />
        </Route>
        <Route
          path="/workspaces/:workspaceId/chats/:chatId"
          element={<WorkspaceChatWorkbench />}
        />
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
