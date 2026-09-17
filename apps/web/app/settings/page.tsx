'use client';

import { useEffect, useState } from 'react';
import { cachedApiFetch, invalidateApiCache } from '../../lib/client-api-cache';
import { messages, type Locale } from '../../lib/i18n';
import { Icon } from '../ui/icons';
import { LoadingState } from '../ui/states';
import './settings.css';
import './typography-settings.css';

type TypographyScale = 'compact' | 'standard' | 'comfortable' | 'large';
type Settings = {
  fontKey: string;
  typographyScale: TypographyScale;
  screenshotIntervalSeconds: number;
  supportedFonts: string[];
  supportedTypographyScales: TypographyScale[];
};
type Profile = { displayName: string; email: string; role: string };
type Theme = 'system' | 'light' | 'dark';

const fontNames: Record<string, { ar: string; en: string }> = {
  cairo: { ar: 'كايرو', en: 'Cairo' },
  almarai: { ar: 'المراعي', en: 'Almarai' },
  'droid-kufi': { ar: 'درويد كوفي', en: 'Droid Kufi' },
  'noto-kufi': { ar: 'نوتو كوفي', en: 'Noto Kufi Arabic' },
  'readex-pro': { ar: 'ريدكس برو', en: 'Readex Pro' },
};

const scaleNames: Record<TypographyScale, { ar: string; en: string; ratio: string }> = {
  compact: { ar: 'مدمج', en: 'Compact', ratio: '90%' },
  standard: { ar: 'قياسي', en: 'Standard', ratio: '100%' },
  comfortable: { ar: 'مريح', en: 'Comfortable', ratio: '110%' },
  large: { ar: 'كبير', en: 'Large', ratio: '120%' },
};

const screenshotIntervals = [10, 20, 30, 60, 120, 300, 600, 900, 1800, 3600] as const;

function intervalLabel(seconds: number, ar: boolean) {
  if (seconds < 60) return ar ? `كل ${seconds} ثانية` : `Every ${seconds} seconds`;
  const minutes = seconds / 60;
  if (minutes === 1) return ar ? 'كل دقيقة' : 'Every minute';
  return ar ? `كل ${minutes} دقائق` : `Every ${minutes} minutes`;
}

export default function SettingsPage() {
  const [locale, setLocale] = useState<Locale>('ar');
  const [theme, setTheme] = useState<Theme>('system');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [fontKey, setFontKey] = useState('cairo');
  const [typographyScale, setTypographyScale] = useState<TypographyScale>('standard');
  const [screenshotIntervalSeconds, setScreenshotIntervalSeconds] = useState(300);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const t = messages[locale];
  const ar = locale === 'ar';

  useEffect(() => {
    const savedLocale: Locale = localStorage.getItem('locale') === 'en' ? 'en' : 'ar';
    const savedTheme = (localStorage.getItem('theme') ?? 'system') as Theme;
    setLocale(savedLocale);
    setTheme(savedTheme);

    Promise.all([
      cachedApiFetch('/api/settings'),
      cachedApiFetch('/api/auth/session'),
    ])
      .then(async ([settingsResponse, sessionResponse]) => {
        if (settingsResponse.status === 401 || sessionResponse.status === 401) {
          window.location.assign('/login');
          return;
        }
        if (!settingsResponse.ok || !sessionResponse.ok) throw new Error();
        const systemSettings = await settingsResponse.json() as Settings;
        const session = await sessionResponse.json() as { profile: Profile };
        setSettings(systemSettings);
        setFontKey(systemSettings.fontKey);
        setTypographyScale(systemSettings.typographyScale ?? 'standard');
        setScreenshotIntervalSeconds(systemSettings.screenshotIntervalSeconds ?? 300);
        setProfile(session.profile);
      })
      .catch(() => setStatus({
        type: 'error',
        message: savedLocale === 'ar' ? 'تعذر تحميل الإعدادات' : 'Unable to load settings',
      }));
  }, []);

  function changeLocale(value: Locale) {
    localStorage.setItem('locale', value);
    document.documentElement.lang = value;
    document.documentElement.dir = value === 'ar' ? 'rtl' : 'ltr';
    setLocale(value);
    window.dispatchEvent(new CustomEvent('system-locale-changed', { detail: value }));
  }

  function changeTheme(value: Theme) {
    setTheme(value);
    if (value === 'system') {
      localStorage.removeItem('theme');
      document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      localStorage.setItem('theme', value);
      document.documentElement.dataset.theme = value;
    }
  }

  async function saveOrganizationTypography() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fontKey, typographyScale, screenshotIntervalSeconds }),
      });
      if (!response.ok) throw new Error();
      invalidateApiCache('/api/settings');
      const updated = await response.json() as Settings;
      setSettings(updated);
      localStorage.setItem('organizationFont', updated.fontKey);
      localStorage.setItem('typographyScale', updated.typographyScale);
      document.documentElement.dataset.font = updated.fontKey;
      document.documentElement.dataset.typographyScale = updated.typographyScale;
      window.dispatchEvent(new CustomEvent('system-font-changed', { detail: updated.fontKey }));
      window.dispatchEvent(new CustomEvent('system-typography-changed', { detail: updated.typographyScale }));
      setStatus({
        type: 'success',
        message: ar
          ? 'تم تطبيق إعدادات المؤسسة على النظام وتطبيق الموظف.'
          : 'Organization settings applied across the system and employee agent.',
      });
    } catch {
      setStatus({
        type: 'error',
        message: ar ? 'تعذر حفظ إعدادات المؤسسة.' : 'Unable to save organization settings.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  }

  if (!settings && !status) {
    return <main className="page-shell"><section className="wide-content"><LoadingState cards={5} /></section></main>;
  }

  const fonts = settings?.supportedFonts ?? Object.keys(fontNames);
  const scales = settings?.supportedTypographyScales ?? Object.keys(scaleNames) as TypographyScale[];
  const canManageOrganization = profile?.role === 'ADMIN';
  const hasUnsavedChanges = fontKey !== settings?.fontKey
    || typographyScale !== settings?.typographyScale
    || screenshotIntervalSeconds !== settings?.screenshotIntervalSeconds;

  return <main className="page-shell" dir={ar ? 'rtl' : 'ltr'}>
    <section className="wide-content premium-settings">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SYSTEM PREFERENCES</span>
          <h1>{ar ? 'الإعدادات' : 'Settings'}</h1>
          <p>{ar ? 'تحكم في تجربة الاستخدام وإعدادات المؤسسة والحساب من مكان واحد.' : 'Control experience, organization preferences, and account access in one place.'}</p>
        </div>
      </div>

      {status && <div className={`settings-toast ${status.type}`}>
        <Icon name={status.type === 'success' ? 'check' : 'alert'} />
        <span>{status.message}</span>
        <button type="button" onClick={() => setStatus(null)}><Icon name="close" size={15} /></button>
      </div>}

      <div className="settings-layout">
        <aside className="settings-index">
          <div>
            <span><Icon name="settings" /></span>
            <strong>{ar ? 'إعدادات النظام' : 'System settings'}</strong>
            <small>{ar ? 'التغييرات الشخصية فورية، وإعدادات المؤسسة تطبق على الجميع.' : 'Personal changes are instant; organization settings apply to everyone.'}</small>
          </div>
          <nav>
            <a href="#appearance"><Icon name="sun" />{ar ? 'المظهر واللغة' : 'Appearance & language'}</a>
            <a href="#organization"><Icon name="users" />{ar ? 'إعدادات المؤسسة' : 'Organization'}</a>
            <a href="#privacy"><Icon name="monitor" />{ar ? 'الجمع والخصوصية' : 'Collection & privacy'}</a>
            <a href="#account"><Icon name="settings" />{ar ? 'الحساب والجلسة' : 'Account & session'}</a>
          </nav>
        </aside>

        <div className="settings-content">
          <article className="settings-section" id="appearance">
            <div className="settings-section-head">
              <span><Icon name="sun" /></span>
              <div><h2>{ar ? 'المظهر واللغة' : 'Appearance & language'}</h2><p>{ar ? 'خيارات شخصية محفوظة على هذا الجهاز.' : 'Personal preferences saved on this device.'}</p></div>
            </div>
            <div className="preference-row">
              <div><strong>{ar ? 'لغة الواجهة' : 'Interface language'}</strong><small>{ar ? 'تغيّر النصوص واتجاه الواجهة بالكامل.' : 'Changes labels and the full interface direction.'}</small></div>
              <div className="segmented premium-segmented">
                <button type="button" className={locale === 'ar' ? 'selected' : ''} onClick={() => changeLocale('ar')}>العربية</button>
                <button type="button" className={locale === 'en' ? 'selected' : ''} onClick={() => changeLocale('en')}>English</button>
              </div>
            </div>
            <div className="preference-row theme-row">
              <div><strong>{ar ? 'مظهر النظام' : 'Color theme'}</strong><small>{ar ? 'اختر المظهر المناسب لهذا الجهاز.' : 'Choose the appearance for this device.'}</small></div>
              <div className="theme-options">
                {([
                  ['system', ar ? 'حسب النظام' : 'System'],
                  ['light', ar ? 'فاتح' : 'Light'],
                  ['dark', ar ? 'داكن' : 'Dark'],
                ] as Array<[Theme, string]>).map(([value, label]) => <button type="button" className={`${value} ${theme === value ? 'selected' : ''}`} onClick={() => changeTheme(value)} key={value}>
                  <span><i /><i /><i /></span><strong>{label}</strong>{theme === value && <Icon name="check" size={13} />}
                </button>)}
              </div>
            </div>
          </article>

          <article className="settings-section" id="organization">
            <div className="settings-section-head">
              <span><Icon name="users" /></span>
              <div><h2>{ar ? 'إعدادات المؤسسة' : 'Organization settings'}</h2><p>{ar ? 'إعدادات موحدة لجميع حسابات المؤسسة وتطبيق Windows.' : 'Shared settings for all organization accounts and the Windows agent.'}</p></div>
            </div>

            {!canManageOrganization && <div className="organization-readonly"><Icon name="alert" /><span>{ar ? 'يمكن لمسؤول النظام فقط تغيير هذه الإعدادات.' : 'Only an administrator can change these settings.'}</span></div>}

            <div className="font-setting">
              <label>
                <span>{ar ? 'خط النظام العام' : 'Global system font'}</span>
                <select value={fontKey} disabled={!canManageOrganization} onChange={event => setFontKey(event.target.value)}>
                  {fonts.map(key => <option value={key} key={key}>{fontNames[key]?.[locale] ?? key}</option>)}
                </select>
                <small>{ar ? 'سيصل التغيير إلى تطبيقات الموظفين عند المزامنة التالية.' : 'Employee agents receive the change on their next synchronization.'}</small>
              </label>
              <div className="premium-font-preview" data-preview-font={fontKey}>
                <span>{fontNames[fontKey]?.[locale] ?? fontKey}</span>
                <strong>{ar ? 'العمل الواضح يبدأ من بيانات واضحة' : 'Clear work begins with clear data'}</strong>
                <p>{ar ? 'أبجد هوز حطي كلمن سعفص قرشت 123' : 'The quick brown fox jumps over the lazy dog 123'}</p>
              </div>
            </div>

            <div className="typography-setting">
              <div className="typography-setting-copy">
                <strong>{ar ? 'مقياس النص العام' : 'Global typography scale'}</strong>
                <small>{ar ? 'يغيّر جميع مستويات النص الدلالية دون التأثير في المسافات أو بنية الصفحات.' : 'Adjusts every semantic text level without changing spacing or page structure.'}</small>
              </div>
              <div className="typography-scale-options">
                {scales.map(scale => <button
                  type="button"
                  className={`${scale} ${typographyScale === scale ? 'selected' : ''}`}
                  onClick={() => setTypographyScale(scale)}
                  disabled={!canManageOrganization}
                  key={scale}
                >
                  <span>Aa</span>
                  <strong>{scaleNames[scale]?.[locale] ?? scale}</strong>
                  <small>{scaleNames[scale]?.ratio}</small>
                  {typographyScale === scale && <Icon name="check" size={13} />}
                </button>)}
              </div>
            </div>

            <div className="capture-frequency-setting">
              <div>
                <strong>{ar ? 'المدة بين لقطات الشاشة' : 'Screenshot capture interval'}</strong>
                <small>{ar ? 'تُطبّق تلقائيًا على تطبيقات الموظفين عند المزامنة التالية، وتبقى محفوظة أثناء انقطاع الاتصال.' : 'Applied automatically to employee agents on their next synchronization and retained while offline.'}</small>
              </div>
              <select
                value={screenshotIntervalSeconds}
                disabled={!canManageOrganization}
                onChange={event => setScreenshotIntervalSeconds(Number(event.target.value))}
                aria-label={ar ? 'المدة بين لقطات الشاشة' : 'Screenshot capture interval'}
              >
                {screenshotIntervals.map(seconds => <option value={seconds} key={seconds}>{intervalLabel(seconds, ar)}</option>)}
              </select>
            </div>

            <div className="settings-save-row">
              <span>{hasUnsavedChanges ? (ar ? 'لديك تغييرات غير محفوظة' : 'You have unsaved changes') : (ar ? 'لا توجد تغييرات غير محفوظة' : 'No unsaved changes')}</span>
              <button type="button" className="primary-action" onClick={() => void saveOrganizationTypography()} disabled={saving || !hasUnsavedChanges || !canManageOrganization}>
                {saving ? (ar ? 'جارٍ التطبيق…' : 'Applying…') : (ar ? 'حفظ وتطبيق للجميع' : 'Save and apply to everyone')}
              </button>
            </div>
          </article>

          <article className="settings-section" id="privacy">
            <div className="settings-section-head"><span><Icon name="monitor" /></span><div><h2>{ar ? 'جمع النشاط والخصوصية' : 'Activity collection & privacy'}</h2><p>{ar ? 'ملخص شفاف لما يجمعه تطبيق الموظف ومتى.' : 'A transparent summary of what the employee agent collects and when.'}</p></div></div>
            <div className="privacy-grid">
              <div><span className="green"><Icon name="check" /></span><div><strong>{ar ? 'أثناء الجلسة فقط' : 'Only during active sessions'}</strong><small>{ar ? 'يتوقف الجمع عند الإيقاف المؤقت أو إنهاء الجلسة.' : 'Collection stops while paused or after ending a session.'}</small></div></div>
              <div><span className="purple"><Icon name="cloud" /></span><div><strong>{ar ? 'مزامنة آمنة دون اتصال' : 'Secure offline queue'}</strong><small>{ar ? 'تُشفّر البيانات محليًا حتى يعود الاتصال.' : 'Data is encrypted locally until connectivity returns.'}</small></div></div>
              <div><span className="blue"><Icon name="activity" /></span><div><strong>{ar ? 'مستوى النشاط فقط' : 'Activity level only'}</strong><small>{ar ? 'لا يسجل النظام محتوى ضغطات لوحة المفاتيح.' : 'Keyboard content is never recorded.'}</small></div></div>
              <div><span className="orange"><Icon name="clock" /></span><div><strong>{ar ? 'الخمول بعد 60 ثانية' : 'Idle after 60 seconds'}</strong><small>{ar ? 'يُعاد العداد فور عودة إدخال المستخدم.' : 'The counter resets when user input resumes.'}</small></div></div>
            </div>
          </article>

          <article className="settings-section" id="account">
            <div className="settings-section-head"><span><Icon name="settings" /></span><div><h2>{ar ? 'الحساب والجلسة' : 'Account & session'}</h2><p>{ar ? 'بيانات الحساب الحالي وإدارة تسجيل الدخول.' : 'Current account information and sign-in management.'}</p></div></div>
            {profile && <div className="settings-account"><span>{profile.displayName.slice(0, 2).toUpperCase()}</span><div><strong>{profile.displayName}</strong><small>{profile.email}</small></div><b>{profile.role}</b></div>}
            <button type="button" className="premium-logout" onClick={() => void logout()}><Icon name="arrow" size={16} />{t.logout}</button>
          </article>
        </div>
      </div>
    </section>
  </main>;
}
