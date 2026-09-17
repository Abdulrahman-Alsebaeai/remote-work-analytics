'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { messages, type Locale } from '../../lib/i18n';
import { Icon } from '../ui/icons';
import './login.css';

type Theme = 'light' | 'dark';

export default function LoginPage() {
  const [locale, setLocale] = useState<Locale>('ar');
  const [theme, setTheme] = useState<Theme>('light');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [returnPath, setReturnPath] = useState('/dashboard');
  const t = messages[locale];
  const ar = locale === 'ar';

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('next');
    const safeReturnPath = requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard';
    setReturnPath(safeReturnPath);
    setLocale(localStorage.getItem('locale') === 'en' ? 'en' : 'ar');
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(response => { if (response.ok) window.location.replace(safeReturnPath); else setChecking(false); })
      .catch(() => setChecking(false));
  }, []);

  const changeLocale = () => {
    const next: Locale = locale === 'ar' ? 'en' : 'ar';
    localStorage.setItem('locale', next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    setLocale(next);
  };
  const changeTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    document.documentElement.dataset.theme = next;
    setTheme(next);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
      if (!response.ok) throw new Error();
      window.location.assign(returnPath);
    } catch {
      setError(ar ? 'بيانات الدخول غير صحيحة أو تعذر الاتصال بالخادم.' : 'Invalid credentials or unable to reach the server.');
      setSubmitting(false);
    }
  }

  if (checking) return <main className="login-checking"><span /><p>{t.loading}</p></main>;

  return <main className="premium-login" dir={ar ? 'rtl' : 'ltr'}>
    <section className="login-story">
      <Link className="login-brand" href="/"><span className="brand-symbol"><i />R</span><span><strong>Remote Work</strong><small>INTELLIGENCE PLATFORM</small></span></Link>
      <div className="story-copy"><span className="eyebrow">WORK INTELLIGENCE, SIMPLIFIED</span><h1>{ar ? 'رؤية أوضح لفريق يعمل من أي مكان.' : 'Clarity for teams working from anywhere.'}</h1><p>{ar ? 'حوّل بيانات النشاط والمهام إلى قرارات يومية مفهومة، مع خصوصية ومزامنة آمنة.' : 'Turn activity and task data into understandable daily decisions, with privacy and secure synchronization.'}</p><div className="story-features"><span><Icon name="trend" />{ar ? 'تحليلات أداء قابلة للتنفيذ' : 'Actionable performance analytics'}</span><span><Icon name="cloud" />{ar ? 'مزامنة آمنة عند عودة الاتصال' : 'Secure offline synchronization'}</span><span><Icon name="sparkles" />{ar ? 'رؤى ذكية مبنية على الأدلة' : 'Evidence-based smart insights'}</span></div></div>
      <div className="product-preview"><div className="preview-head"><span><i />{ar ? 'عرض توضيحي للمنصة' : 'Platform preview'}</span><small>{ar ? 'بياناتك تبقى خاصة' : 'Your data stays private'}</small></div><div className="preview-body"><div className="preview-score"><span><Icon name="activity" /></span><div><small>{ar ? 'ذكاء العمل' : 'Work intelligence'}</small><strong>{ar ? 'ملخص واضح، قرار أسرع' : 'Clear signals, faster decisions'}</strong></div></div><div className="preview-chart">{[42, 58, 49, 68, 64, 82, 76, 88, 79, 92].map((height, index) => <i style={{ height: `${height}%` }} key={index} />)}</div><div className="preview-signals"><span><Icon name="check" />{ar ? 'نشاط مشفّر' : 'Encrypted activity'}</span><span><Icon name="wifi" />{ar ? 'REST آمن' : 'Secure REST'}</span><span><Icon name="clock" />{ar ? 'تقارير فورية' : 'Fast reporting'}</span></div></div></div>
      <small className="story-footer">© 2026 Remote Work Analytics</small>
    </section>
    <section className="login-access">
      <div className="login-appearance"><Link className="login-home-link" href="/" aria-label={ar ? 'العودة للموقع' : 'Back to website'}><Icon name="arrow" size={15} /><span>{ar ? 'الموقع' : 'Website'}</span></Link><button onClick={changeTheme} aria-label={ar ? 'تغيير المظهر' : 'Change theme'}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button><button onClick={changeLocale}><Icon name="globe" />{locale.toUpperCase()}</button></div>
      <div className="access-card"><span className="eyebrow">SECURE ACCESS</span><h2>{ar ? 'مرحبًا بعودتك' : 'Welcome back'}</h2><p>{ar ? 'سجّل الدخول إلى مساحة إدارة فريقك. ستبقى الجلسة محفوظة بأمان لمدة 30 يومًا.' : 'Sign in to your team workspace. Your session stays securely saved for 30 days.'}</p><form onSubmit={submit}><label>{t.email}<div className="login-input"><Icon name="users" size={17} /><input name="email" type="email" autoComplete="username" placeholder="name@company.com" required /></div></label><label>{t.password}<div className="login-input"><Icon name="lock" size={17} /><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" minLength={8} placeholder="••••••••••••" required /><button type="button" onClick={() => setShowPassword(value => !value)}>{showPassword ? (ar ? 'إخفاء' : 'Hide') : (ar ? 'إظهار' : 'Show')}</button></div></label>{error && <div className="login-error" role="alert"><Icon name="alert" size={17} />{error}</div>}<button className="login-submit" type="submit" disabled={submitting}>{submitting ? <><span className="button-loader" />{ar ? 'جارٍ التحقق…' : 'Signing in…'}</> : <>{t.login}<Icon name="arrow" size={17} /></>}</button></form><div className="session-assurance"><Icon name="check" size={15} /><span>{ar ? 'اتصال مشفّر · جلسة محفوظة · وصول حسب الصلاحية' : 'Encrypted connection · Saved session · Role-based access'}</span></div></div>
      <small className="access-help">{ar ? 'تحتاج مساعدة؟ تواصل مع مسؤول النظام.' : 'Need help? Contact your system administrator.'}</small>
    </section>
  </main>;
}
