import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";

import App from './routes/app';
import AppLayout from './routes/app-layout';
import Document from './routes/document';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';
import Layout from './routes/layout';
import VaultCreator from './routes/vault-creator';
import VaultSelector from './routes/vault-selector';
import VaultUnlock from './routes/vault-unlock';
import { mantineTheme } from './theme/mantine-theme';

// @ts-ignore
window.EXCALIDRAW_ASSET_PATH = "/";

// Error boundary component
function ErrorBoundary({ error }: { error: Error }) {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Something went wrong</h1>
      <details style={{ whiteSpace: 'pre-wrap' }}>
        <summary>Error details</summary>
        {error.stack}
      </details>
      <button onClick={() => window.location.reload()}>
        Reload App
      </button>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    errorElement: <ErrorBoundary error={new Error("Route error")} />,
    children: [
      {
        index: true,
        Component: VaultSelector,
        errorElement: <ErrorBoundary error={new Error("Vault selector error")} />,
      },
      {
        path: "vault-creator",
        Component: VaultCreator,
        errorElement: <ErrorBoundary error={new Error("Vault creator error")} />,
      },
      {
        path: "vault-unlock",
        Component: VaultUnlock,
        errorElement: <ErrorBoundary error={new Error("Vault unlock error")} />,
      },
      // Single AppLayout that handles both app and documents routes
      {
        Component: AppLayout,
        errorElement: <ErrorBoundary error={new Error("App layout error")} />,
        children: [
          {
            path: "app",
            Component: App,
            errorElement: <ErrorBoundary error={new Error("App error")} />,
          },
          {
            path: "documents/:noteId",
            Component: Document,
            errorElement: <ErrorBoundary error={new Error("Document error")} />,
          },
        ],
      },
    ],
  },
]);

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

createRoot(container).render(
  <StrictMode>
    <MantineProvider theme={mantineTheme}>
      <Notifications />
      <RouterProvider router={router} />
    </MantineProvider>
  </StrictMode>
);
