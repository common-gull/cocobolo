import { createTheme, MantineColorsTuple } from '@mantine/core';

// Custom color palette matching Cocobolo's design
const cocoboloBlue: MantineColorsTuple = [
  '#e7f3ff',
  '#cde4ff',
  '#9ac7ff',
  '#64a9ff',
  '#3990fe',
  '#1c82fe',
  '#0d6efd', // Primary blue
  '#0b5ed7',
  '#0a58ca',
  '#084298'
];

const cocoboloGray: MantineColorsTuple = [
  '#f8f9fa',
  '#e9ecef',
  '#dee2e6',
  '#ced4da',
  '#adb5bd',
  '#6c757d',
  '#495057',
  '#343a40',
  '#212529',
  '#1a1d23'
];

export const mantineTheme = createTheme({
  colors: {
    'cocobolo-blue': cocoboloBlue,
    'cocobolo-gray': cocoboloGray,
  },
  primaryColor: 'cocobolo-blue',
  primaryShade: 6,
  
  // Typography settings
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  
  // Spacing scale matching existing CSS variables
  spacing: {
    xs: '0.25rem', // 4px
    sm: '0.5rem',  // 8px
    md: '1rem',    // 16px
    lg: '1.5rem',  // 24px
    xl: '2rem',    // 32px
  },
  
  // Border radius scale
  radius: {
    xs: '2px',
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
  },
  
  // Shadows matching existing design
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
  },
  
  // Component overrides
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 500,
          transition: 'all 0.2s ease',
        },
      },
    },
    
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    
    PasswordInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    
    Paper: {
      defaultProps: {
        radius: 'lg',
        shadow: 'md',
      },
    },
    
    Modal: {
      defaultProps: {
        radius: 'lg',
        shadow: 'xl',
      },
    },
    
    Card: {
      defaultProps: {
        radius: 'lg',
        shadow: 'md',
      },
    },
  },
  
  // Breakpoints
  breakpoints: {
    xs: '36em',
    sm: '48em',
    md: '62em',
    lg: '75em',
    xl: '88em',
  },
  
  // Other theme settings
  cursorType: 'pointer',
  focusRing: 'auto',
  respectReducedMotion: true,
}); 