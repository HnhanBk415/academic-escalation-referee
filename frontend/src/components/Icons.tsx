import React from "react";
import {
  Home,
  MessageSquare,
  ClipboardList,
  Inbox,
  Scale,
  Scroll,
  Shield,
  Clock,
  ChevronRight,
  Check,
  X,
  Info,
  ArrowUpRight,
  BookOpen,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  Search,
  User,
  GraduationCap,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Bot,
  Globe,
  Ban,
  HelpCircle,
  Target,
  Hourglass,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  type LucideProps,
} from "lucide-react";

export type IconProps = { size?: number; className?: string };

// Helper to wrap Lucide icon with default size and className
function createIcon(Component: React.ComponentType<LucideProps>, defaultSize: number) {
  return function WrappedIcon({ size = defaultSize, className = "" }: IconProps) {
    return <Component size={size} className={className} />;
  };
}

// Existing icons re-mapped to Lucide components
export const IconHome = createIcon(Home, 15);
export const IconMessageSquare = createIcon(MessageSquare, 15);
export const IconClipboard = createIcon(ClipboardList, 15);
export const IconInbox = createIcon(Inbox, 15);
export const IconScale = createIcon(Scale, 15);
export const IconScroll = createIcon(Scroll, 15);
export const IconShield = createIcon(Shield, 15);
export const IconClock = createIcon(Clock, 14);
export const IconChevronRight = createIcon(ChevronRight, 12);
export const IconCheck = createIcon(Check, 14);
export const IconX = createIcon(X, 14);
export const IconInfo = createIcon(Info, 14);
export const IconArrowUpRight = createIcon(ArrowUpRight, 14);
export const IconBookOpen = createIcon(BookOpen, 12);
export const IconWarning = createIcon(AlertTriangle, 14);
export const IconSparkle = createIcon(Sparkles, 12);
export const IconRotateCcw = createIcon(RotateCcw, 15);
export const IconSearch = createIcon(Search, 16);
export const IconUser = createIcon(User, 16);
export const IconTeacher = createIcon(GraduationCap, 16);
export const IconThumbUp = createIcon(ThumbsUp, 14);
export const IconThumbDown = createIcon(ThumbsDown, 14);

// Additional standardized icons for the app
export const IconZap = createIcon(Zap, 14);
export const IconBot = createIcon(Bot, 14);
export const IconGlobe = createIcon(Globe, 14);
export const IconBan = createIcon(Ban, 14);
export const IconHelp = createIcon(HelpCircle, 14);
export const IconTarget = createIcon(Target, 14);
export const IconHourglass = createIcon(Hourglass, 14);
export const IconCheckCircle = createIcon(CheckCircle2, 14);
export const IconAlertCircle = createIcon(AlertCircle, 14);
export const IconLoader = createIcon(Loader2, 14);
export const IconCopy = createIcon(Copy, 14);

// Also re-export raw Lucide icons for flexible usage
export {
  Home,
  MessageSquare,
  ClipboardList,
  Inbox,
  Scale,
  Scroll,
  Shield,
  Clock,
  ChevronRight,
  Check,
  X,
  Info,
  ArrowUpRight,
  BookOpen,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  Search,
  User,
  GraduationCap,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Bot,
  Globe,
  Ban,
  HelpCircle,
  Target,
  Hourglass,
  CheckCircle2,
  AlertCircle,
  Loader2,
};
