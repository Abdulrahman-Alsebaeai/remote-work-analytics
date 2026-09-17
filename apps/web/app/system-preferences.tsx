'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from './ui/icons';
import { cachedApiFetch, invalidateApiCache } from '../lib/client-api-cache';
import { isPublicMarketingRoute } from '../lib/public-routes';

type Theme = 'light' | 'dark';
type Notification = { id: string; type: string; titleKey: string; data?: { title?: string }; readAt?: string | null; createdAt: string };

export default function SystemPreferences() {
  const pathname = usePathname();
  const publicRoute = pathname === '/login' || isPublicMarketingRoute(pathname);
  const [theme, setTheme] = useState<Theme>('light');
  const [locale, setLocale] = useState<'ar' | 'en'>('ar');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (publicRoute) return;
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    const savedLocale = localStorage.getItem('locale') === 'en' ? 'en' : 'ar';
    setLocale(savedLocale);
    document.documentElement.lang = savedLocale;
    document.documentElement.dir = savedLocale === 'ar' ? 'rtl' : 'ltr';
    const loadTypography = () => cachedApiFetch('/api/settings').then(response => response.ok ? response.json() : null).then(settings => {
      if (settings?.fontKey) {
        document.documentElement.dataset.font = settings.fontKey;
        localStorage.setItem('organizationFont', settings.fontKey);
      }
      if (settings?.typographyScale) {
        document.documentElement.dataset.typographyScale = settings.typographyScale;
        localStorage.setItem('typographyScale', settings.typographyScale);
      }
    }).catch(() => undefined);
    const loadNotifications = () => cachedApiFetch('/api/notifications', 10_000).then(response => response.ok ? response.json() : []).then(setNotifications).catch(() => undefined);
    void Promise.all([loadTypography(), loadNotifications()]);
    const typographyTimer = window.setInterval(() => void loadTypography(), 60_000);
    const notificationTimer = window.setInterval(() => void loadNotifications(), 30_000);
    const applyFont = (event: Event) => { const fontKey = (event as CustomEvent<string>).detail; if (fontKey) document.documentElement.dataset.font = fontKey; };
    const applyTypographyScale = (event: Event) => { const scale = (event as CustomEvent<string>).detail; if (scale) document.documentElement.dataset.typographyScale = scale; };
    const applyLocale = (event: Event) => setLocale((event as CustomEvent<'ar' | 'en'>).detail);
    window.addEventListener('system-font-changed', applyFont);
    window.addEventListener('system-typography-changed', applyTypographyScale);
    window.addEventListener('system-locale-changed', applyLocale);
    return () => { window.clearInterval(typographyTimer); window.clearInterval(notificationTimer); window.removeEventListener('system-font-changed', applyFont); window.removeEventListener('system-typography-changed', applyTypographyScale); window.removeEventListener('system-locale-changed', applyLocale); };
  }, [publicRoute]);

  if (publicRoute) return null;
  const ar = locale === 'ar';
  const unread = notifications.filter(item => !item.readAt).length;
  const title = (item: Notification) => item.type === 'TASK_ASSIGNED' ? (ar ? `مهمة جديدة: ${item.data?.title ?? ''}` : `New task: ${item.data?.title ?? ''}`) : item.type === 'TASK_UPDATED' ? (ar ? `تم تحديث: ${item.data?.title ?? ''}` : `Task updated: ${item.data?.title ?? ''}`) : item.type === 'AI_ANALYSIS_COMPLETED' ? (ar ? 'اكتمل التحليل الذكي' : 'AI analysis completed') : item.type.replaceAll('_', ' ');

  const toggleTheme = () => { const next: Theme = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; localStorage.setItem('theme', next); setTheme(next); };
  const toggleLocale = () => { const next = locale === 'ar' ? 'en' : 'ar'; localStorage.setItem('locale', next); document.documentElement.lang = next; document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'; setLocale(next); window.location.reload(); };
  const markRead = async (item: Notification) => { if (!item.readAt) { const response = await fetch(`/api/notifications/${item.id}/read`, { method: 'PATCH' }); if (response.ok) { invalidateApiCache('/api/notifications'); setNotifications(current => current.map(value => value.id === item.id ? { ...value, readAt: new Date().toISOString() } : value)); } } };

  return <header className="app-topbar">
    <div className="topbar-context"><span className="live-dot"/><span>{ar ? 'منصة ذكاء العمل' : 'Work intelligence platform'}</span></div>
    <div className="topbar-actions">
      <div className="notification-control">
        <button type="button" className="icon-control" onClick={() => setShowNotifications(value => !value)} aria-label={ar ? 'الإشعارات' : 'Notifications'}><Icon name="bell"/>{unread > 0 && <b>{Math.min(unread, 9)}</b>}</button>
        {showNotifications && <div className="notification-popover"><div><strong>{ar ? 'الإشعارات' : 'Notifications'}</strong><span>{unread} {ar ? 'غير مقروء' : 'unread'}</span></div>{notifications.length ? notifications.slice(0, 6).map(item => <button type="button" className={item.readAt ? '' : 'unread'} key={item.id} onClick={() => void markRead(item)}><i/><span><strong>{title(item)}</strong><small>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</small></span></button>) : <p>{ar ? 'لا توجد إشعارات جديدة' : 'You are all caught up'}</p>}</div>}
      </div>
      <button type="button" className="icon-control" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}><Icon name={theme === 'dark' ? 'sun' : 'moon'}/></button>
      <button type="button" className="language-control" onClick={toggleLocale} aria-label="Change language"><Icon name="globe"/><span>{locale.toUpperCase()}</span></button>
      <Link className="icon-control" href="/settings" aria-label={ar ? 'الإعدادات' : 'Settings'}><Icon name="settings"/></Link>
    </div>
  </header>;
}
