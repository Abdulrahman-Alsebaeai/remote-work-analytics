'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon, type IconName } from '../../ui/icons';
import { useMarketing } from '../marketing-context';
import { FinalCta, MarketingPageHero, SectionTitle } from '../marketing-page-components';

type Plan = { icon: IconName; nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string; priceAr: string; priceEn: string; suffixAr: string; suffixEn: string; ctaAr: string; ctaEn: string; href: string; featured?: boolean; featuresAr: string[]; featuresEn: string[] };

const plans: Plan[] = [
  { icon: 'rocket', nameAr: 'تجربة مجانية', nameEn: 'Free Trial', descriptionAr: 'اختبر سير العمل الأساسي مع فريقك قبل اتخاذ القرار.', descriptionEn: 'Evaluate the core workflow with your team before deciding.', priceAr: '14 يومًا', priceEn: '14 days', suffixAr: 'تجربة موجهة', suffixEn: 'guided evaluation', ctaAr: 'اطلب التجربة', ctaEn: 'Request trial', href: '/contact?intent=trial', featuresAr: ['لوحة المدير والتحليلات الأساسية', 'وكيل Windows للموظف', 'المهام ولقطات الشاشة', 'دعم العربية والإنجليزية'], featuresEn: ['Manager dashboard and core analytics', 'Windows employee agent', 'Tasks and screenshots', 'Arabic and English support'] },
  { icon: 'sparkles', nameAr: 'احترافي', nameEn: 'Professional', descriptionAr: 'للشركات التي تريد تشغيلًا يوميًا وتحليلات أعمق.', descriptionEn: 'For companies ready for daily operations and deeper analytics.', priceAr: 'سعر مخصص', priceEn: 'Custom', suffixAr: 'حسب حجم الفريق', suffixEn: 'based on team size', ctaAr: 'تحدث مع المبيعات', ctaEn: 'Talk to sales', href: '/contact?intent=professional', featured: true, featuresAr: ['كل مزايا التجربة', 'تحليلات الأداء المتقدمة', 'الرؤى والتوصيات الذكية', 'إعدادات مؤسسة موحدة', 'تقارير وسجل تدقيق'], featuresEn: ['Everything in Trial', 'Advanced performance analytics', 'Smart insights and recommendations', 'Organization-wide settings', 'Reports and audit trail'] },
  { icon: 'building', nameAr: 'المؤسسات', nameEn: 'Enterprise', descriptionAr: 'للمنظمات متعددة الفرق التي تحتاج ضوابط ونشرًا مخصصًا.', descriptionEn: 'For multi-team organizations needing tailored controls and rollout.', priceAr: 'تواصل معنا', priceEn: 'Let’s talk', suffixAr: 'خطة نشر مخصصة', suffixEn: 'tailored rollout', ctaAr: 'اطلب استشارة', ctaEn: 'Request consultation', href: '/contact?intent=enterprise', featuresAr: ['كل مزايا الخطة الاحترافية', 'تخطيط فرق وأدوار إضافية', 'خيارات تخزين ونشر مرنة', 'دعم تنفيذ وأولوية', 'خارطة تكاملات مخصصة'], featuresEn: ['Everything in Professional', 'Additional team and role planning', 'Flexible storage and deployment options', 'Implementation and priority support', 'Tailored integration roadmap'] },
];

const comparison = [
  ['Manager dashboard', true, true, true], ['Windows desktop agent', true, true, true], ['Offline synchronization', true, true, true], ['Task management', true, true, true], ['Advanced performance views', false, true, true], ['Smart insight workflow', false, true, true], ['Organization-wide preferences', false, true, true], ['Tailored rollout planning', false, false, true],
] as const;

export default function PricingPage() {
  const { ar } = useMarketing();
  const [annual, setAnnual] = useState(false);
  return <><MarketingPageHero eyebrow="SIMPLE PRODUCT TIERS" titleAr="خطة تناسب مرحلة فريقك" titleEn="A plan for your team’s stage" textAr="ابدأ بتقييم المنتج، ثم انتقل إلى تشغيل أوسع عندما تثبت القيمة. لا توجد مدفوعات إلكترونية مفعّلة حاليًا، ويُراجع كل طلب مباشرة." textEn="Begin with a product evaluation, then move to a broader rollout when value is proven. Online billing is not enabled yet, and every request is reviewed directly." actions={false}/>
    <section className="marketing-section compact"><div className="marketing-container"><div className="pricing-toggle" aria-label={ar ? 'طريقة العرض' : 'Pricing display'}><span><button className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>{ar ? 'مرن' : 'Flexible'}</button><button className={annual ? 'active' : ''} onClick={() => setAnnual(true)}>{ar ? 'سنوي مخطط' : 'Annual planning'}</button></span></div><div className="pricing-cards">{plans.map(plan => <article className={`pricing-card${plan.featured ? ' featured' : ''}`} key={plan.nameEn}>{plan.featured && <span className="pricing-popular">{ar ? 'الأكثر ملاءمة للفرق' : 'BEST FOR TEAMS'}</span>}<span><Icon name={plan.icon}/></span><h2>{ar ? plan.nameAr : plan.nameEn}</h2><p>{ar ? plan.descriptionAr : plan.descriptionEn}</p><div className="price-line"><strong>{ar ? plan.priceAr : plan.priceEn}</strong><span> / {ar ? plan.suffixAr : plan.suffixEn}</span></div><Link className={plan.featured ? 'marketing-primary-button' : 'marketing-secondary-button'} href={plan.href}>{ar ? plan.ctaAr : plan.ctaEn}<Icon name="arrow" size={14}/></Link><ul>{(ar ? plan.featuresAr : plan.featuresEn).map(feature => <li key={feature}><Icon name="check" size={13}/>{feature}</li>)}</ul></article>)}</div><p className="pricing-note">{ar ? `العرض ${annual ? 'السنوي' : 'المرن'} لأغراض تخطيط المنتج؛ الأسعار والفوترة ستُعتمد قبل تفعيل الدفع.` : `${annual ? 'Annual' : 'Flexible'} view is for product planning; pricing and billing will be finalized before payments are enabled.`}</p></div></section>
    <section className="marketing-section tinted"><div className="marketing-container"><SectionTitle eyebrow="COMPARE PLANS" titleAr="قارن نطاق كل خطة" titleEn="Compare the scope of every plan" textAr="تفاصيل صريحة تساعدك على اختيار نقطة البداية المناسبة." textEn="Straightforward detail to help you choose the right starting point."/><div className="comparison-table"><table><thead><tr><th>{ar ? 'القدرة' : 'Capability'}</th><th>{ar ? 'تجربة' : 'Trial'}</th><th>{ar ? 'احترافي' : 'Professional'}</th><th>{ar ? 'مؤسسات' : 'Enterprise'}</th></tr></thead><tbody>{comparison.map(row => <tr key={row[0]}><td>{translateFeature(row[0], ar)}</td>{row.slice(1).map((included, index) => <td key={index}>{included ? <Icon name="check" size={15}/> : '—'}</td>)}</tr>)}</tbody></table></div></div></section><FinalCta/></>;
}

function translateFeature(value: string, ar: boolean) {
  if (!ar) return value;
  const map: Record<string, string> = { 'Manager dashboard': 'لوحة المدير', 'Windows desktop agent': 'وكيل Windows', 'Offline synchronization': 'المزامنة دون اتصال', 'Task management': 'إدارة المهام', 'Advanced performance views': 'تحليلات أداء متقدمة', 'Smart insight workflow': 'سير الرؤى الذكية', 'Organization-wide preferences': 'إعدادات المؤسسة', 'Tailored rollout planning': 'تخطيط نشر مخصص' };
  return map[value];
}
