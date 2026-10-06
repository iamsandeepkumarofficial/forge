import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { Home } from "./routes/home.js";
import { SettingsPage } from "./routes/settings.js";
import { WorkspaceShell } from "./components/workspace-shell.js";
import { WorkspaceIndexRedirect } from "./routes/workspace-index-redirect.js";
import { WorkspaceChatsView } from "./routes/workspace-chats-view.js";
import { WorkspaceSettingsView } from "./routes/workspace-settings-view.js";
import { WorkspaceChatWorkbench } from "./routes/workspace-chat.js";
import { WorkspacesListPage } from "./routes/workspaces-list.js";
import { ProjectToWorkspaceRedirect } from "./routes/project-to-workspace-redirect.js";

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
        <Route
          path="/projects/:projectId"
          element={<ProjectToWorkspaceRedirect suffix="" />}
        />
        <Route
          path="/projects/:projectId/chats"
          element={<ProjectToWorkspaceRedirect suffix="chats" />}
        />
        <Route
          path="/projects/:projectId/chats/:chatId"
          element={<ProjectToWorkspaceRedirect suffix="chats" />}
        />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
