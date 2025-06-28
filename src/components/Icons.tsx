import React from 'react';
import {
  // Navigation & UI
  Menu,
  Home,
  Plus,
  Search,
  X,
  ChevronRight,
  
  // Files & Folders
  File,
  Folder,
  FolderPlus,
  FileText,
  
  // Security & Authentication
  Lock,
  Eye,
  EyeOff,
  Shield,
  
  // Status & Feedback
  Check,
  AlertTriangle,
  Info,
  Clock,
  RefreshCw,
  
  // Theme & Settings
  Sun,
  Moon,
  Monitor,
  Keyboard,
  LogOut,
  
  // Content & Editor
  Lightbulb,
  
  // Generic
  LucideIcon
} from 'lucide-react';

// Icon size presets
export const IconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32
} as const;

export type IconSize = keyof typeof IconSizes;

// Common icon props interface
interface IconProps {
  size?: IconSize | number;
  className?: string;
  color?: string;
  strokeWidth?: number;
}

// Helper function to get size value
const getSize = (size: IconSize | number = 'md'): number => {
  return typeof size === 'number' ? size : IconSizes[size];
};

// Icon component factory
const createIcon = (LucideComponent: LucideIcon) => 
  ({ size = 'md', className = '', color = 'currentColor', strokeWidth = 2, ...props }: IconProps & React.ComponentProps<LucideIcon>) => (
    <LucideComponent
      size={getSize(size)}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
      {...props}
    />
  );

// Export all icons with consistent interface
export const Icons = {
  // Navigation & UI
  menu: createIcon(Menu),
  home: createIcon(Home),
  plus: createIcon(Plus),
  search: createIcon(Search),
  x: createIcon(X),
  chevronRight: createIcon(ChevronRight),
  
  // Files & Folders
  file: createIcon(File),
  folder: createIcon(Folder),
  folderPlus: createIcon(FolderPlus),
  fileText: createIcon(FileText),
  
  // Security & Authentication
  lock: createIcon(Lock),
  eye: createIcon(Eye),
  eyeOff: createIcon(EyeOff),
  shield: createIcon(Shield),
  
  // Status & Feedback
  check: createIcon(Check),
  warning: createIcon(AlertTriangle),
  info: createIcon(Info),
  clock: createIcon(Clock),
  refresh: createIcon(RefreshCw),
  
  // Theme & Settings
  sun: createIcon(Sun),
  moon: createIcon(Moon),
  monitor: createIcon(Monitor),
  keyboard: createIcon(Keyboard),
  logout: createIcon(LogOut),
  
  // Content & Editor
  lightbulb: createIcon(Lightbulb),
} as const;

// Legacy icon mapping for easier migration
export const LegacyIconMap = {
  'icon-menu': Icons.menu,
  'icon-home': Icons.home,
  'icon-plus': Icons.plus,
  'icon-search': Icons.search,
  'icon-x': Icons.x,
  'icon-chevron-right': Icons.chevronRight,
  'icon-file': Icons.file,
  'icon-folder': Icons.folder,
  'icon-lock': Icons.lock,
  'icon-eye': Icons.eye,
  'icon-eye-slash': Icons.eyeOff,
  'icon-check': Icons.check,
  'icon-warning': Icons.warning,
  'icon-info': Icons.info,
  'icon-clock': Icons.clock,
  'icon-refresh': Icons.refresh,
  'icon-sun': Icons.sun,
  'icon-moon': Icons.moon,
  'icon-monitor': Icons.monitor,
  'icon-keyboard': Icons.keyboard,
  'icon-logout': Icons.logout,
  'icon-lightbulb': Icons.lightbulb,
} as const;

// Legacy Icon component for gradual migration
interface LegacyIconProps extends IconProps {
  name: keyof typeof LegacyIconMap;
}

export const LegacyIcon: React.FC<LegacyIconProps> = ({ name, ...props }) => {
  const IconComponent = LegacyIconMap[name];
  return IconComponent ? <IconComponent {...props} /> : null;
};

// Icon wrapper component that accepts both new and legacy formats
interface IconWrapperProps extends IconProps {
  icon?: keyof typeof Icons;
  legacy?: keyof typeof LegacyIconMap;
}

export const Icon: React.FC<IconWrapperProps> = ({ icon, legacy, ...props }) => {
  if (icon && Icons[icon]) {
    const IconComponent = Icons[icon];
    return <IconComponent {...props} />;
  }
  
  if (legacy && LegacyIconMap[legacy]) {
    const IconComponent = LegacyIconMap[legacy];
    return <IconComponent {...props} />;
  }
  
  return null;
};

export default Icons; 