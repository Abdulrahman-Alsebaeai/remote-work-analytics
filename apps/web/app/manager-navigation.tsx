'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from './ui/icons';
import { cachedApiFetch } from '../lib/client-api-cache';
import { isPublicMarketingRoute } from '../lib/public-routes';

type Profile = { displayName: string; email: string; role: string };

export default function ManagerNavigation() {
  const pathname = usePathname();
  const publicRoute = pathname === '/login' || isPublicMarketingRoute(pathname);
  const [locale, setLocale] = useState<'ar' | 'en'>('ar');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (publicRoute) return;
    setLocale(localStorage.getItem('locale') === 'en' ? 'en' : 'ar');
    void cachedApiFetch('/api/auth/session').then(response => response.ok ? response.json() : null).then(data => setProfile(data?.profile ?? null)).catch(() => undefined);
    const applyLocale = (event: Event) => setLocale((event as CustomEvent<'ar' | 'en'>).detail);
    window.addEventListener('system-locale-changed', applyLocale);
    return () => window.removeEventListener('system-locale-changed', applyLocale);
  }, [publicRoute]);

  useEffect(() => setOpen(false), [pathname]);
  if (publicRoute) return null;

  const ar = locale === 'ar';
  const items: Array<{ href: string; icon: IconName; ar: string; en: string; descriptionAr: string; descriptionEn: string }> = [
    { href: '/dashboard', icon: 'dashboard', ar: 'لوحة التحكم', en: 'Dashboard', descriptionAr: 'نظرة الفريق', descriptionEn: 'Team overview' },
    { href: '/users', icon: 'users', ar: 'الموظفون', en: 'Employees', descriptionAr: 'الأفراد والأداء', descriptionEn: 'People & activity' },
    { href: '/tasks', icon: 'tasks', ar: 'المهام', en: 'Tasks', descriptionAr: 'سير العمل', descriptionEn: 'Workflow' },
    { href: '/performance', icon: 'performance', ar: 'الأداء', en: 'Performance', descriptionAr: 'تحليلات ورؤى', descriptionEn: 'Analytics & insights' },
    { href: '/settings', icon: 'settings', ar: 'الإعدادات', en: 'Settings', descriptionAr: 'النظام والحساب', descriptionEn: 'System & account' },
  ];
  const isActive = (href: string) => pathname === href || (href === '/users' && pathname.startsWith('/users/')) || (href === '/performance' && pathname === '/insights');

  return <>
    <button type="button" className="nav-mobile-toggle" onClick={() => setOpen(value => !value)} aria-label={ar ? 'فتح القائمة' : 'Open navigation'}><Icon name={open ? 'close' : 'menu'}/></button>
    {open && <button type="button" className="navigation-scrim" onClick={() => setOpen(false)} aria-label={ar ? 'إغلاق القائمة' : 'Close navigation'}/>} 
    <aside className={`app-navigation${open ? ' open' : ''}`}>
      <Link className="app-brand" href="/dashboard"><span className="brand-symbol"><i/>R</span><span><strong>Remote Work</strong><small>INTELLIGENCE</small></span></Link>
      <div className="nav-section-label">{ar ? 'مساحة الإدارة' : 'MANAGEMENT'}</div>
      <nav>{items.map(item => <Link key={item.href} className={isActive(item.href) ? 'active' : ''} href={item.href}><span className="nav-icon"><Icon name={item.icon}/></span><span><strong>{ar ? item.ar : item.en}</strong><small>{ar ? item.descriptionAr : item.descriptionEn}</small></span>{isActive(item.href) && <i className="active-indicator"/>}</Link>)}</nav>
      <div className="sidebar-profile">
        <span className="profile-avatar">{profile?.displayName.slice(0, 2).toUpperCase() ?? 'RW'}</span>
        <span><strong>{profile?.displayName ?? (ar ? 'حساب الإدارة' : 'Manager account')}</strong><small>{profile?.role ?? '—'}</small></span>
        <Link href="/settings" aria-label={ar ? 'إعدادات الحساب' : 'Account settings'}><Icon name="chevron" size={16}/></Link>
      </div>
    </aside>
  </>;
}
