"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "../ui/icons";
import { AgentPreview, DashboardPreview } from "./marketing-visuals";

type Copy = { ar: string; en: string };

const workSignals: Array<Copy & { icon: IconName }> = [
  { icon: "monitor", ar: "لقطات محسّنة", en: "Optimized screenshots" },
  { icon: "briefcase", ar: "التطبيقات والمواقع", en: "Apps and websites" },
  { icon: "activity", ar: "النشاط والخمول", en: "Activity and idle time" },
];

const faqs: Array<{ question: Copy; answer: Copy }> = [
  {
    question: { ar: "هل يسجل النظام ما يكتبه الموظف؟", en: "Does the platform record what employees type?" },
    answer: { ar: "لا. يقيس مستوى النشاط فقط، ولا يحفظ محتوى ضغطات المفاتيح.", en: "No. It measures activity level only and never stores keystroke content." },
  },
  {
    question: { ar: "ماذا يحدث عند انقطاع الإنترنت؟", en: "What happens when the internet disconnects?" },
    answer: { ar: "يستمر وكيل Windows محليًا، ثم يزامن البيانات تلقائيًا عند عودة الاتصال.", en: "The Windows Agent keeps working locally and synchronizes automatically when connectivity returns." },
  },
  {
    question: { ar: "هل الذكاء الاصطناعي يصدر حكمًا على الموظف؟", en: "Does AI automatically judge employees?" },
    answer: { ar: "لا. الرؤى تشرح الأنماط وتدعم القرار، بينما تبقى المراجعة والقرارات للإدارة.", en: "No. Insights explain patterns and support decisions; review and judgment remain with people." },
  },
];

export function HomeMainSections({ ar }: { ar: boolean }) {
  const [openFaq, setOpenFaq] = useState(0);
  const t = (copy: Copy) => (ar ? copy.ar : copy.en);

  return (
    <div className="homemain-redesign">
      <section className="hm-intro">
        <div className="hm-frame hm-story hm-story-dashboard">
          <div className="hm-visual hm-dashboard-visual">
            <div className="hm-preview-label"><i />{ar ? "بيانات معاينة توضيحية" : "ILLUSTRATIVE PRODUCT PREVIEW"}</div>
            <DashboardPreview ar={ar} compact />
          </div>
          <StoryCopy
            ar={ar}
            eyebrow={{ ar: "وضوح تشغيلي", en: "OPERATIONAL CLARITY" }}
            title={{ ar: "افهم يوم العمل من نظرة واحدة.", en: "Understand the workday at a glance." }}
            description={{ ar: "تجمع المنصة أهم إشارات الإنتاجية والتركيز والوقت والمهام في سياق واحد واضح، حتى تصل إلى ما يحتاج قرارًا دون البحث بين صفحات متفرقة.", en: "The platform brings productivity, focus, time, and task signals into one clear context, so managers reach what needs a decision without searching across disconnected pages." }}
            points={[
              { icon: "dashboard", ar: "ملخص يومي واضح", en: "A clear daily overview" },
              { icon: "users", ar: "انتقال سلس إلى تفاصيل الموظف", en: "A natural path into employee detail" },
              { icon: "alert", ar: "إبراز ما يحتاج انتباهًا", en: "Attention where it is actually needed" },
            ]}
          />
        </div>
      </section>

      <section className="hm-story-section hm-story-section-tinted">
        <div className="hm-frame hm-story hm-story-reverse">
          <StoryCopy
            ar={ar}
            eyebrow={{ ar: "فهم النشاط", en: "UNDERSTAND WORK ACTIVITY" }}
            title={{ ar: "السياق أهم من الإشارة المنفردة.", en: "Context matters more than a single signal." }}
            description={{ ar: "ينظم النظام نشاط التطبيقات والمواقع واللقطات والخمول داخل تسلسل الجلسة، ليشرح نمط العمل بدل عرض بيانات مراقبة منفصلة.", en: "The platform organizes applications, websites, screenshots, and idle time within the session timeline—revealing work patterns instead of isolated monitoring data." }}
            points={workSignals}
          />
          <div className="hm-visual hm-activity-visual" aria-label={ar ? "معاينة تسلسل نشاط الجلسة" : "Session activity timeline preview"}>
            <header>
              <div><span><i />{ar ? "جلسة مباشرة" : "LIVE SESSION"}</span><strong>{ar ? "سياق نشاط اليوم" : "Today's activity context"}</strong></div>
              <time>09:00 — 12:00</time>
            </header>
            <div className="hm-activity-track">
              <span className="hm-track-line" />
              {[
                { time: "09:12", icon: "monitor" as IconName, label: ar ? "لقطة محفوظة" : "Screenshot saved", tone: "violet" },
                { time: "09:47", icon: "briefcase" as IconName, label: ar ? "عمل أساسي" : "Core work", tone: "teal" },
                { time: "10:36", icon: "message" as IconName, label: ar ? "تواصل" : "Communication", tone: "blue" },
                { time: "11:54", icon: "idle" as IconName, label: ar ? "خمول قصير" : "Short idle period", tone: "amber" },
              ].map((item) => <article key={item.time} className={item.tone}><span><Icon name={item.icon} size={17} /></span><strong>{item.label}</strong><time>{item.time}</time></article>)}
            </div>
            <footer>
              <div><span>{ar ? "العمل الأساسي" : "Core work"}</span><i><b style={{ width: "72%" }} /></i><strong>72%</strong></div>
              <div><span>{ar ? "التواصل" : "Communication"}</span><i><b style={{ width: "46%" }} /></i><strong>46%</strong></div>
              <small><Icon name="shield" size={14} />{ar ? "لا يتم حفظ محتوى ضغطات المفاتيح" : "Keystroke content is never stored"}</small>
            </footer>
          </div>
        </div>
      </section>

      <section className="hm-story-section">
        <div className="hm-frame hm-story">
          <div className="hm-visual hm-performance-visual" aria-label={ar ? "معاينة اتجاه الأداء" : "Performance trend preview"}>
            <header><div><span>{ar ? "اتجاه الأداء" : "PERFORMANCE TREND"}</span><strong>{ar ? "الإنتاجية والتركيز" : "Productivity and focus"}</strong></div><b><i />{ar ? "هذا الأسبوع" : "This week"}</b></header>
            <div className="hm-performance-summary"><strong>86%</strong><span><Icon name="trend" size={14} />+8.4%</span></div>
            <div className="hm-line-chart">
              <svg viewBox="0 0 760 250" preserveAspectRatio="none"><defs><linearGradient id="hmArea" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#7566e8" stopOpacity=".28" /><stop offset="1" stopColor="#7566e8" stopOpacity="0" /></linearGradient></defs><path className="area" d="M0 208C74 186 105 144 171 160S280 101 352 118 455 58 526 79 637 32 760 45V250H0Z" /><path className="productivity" d="M0 208C74 186 105 144 171 160S280 101 352 118 455 58 526 79 637 32 760 45" /><path className="focus" d="M0 224C78 207 113 181 174 188S281 146 355 157 461 99 530 117 642 74 760 84" /><circle cx="526" cy="79" r="6" /></svg>
              <div>{(ar ? ["س", "أ", "ث", "أ", "خ", "ج", "س"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]).map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
            </div>
            <aside><Icon name="sparkles" size={18} /><div><small>{ar ? "رؤية توضيحية" : "ILLUSTRATIVE INSIGHT"}</small><strong>{ar ? "تحسن التركيز تزامن مع تقدم أسرع في المهام." : "Improved focus coincided with stronger task progress."}</strong></div></aside>
          </div>
          <StoryCopy
            ar={ar}
            eyebrow={{ ar: "الإنتاجية والتقدم", en: "PRODUCTIVITY AND PROGRESS" }}
            title={{ ar: "اعرف ما تغيّر، ثم افهم لماذا.", en: "See what changed—then understand why." }}
            description={{ ar: "تقارن التحليلات الفترات وتربط التركيز والوقت المنتج بتقدم المهام، لتساعد الإدارة على فهم الأداء دون الغرق في الرسوم والأرقام.", en: "Analytics compare periods and connect focus and productive time with task progress, helping managers understand performance without drowning in charts and numbers." }}
            points={[
              { icon: "performance", ar: "اتجاهات يومية وأسبوعية", en: "Daily and weekly trends" },
              { icon: "tasks", ar: "تقدم المهام في نفس السياق", en: "Task progress in the same context" },
              { icon: "sparkles", ar: "رؤية قصيرة قابلة للمراجعة", en: "Concise, reviewable insights" },
            ]}
          />
        </div>
      </section>

      <section className="hm-story-section hm-story-section-dark">
        <div className="hm-dark-glow" aria-hidden="true" />
        <div className="hm-frame hm-story hm-story-reverse">
          <StoryCopy
            ar={ar}
            dark
            eyebrow={{ ar: "رؤى تساعد القرار", en: "INSIGHTS FOR BETTER DECISIONS" }}
            title={{ ar: "الذكاء يشرح النمط. الإنسان يقرر.", en: "AI explains the pattern. People decide." }}
            description={{ ar: "تحول طبقة الذكاء الإشارات التاريخية إلى ملاحظات عملية وتوصيات واضحة، وهي معزولة عن منطق النظام حتى يمكن تطويرها دون التأثير على بقية المنصة.", en: "The AI layer turns historical signals into concise observations and practical recommendations. It remains isolated from core business logic, so models can evolve safely." }}
            points={[
              { icon: "focus", ar: "اكتشاف فترات التركيز", en: "Identify focus windows" },
              { icon: "trend", ar: "توضيح الأنماط والتغيّرات", en: "Explain patterns and changes" },
              { icon: "shield", ar: "مراجعة بشرية قبل القرار", en: "Human review before action" },
            ]}
          />
          <div className="hm-visual hm-insight-visual">
            <header><span><i />AI INSIGHT ENGINE</span><b>{ar ? "معزول وقابل للتطوير" : "ISOLATED & UPGRADEABLE"}</b></header>
            <div className="hm-insight-copy"><span><Icon name="sparkles" size={21} /></span><div><small>{ar ? "ملخص اليوم" : "TODAY'S BRIEF"}</small><h3>{ar ? "أفضل ساعات التركيز ظهرت قبل الظهيرة، بالتزامن مع تقدم أوضح في المهام." : "Focus peaked before noon, alongside clearer progress on assigned tasks."}</h3></div></div>
            <div className="hm-recommendation"><span>01</span><div><small>{ar ? "توصية" : "RECOMMENDATION"}</small><strong>{ar ? "حافظ على فترات العمل العميق دون اجتماعات قصيرة متقطعة." : "Protect deep-work windows from fragmented short meetings."}</strong></div><Icon name="arrow" size={17} /></div>
            <footer><Icon name="shield" size={15} />{ar ? "الرؤية مساعدة للقرار وليست حكمًا آليًا" : "Insights support decisions; they do not automate judgment"}</footer>
          </div>
        </div>
      </section>

      <section className="hm-continuity">
        <div className="hm-frame hm-story">
          <div className="hm-visual hm-agent-visual"><AgentPreview ar={ar} /></div>
          <StoryCopy
            ar={ar}
            eyebrow={{ ar: "تجربة موثوقة للموظف", en: "A RELIABLE EMPLOYEE EXPERIENCE" }}
            title={{ ar: "الجلسة واضحة، حتى عندما ينقطع الاتصال.", en: "The session stays clear—even when connectivity does not." }}
            description={{ ar: "يعرض وكيل Windows حالة الجلسة والوقت والمهام والمزامنة بوضوح. وعند انقطاع الإنترنت يحتفظ بالبيانات محليًا ثم يزامنها تلقائيًا وبأمان.", en: "The Windows Agent keeps session status, time, tasks, and synchronization visible. When the internet drops, data is queued locally and synchronized securely when the connection returns." }}
            points={[
              { icon: "wifi", ar: "استمرار العمل دون اتصال", en: "Offline continuity" },
              { icon: "lock", ar: "تواصل حصري عبر REST آمن", en: "Secure REST-only communication" },
              { icon: "eye", ar: "شفافية كاملة أثناء الجلسة", en: "Clear session transparency" },
            ]}
          />
        </div>
      </section>

      <section className="hm-close">
        <div className="hm-frame hm-close-grid">
          <div className="hm-faq">
            <header><span className="hm-kicker"><i />{ar ? "أسئلة مهمة" : "IMPORTANT QUESTIONS"}</span><h2>{ar ? "وضوح قبل أن تبدأ." : "Clarity before you begin."}</h2></header>
            <div>{faqs.map((item, index) => <article className={openFaq === index ? "open" : ""} key={item.question.en}><button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}><span>{t(item.question)}</span><b>{openFaq === index ? "−" : "+"}</b></button><div><p>{t(item.answer)}</p></div></article>)}</div>
          </div>
          <aside className="hm-final-cta">
            <div className="hm-cta-light" aria-hidden="true" />
            <span><Icon name="rocket" size={17} />{ar ? "جاهز لرؤية العمل بوضوح؟" : "READY FOR CLARITY?"}</span>
            <h2>{ar ? "حوّل نشاط الفريق إلى قرارات أفضل." : "Turn team activity into better decisions."}</h2>
            <p>{ar ? "ابدأ تجربة المنتج أو اطلب عرضًا يشرح الرحلة كاملة." : "Start with the product or request a walkthrough of the complete experience."}</p>
            <div><Link href="/contact?intent=trial">{ar ? "ابدأ مجانًا" : "Start free"}<Icon name="arrow" size={15} /></Link><Link href="/contact?intent=demo">{ar ? "اطلب عرضًا" : "Request demo"}</Link></div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function StoryCopy({ ar, eyebrow, title, description, points, dark = false }: { ar: boolean; eyebrow: Copy; title: Copy; description: Copy; points: Array<Copy & { icon: IconName }>; dark?: boolean }) {
  const t = (copy: Copy) => (ar ? copy.ar : copy.en);
  return <div className={`hm-copy${dark ? " dark" : ""}`}>
    <span className="hm-kicker"><i />{t(eyebrow)}</span>
    <h2>{t(title)}</h2>
    <p>{t(description)}</p>
    <ul>{points.map((point) => <li key={point.en}><span><Icon name={point.icon} size={16} /></span>{t(point)}</li>)}</ul>
  </div>;
}
