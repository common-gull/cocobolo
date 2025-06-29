import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { mantineTheme } from './theme/mantine-theme';

// Import Mantine styles
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';

// Import route components
import Layout from './routes/layout';
import Home from './routes/home';
import VaultSetup from './routes/vault-setup';
import PasswordSetup from './routes/password-setup';
import VaultUnlock from './routes/vault-unlock';
import AppLayout from './routes/app-layout';
import App from './routes/app';
import Document from './routes/document';

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
        Component: Home,
        errorElement: <ErrorBoundary error={new Error("Home error")} />,
      },
      {
        path: "vault-setup",
        Component: VaultSetup,
        errorElement: <ErrorBoundary error={new Error("Vault setup error")} />,
      },
      {
        path: "password-setup",
        Component: PasswordSetup,
        errorElement: <ErrorBoundary error={new Error("Password setup error")} />,
      },
      {
        path: "vault-unlock",
        Component: VaultUnlock,
        errorElement: <ErrorBoundary error={new Error("Vault unlock error")} />,
      },
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
