import React from 'react';
import {
  // Navigation & UI
  IconMenu2,
  IconHome,
  IconPlus,
  IconSearch,
  IconX,
  IconChevronRight,
  IconDots,
  
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
  IconTrash,
  
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
const getSize = (size: IconSize | number): number => {
  return typeof size === 'number' ? size : IconSizes[size];
};

// Icon component factory for Tabler icons
const createIcon = (TablerComponent: React.ComponentType<TablerIconsProps>) => 
  ({ size = 'md', className = '', color = 'currentColor', stroke = 1.5, ...props }: IconProps & TablerIconsProps) => (
    <TablerComponent
      size={getSize(size)}
      className={className}
      color={color}
      stroke={stroke}
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
  dots: createIcon(IconDots),
  
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
  trash: createIcon(IconTrash),
} as const;

export type IconName = keyof typeof Icons; 