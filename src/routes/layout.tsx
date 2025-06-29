import { Outlet } from "react-router";
import { Provider as JotaiProvider } from 'jotai';
import { ThemeProvider } from '../contexts/ThemeContext';

export default function Layout() {
  return (
    <JotaiProvider>
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    </JotaiProvider>
  );
} 