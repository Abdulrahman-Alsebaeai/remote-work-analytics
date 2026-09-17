"use client";

import Link from "next/link";
import { Icon } from "../ui/icons";
import { HomeMainSections } from "./home-main-sections";
import { useMarketing } from "./marketing-context";
import "./home-opening.css";
import "./home.css";

export default function HomePage() {
  const { ar } = useMarketing();

  return (
    <div className="home0-page homemain-page">
      <div className="home0-original-opening">
        <section className="home0-original-hero" aria-labelledby="home-title">
          <div className="home0-original-hero-bg" aria-hidden="true" />
          <div className="home0-original-dot-grid left" aria-hidden="true" />
          <div className="home0-original-dot-grid right" aria-hidden="true" />

          <div className="home0-original-container home0-original-hero-layout">
            <div className="home0-original-hero-copy">
              <div className="home0-original-eyebrow">
                <span>{ar ? "جديد" : "NEW"}</span>
                {ar ? "ذكاء العمل للفرق الحديثة" : "Work intelligence for modern teams"}
                <b>›</b>
              </div>
              <h1 id="home-title">
                {ar ? "رؤى أذكى." : "Smarter insights."}
                <br />
                <span>{ar ? "فرق أقوى." : "Stronger teams."}</span>
              </h1>
              <p>
                {ar ? (
                  <>
                    تابع العمل، وحلّل الإنتاجية، ومكّن فريقك
                    <br className="home0-original-desktop-break" /> برؤى مدعومة بالذكاء الاصطناعي تحوّل البيانات إلى قرارات أفضل.
                  </>
                ) : (
                  <>
                    Track work, analyze productivity, and empower your team
                    <br className="home0-original-desktop-break" /> with AI-driven insights that turn data into better decisions.
                  </>
                )}
              </p>
              <div className="home0-original-hero-cta">
                <Link className="home0-original-primary" href="/contact?intent=trial">
                  {ar ? "ابدأ التجربة المجانية" : "Start free trial"}<span>›</span>
                </Link>
                <Link className="home0-original-secondary" href="/contact?intent=demo">
                  <span className="play">▷</span>{ar ? "شاهد عرضًا حيًا" : "Watch live demo"}
                </Link>
              </div>
              <div className="home0-original-trust-points">
                <span><i>✓</i>{ar ? "بدون بطاقة ائتمان" : "No credit card"}</span>
                <span><i>✓</i>{ar ? "إعداد سهل" : "Easy setup"}</span>
                <span><i>✓</i>{ar ? "إلغاء في أي وقت" : "Cancel anytime"}</span>
              </div>
            </div>

            <div className="home0-original-insight-cards" aria-label={ar ? "معاينة مؤشرات الإنتاجية" : "Productivity insights preview"}>
              <article className="home0-original-glass home0-original-score">
                <small>{ar ? "مؤشر الإنتاجية" : "Productivity score"}</small>
                <div className="score-ring"><strong>87%</strong></div>
                <p>{ar ? "↗ 12% مقارنة بالأسبوع الماضي" : "↗ 12% vs last week"}</p>
              </article>
              <article className="home0-original-glass home0-original-focus">
                <small>{ar ? "وقت التركيز" : "Focus time"}</small>
                <strong>6h 24m</strong>
                <div className="mini-bars" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
                </div>
              </article>
              <article className="home0-original-glass home0-original-activity">
                <header><small>{ar ? "أعلى الأنشطة" : "Top activity"}</small><span>↗</span></header>
                {[
                  [ar ? "التصميم" : "Design", "72%", "42%"],
                  [ar ? "التطوير" : "Development", "34%", "22%"],
                  [ar ? "التواصل" : "Communication", "22%", "18%"],
                  [ar ? "أخرى" : "Other", "12%", "12%"],
                ].map(([label, width, value]) => (
                  <div className="activity-row" key={label}>
                    <span>{label}</span><b><i style={{ width }} /></b><em>{value}</em>
                  </div>
                ))}
              </article>
            </div>
          </div>
        </section>

        <section className="home0-original-social home0-original-container">
          <p className="home0-original-kicker">
            {ar ? "منصة موحدة لفرق العمل عن بُعد" : "ONE PLATFORM FOR DISTRIBUTED WORK"}
          </p>
          <div className="home0-original-logo-row" aria-label={ar ? "قدرات المنصة" : "Platform capabilities"}>
            <span className="word-logo"><Icon name="monitor" size={19} />{ar ? "وكيل Windows" : "Windows Agent"}</span>
            <span className="word-logo"><Icon name="lock" size={19} />{ar ? "REST آمن" : "Secure REST"}</span>
            <span className="word-logo"><Icon name="cloud" size={19} />{ar ? "مزامنة دون اتصال" : "Offline Sync"}</span>
            <span className="word-logo"><Icon name="tasks" size={19} />{ar ? "ذكاء المهام" : "Task Intelligence"}</span>
            <span className="word-logo"><Icon name="sparkles" size={19} />{ar ? "رؤى ذكية" : "AI Insights"}</span>
            <span className="word-logo"><Icon name="shield" size={19} />{ar ? "سجل التدقيق" : "Audit Logs"}</span>
            <span className="word-logo"><Icon name="performance" size={19} />{ar ? "تحليلات الإدارة" : "Manager Analytics"}</span>
          </div>
          <div className="home0-original-stats">
            <article>
              <span className="stat-icon"><Icon name="lock" size={24} /></span><strong>30</strong>
              <p>{ar ? "يومًا للجلسة الآمنة" : "Days secure sign-in"}</p>
            </article>
            <article>
              <span className="stat-icon"><Icon name="wifi" size={24} /></span><strong>{ar ? "تلقائية" : "AUTO"}</strong>
              <p>{ar ? "مزامنة بعد عودة الاتصال" : "Offline recovery sync"}</p>
            </article>
            <article>
              <span className="stat-icon"><Icon name="cloud" size={24} /></span><strong>REST</strong>
              <p>{ar ? "اتصال مشفر ومعزول" : "Secure decoupled communication"}</p>
            </article>
            <article>
              <span className="stat-icon"><Icon name="shield" size={24} /></span><strong>0</strong>
              <p>{ar ? "محتوى ضغطات مفاتيح محفوظ" : "Keystroke content stored"}</p>
            </article>
          </div>
        </section>

        <section className="home0-original-features-heading home0-original-container">
          <p className="home0-original-kicker">{ar ? "مصمم لبيئات العمل الحديثة" : "BUILT FOR MODERN WORKPLACES"}</p>
          <h2>
            {ar ? <>كل ما تحتاجه لفهم<br />الإنتاجية وتحسينها.</> : <>Everything you need to understand<br />and improve productivity.</>}
          </h2>
        </section>
      </div>

      <HomeMainSections ar={ar} />
    </div>
  );
}
