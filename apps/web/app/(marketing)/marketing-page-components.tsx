'use client';

import Link from 'next/link';
import { Icon } from '../ui/icons';
import { useMarketing } from './marketing-context';

export function MarketingPageHero({ eyebrow, titleAr, titleEn, textAr, textEn, actions = true }: { eyebrow: string; titleAr: string; titleEn: string; textAr: string; textEn: string; actions?: boolean }) {
  const { ar } = useMarketing();
  return <section className="marketing-page-hero"><div className="marketing-container"><span className="marketing-eyebrow">{eyebrow}</span><h1>{ar ? titleAr : titleEn}</h1><p>{ar ? textAr : textEn}</p>{actions && <div className="page-hero-actions"><Link className="marketing-primary-button" href="/contact?intent=trial">{ar ? 'ابدأ التجربة المجانية' : 'Start free trial'}<Icon name="arrow" size={16}/></Link><Link className="marketing-secondary-button" href="/contact?intent=demo">{ar ? 'اطلب عرضًا حيًا' : 'Request live demo'}</Link></div>}</div></section>;
}

export function SectionTitle({ eyebrow, titleAr, titleEn, textAr, textEn, align = 'center' }: { eyebrow: string; titleAr: string; titleEn: string; textAr?: string; textEn?: string; align?: 'center' | 'start' }) {
  const { ar } = useMarketing();
  return <div className={`marketing-section-title${align === 'start' ? ' align-start' : ''}`}><span className="marketing-eyebrow">{eyebrow}</span><h2>{ar ? titleAr : titleEn}</h2>{(textAr || textEn) && <p>{ar ? textAr : textEn}</p>}</div>;
}

export function FinalCta() {
  const { ar } = useMarketing();
  return <section><div className="marketing-container final-cta"><span className="marketing-eyebrow">{ar ? 'جاهز لتبدأ؟' : 'READY TO BEGIN?'}</span><h2>{ar ? 'امنح فريقك وضوحًا يمكنه العمل به.' : 'Give your team clarity they can act on.'}</h2><p>{ar ? 'ابدأ بتجربة موجهة أو اطلب عرضًا يوضح كيف تعمل المنصة على بيانات واقعية.' : 'Start with a guided evaluation or request a demo that shows the platform using realistic workflows.'}</p><div><Link className="marketing-primary-button" href="/contact?intent=trial">{ar ? 'ابدأ مجانًا' : 'Start free'}<Icon name="arrow" size={16}/></Link><Link className="marketing-secondary-button" href="/contact?intent=demo">{ar ? 'تحدث مع الفريق' : 'Talk to the team'}</Link></div></div></section>;
}
