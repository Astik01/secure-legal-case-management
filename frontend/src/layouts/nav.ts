import {
  Activity, BarChart3, BookMarked, BookOpen, ClipboardCheck, FilePlus2, FileSearch, Gauge, History, Layers,
  LayoutDashboard, ScrollText, Settings, ShieldCheck, UserCog, Users, UserCircle2,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { Role } from '../types';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}
export interface NavSection {
  title?: string;
  items: NavItem[];
}

const profile: NavItem = { to: '/profile', label: 'Profile', icon: UserCircle2 };

export const navFor: Record<Role, NavSection[]> = {
  STUDENT: [
    {
      items: [
        { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/cases', label: 'Case explorer', icon: BookOpen },
        { to: '/bookmarks', label: 'Bookmarks', icon: BookMarked },
        { to: '/verify', label: 'Blockchain verification', icon: ShieldCheck },
        profile,
      ],
    },
  ],
  FACULTY: [
    {
      items: [
        { to: '/faculty', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/cases', label: 'Case explorer', icon: BookOpen },
        { to: '/faculty/cases/new', label: 'Add legal case', icon: FilePlus2 },
        { to: '/faculty/submissions', label: 'My submissions', icon: ClipboardCheck },
        { to: '/faculty/verifications', label: 'Verification history', icon: History },
        { to: '/faculty/audit-logs', label: 'Audit logs', icon: ScrollText },
        profile,
      ],
    },
  ],
  ADMIN: [
    {
      title: 'Overview',
      items: [
        { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      ],
    },
    {
      title: 'Legal content',
      items: [
        { to: '/cases', label: 'Case explorer', icon: BookOpen },
        { to: '/admin/cases', label: 'Case management', icon: Layers },
        { to: '/admin/approvals', label: 'Case approvals', icon: ClipboardCheck },
      ],
    },
    {
      title: 'People',
      items: [
        { to: '/admin/users', label: 'User management', icon: Users },
        { to: '/admin/roles', label: 'Role management', icon: UserCog },
      ],
    },
    {
      title: 'Integrity & security',
      items: [
        { to: '/admin/blockchain', label: 'Blockchain records', icon: FileSearch },
        { to: '/admin/audit-logs', label: 'Audit logs', icon: ScrollText },
        { to: '/admin/settings', label: 'System settings', icon: Settings },
      ],
    },
    { items: [profile] },
  ],
};

// Re-exported so pages can reuse the same icons for consistency.
export { Activity, Gauge };
