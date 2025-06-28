import React from 'react';
import {
  // Navigation & UI
  IconMenu2,
  IconHome,
  IconPlus,
  IconSearch,
  IconX,
  IconChevronRight,
  
  // Files & Folders
  IconFile,
  IconFolder,
  IconFolderPlus,
  IconFileText,
  
  // Security & Authentication
  IconLock,
  IconEye,
  IconEyeOff,
  IconShield,
  
  // Status & Feedback
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
  IconClock,
  IconRefresh,
  
  // Theme & Settings
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconKeyboard,
  IconLogout,
  
  // Content & Editor
  IconBulb,
  
} from '@tabler/icons-react';

// Generic icon props type
type TablerIconsProps = React.ComponentProps<typeof IconLock>;

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
  stroke?: number;
}

// Helper function to get size value
const getSize = (size: IconSize | number = 'md'): number => {
  return typeof size === 'number' ? size : IconSizes[size];
};

// Icon component factory for Tabler icons
const createIcon = (TablerComponent: React.ComponentType<TablerIconsProps>) => 
  ({ size = 'md', className = '', color = 'currentColor', stroke = 1.5, ...props }: IconProps & TablerIconsProps) => (
    <TablerComponent
      size={getSize(size)}
      color={color}
      stroke={stroke}
      className={className}
      {...props}
    />
  );

// Export all icons with consistent interface
export const Icons = {
  // Navigation & UI
  menu: createIcon(IconMenu2),
  home: createIcon(IconHome),
  plus: createIcon(IconPlus),
  search: createIcon(IconSearch),
  x: createIcon(IconX),
  chevronRight: createIcon(IconChevronRight),
  
  // Files & Folders
  file: createIcon(IconFile),
  folder: createIcon(IconFolder),
  folderPlus: createIcon(IconFolderPlus),
  fileText: createIcon(IconFileText),
  
  // Security & Authentication
  lock: createIcon(IconLock),
  eye: createIcon(IconEye),
  eyeOff: createIcon(IconEyeOff),
  shield: createIcon(IconShield),
  
  // Status & Feedback
  check: createIcon(IconCheck),
  warning: createIcon(IconAlertTriangle),
  info: createIcon(IconInfoCircle),
  clock: createIcon(IconClock),
  refresh: createIcon(IconRefresh),
  
  // Theme & Settings
  sun: createIcon(IconSun),
  moon: createIcon(IconMoon),
  monitor: createIcon(IconDeviceDesktop),
  keyboard: createIcon(IconKeyboard),
  logout: createIcon(IconLogout),
  
  // Content & Editor
  lightbulb: createIcon(IconBulb),
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