import { Provider as JotaiProvider } from 'jotai';
import { Outlet } from "react-router";

import { useTheme } from '../hooks/useTheme';

// Component to initialize theme system without context
function ThemeInitializer({ children }: { children: React.ReactNode }) {
  useTheme(); // This will handle all theme initialization
  return <>{children}</>;
}

export default function Layout() {
  return (
    <JotaiProvider>
      <ThemeInitializer>
        <Outlet />
      </ThemeInitializer>
    </JotaiProvider>
  );
} 