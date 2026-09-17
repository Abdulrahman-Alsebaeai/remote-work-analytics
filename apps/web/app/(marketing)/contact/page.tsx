'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Icon } from '../../ui/icons';
import { useMarketing } from '../marketing-context';
import { MarketingPageHero } from '../marketing-page-components';

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@remoteworkanalytics.com';

export default function ContactPage() {
  const { ar } = useMarketing();
  const [intent, setIntent] = useState('demo');
  const [prepared, setPrepared] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('intent');
    if (value && ['trial', 'demo', 'professional', 'enterprise', 'updates'].includes(value)) setIntent(value);
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const subject = `[${String(form.get('intent')).toUpperCase()}] Remote Work Intelligence — ${String(form.get('company'))}`;
    const body = [
      `Name: ${String(form.get('name'))}`,
      `Work email: ${String(form.get('email'))}`,
      `Company: ${String(form.get('company'))}`,
      `Team size: ${String(form.get('teamSize'))}`,
      `Request: ${String(form.get('intent'))}`,
      '',
      String(form.get('message')),
    ].join('\n');
    setPrepared(true);
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return <><MarketingPageHero eyebrow="LET’S TALK" titleAr="لنبنِ تجربة عمل أوضح لفريقك" titleEn="Let’s build a clearer work experience for your team" textAr="اطلب عرضًا حيًا أو تجربة موجهة. سنبدأ من احتياج فريقك ونوضح ما يعمل الآن وما هو ضمن مسار التطوير." textEn="Request a live demo or guided evaluation. We will begin with your team’s needs and explain what works today and what sits on the product roadmap." actions={false}/>
    <section className="marketing-section compact"><div className="marketing-container contact-layout"><aside className="contact-info"><span className="marketing-eyebrow">DIRECT CONTACT</span><h2>{ar ? 'تواصل مع فريق المنتج' : 'Talk to the product team'}</h2><p>{ar ? 'اختر نوع الطلب وأخبرنا عن فريقك. يجهز النموذج رسالة منظمة ويفتح تطبيق البريد لديك، دون إضافة خدمة إرسال جديدة إلى الخادم.' : 'Choose a request and tell us about your team. The form prepares a structured message and opens your email application without adding a new delivery service to the backend.'}</p><div className="contact-methods"><div><span><Icon name="mail"/></span><div><strong>{ar ? 'البريد' : 'Email'}</strong><small>{contactEmail}</small></div></div><div><span><Icon name="clock"/></span><div><strong>{ar ? 'وقت الاستجابة المستهدف' : 'Target response time'}</strong><small>{ar ? 'يومان عمل' : 'Two business days'}</small></div></div><div><span><Icon name="globe"/></span><div><strong>{ar ? 'نطاق الخدمة' : 'Service model'}</strong><small>{ar ? 'فرق موزعة · العربية والإنجليزية' : 'Distributed teams · Arabic and English'}</small></div></div></div><div className="contact-assurance"><Icon name="shield" size={15}/>{ar ? 'لا يرسل هذا النموذج بيانات إلى Backend المنصة؛ تُنشأ الرسالة محليًا وتُفتح في تطبيق بريدك.' : 'This form does not send data to the platform backend; the message is composed locally and opened in your email application.'}</div></aside>
      <article className="contact-form-card"><h2>{ar ? 'كيف يمكننا مساعدتك؟' : 'How can we help?'}</h2><p>{ar ? 'أكمل التفاصيل وسيفتح برنامج البريد برسالة جاهزة للمراجعة والإرسال.' : 'Complete the details and your email application will open with a ready-to-review message.'}</p><form className="contact-form-grid" onSubmit={submit}><label>{ar ? 'الاسم الكامل' : 'Full name'}<input name="name" minLength={2} autoComplete="name" required placeholder={ar ? 'مثال: عبدالله ناصر' : 'e.g. Abdullah Nasser'}/></label><label>{ar ? 'بريد العمل' : 'Work email'}<input name="email" type="email" autoComplete="email" required placeholder="name@company.com"/></label><label>{ar ? 'اسم الشركة' : 'Company'}<input name="company" minLength={2} autoComplete="organization" required placeholder={ar ? 'اسم المؤسسة' : 'Your organization'}/></label><label>{ar ? 'حجم الفريق' : 'Team size'}<select name="teamSize" defaultValue="11-50"><option value="1-10">1–10</option><option value="11-50">11–50</option><option value="51-200">51–200</option><option value="201-1000">201–1,000</option><option value="1000+">1,000+</option></select></label><label className="full">{ar ? 'نوع الطلب' : 'Request type'}<select name="intent" value={intent} onChange={event => setIntent(event.target.value)}><option value="trial">{ar ? 'تجربة مجانية' : 'Free trial'}</option><option value="demo">{ar ? 'عرض حي' : 'Live demo'}</option><option value="professional">{ar ? 'الخطة الاحترافية' : 'Professional plan'}</option><option value="enterprise">{ar ? 'حل المؤسسات' : 'Enterprise solution'}</option><option value="updates">{ar ? 'تحديثات المنتج' : 'Product updates'}</option></select></label><label className="full">{ar ? 'ما الذي تريد تحسينه؟' : 'What would you like to improve?'}<textarea name="message" minLength={10} required placeholder={ar ? 'أخبرنا عن طريقة العمل الحالية وأهم التحديات…' : 'Tell us about your current workflow and main challenges…'}/></label>{prepared && <div className="contact-success full" role="status"><Icon name="check" size={16}/>{ar ? 'تم تجهيز الرسالة. راجع تطبيق البريد لإرسالها.' : 'Your message is prepared. Review your email application to send it.'}</div>}<button type="submit">{ar ? 'جهّز طلب التواصل' : 'Prepare contact request'}<Icon name="arrow" size={15}/></button></form></article></div></section>
    <section className="marketing-section tinted"><div className="marketing-container marketing-section-title"><span className="marketing-eyebrow">FAQ</span><h2>{ar ? 'هل تبحث عن إجابة سريعة؟' : 'Looking for a quick answer?'}</h2><p>{ar ? 'راجع مركز التوثيق لفهم تشغيل لوحة المدير والوكيل والمزامنة، أو اقرأ الأسئلة الشائعة في الصفحة الرئيسية.' : 'Visit the documentation center to understand manager, agent, and synchronization workflows, or review the FAQ on the home page.'}</p><div className="page-hero-actions"><a className="marketing-secondary-button" href="/docs"><Icon name="book" size={16}/>{ar ? 'افتح التوثيق' : 'Open documentation'}</a><a className="marketing-secondary-button" href="/#overview">{ar ? 'استكشف المنتج' : 'Explore product'}</a></div></div></section></>;
}
