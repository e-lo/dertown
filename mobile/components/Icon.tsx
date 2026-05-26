import React from 'react';
import { Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  Calendar,
  Star,
  Map,
  Bell,
  House,
  Search,
  Share2,
  ArrowLeft,
  MoreHorizontal,
  X,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';

// Maps our semantic icon names to platform-specific names
const ICON_MAP = {
  calendar:        { Lucide: Calendar,        material: 'calendar-today'  },
  star:            { Lucide: Star,            material: 'star'            },
  map:             { Lucide: Map,             material: 'map'             },
  bell:            { Lucide: Bell,            material: 'notifications'   },
  home:            { Lucide: House,           material: 'home'            },
  search:          { Lucide: Search,          material: 'search'          },
  share:           { Lucide: Share2,          material: 'share'           },
  'arrow-left':    { Lucide: ArrowLeft,       material: 'arrow-back'      },
  more:            { Lucide: MoreHorizontal,  material: 'more-horiz'      },
  x:               { Lucide: X,              material: 'close'           },
  plus:            { Lucide: Plus,            material: 'add'             },
  check:           { Lucide: Check,           material: 'check'           },
  'chevron-left':  { Lucide: ChevronLeft,     material: 'chevron-left'    },
  'chevron-right': { Lucide: ChevronRight,    material: 'chevron-right'   },
} as const;

export type IconName = keyof typeof ICON_MAP;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 24, color = '#ffffff' }: IconProps) {
  const mapping = ICON_MAP[name];

  if (Platform.OS === 'android') {
    return (
      <MaterialIcons
        name={mapping.material as React.ComponentProps<typeof MaterialIcons>['name']}
        size={size}
        color={color}
      />
    );
  }

  const LucideIcon = mapping.Lucide;
  return <LucideIcon size={size} color={color} strokeWidth={1.5} />;
}
