"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../ui/icons";
import { useMarketing } from "./marketing-context";

export function MarketingLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      className={`marketing-logo${compact ? " compact" : ""}`}
      href="/"
      aria-label="Remote Work Intelligence"
    >
      <span className="brand-symbol">
        <i />R
      </span>
      {!compact && (
        <span>
          <strong>Remote Work</strong>
          <small>INTELLIGENCE</small>
        </span>
      )}
    </Link>
  );
}

const navigation = [
  { href: "/", ar: "الرئيسية", en: "Home" },
  { href: "/features", ar: "المزايا", en: "Features" },
  { href: "/pricing", ar: "الأسعار", en: "Pricing" },
  { href: "/about", ar: "عن المنصة", en: "About" },
  { href: "/docs", ar: "التوثيق", en: "Docs" },
];

export function MarketingHeader() {
  const { ar, locale, theme, toggleLocale, toggleTheme } = useMarketing();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className={`marketing-header${scrolled ? " scrolled" : ""}`}>
      <div className="marketing-container marketing-nav-row">
        <MarketingLogo />
        <nav
          className={open ? "open" : ""}
          aria-label={ar ? "التنقل الرئيسي" : "Primary navigation"}
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              className={pathname === item.href ? "active" : ""}
              href={item.href}
            >
              {ar ? item.ar : item.en}
            </Link>
          ))}
          <Link className="mobile-contact-link" href="/contact">
            {ar ? "تواصل معنا" : "Contact"}
          </Link>
        </nav>
        <div className="marketing-nav-actions">
          <button
            className="marketing-icon-button"
            type="button"
            onClick={toggleTheme}
            aria-label={ar ? "تغيير المظهر" : "Toggle theme"}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
          </button>
          <button
            className="marketing-language-button"
            type="button"
            onClick={toggleLocale}
            aria-label={ar ? "Switch to English" : "التبديل إلى العربية"}
          >
            <Icon name="globe" size={17} />
            <span>{locale.toUpperCase()}</span>
          </button>
          <Link className="marketing-sign-in" href="/login">
            {ar ? "تسجيل الدخول" : "Sign in"}
          </Link>
          <Link className="marketing-nav-cta" href="/contact?intent=trial">
            {ar ? "ابدأ مجانًا" : "Start free"}
          </Link>
          <button
            className="marketing-menu-button"
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={ar ? "فتح القائمة" : "Open menu"}
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  const { ar } = useMarketing();
  const columns = [
    {
      ar: "المنتج",
      en: "Product",
      links: [
        ["/features", "المزايا", "Features"],
        ["/pricing", "الأسعار", "Pricing"],
        ["/contact?intent=demo", "عرض حي", "Live demo"],
        ["/login", "تسجيل الدخول", "Sign in"],
      ],
    },
    {
      ar: "الشركة",
      en: "Company",
      links: [
        ["/about", "عن المنصة", "About"],
        ["/contact", "تواصل معنا", "Contact"],
        ["/docs", "مركز التوثيق", "Documentation"],
      ],
    },
    {
      ar: "قانوني",
      en: "Legal",
      links: [
        ["/privacy", "سياسة الخصوصية", "Privacy"],
        ["/terms", "شروط الخدمة", "Terms"],
        ["/cookies", "سياسة ملفات الارتباط", "Cookies"],
      ],
    },
  ];
  return (
    <footer className="marketing-footer">
      <div className="marketing-container footer-grid">
        <div className="footer-brand">
          <MarketingLogo />
          <p>
            {ar
              ? "ذكاء عمل واضح يساعد الفرق الموزعة على الإنجاز بثقة، دون التضحية بالخصوصية."
              : "Clear work intelligence that helps distributed teams deliver with confidence, without sacrificing privacy."}
          </p>
          <span className="footer-status">
            <i />
            {ar ? "المنصة تعمل بصورة طبيعية" : "All systems operational"}
          </span>
        </div>
        {columns.map((column) => (
          <div className="footer-column" key={column.en}>
            <strong>{ar ? column.ar : column.en}</strong>
            {column.links.map(([href, arLabel, enLabel]) => (
              <Link key={href} href={href}>
                {ar ? arLabel : enLabel}
              </Link>
            ))}
          </div>
        ))}
        <div className="footer-newsletter">
          <strong>{ar ? "ابقَ على اطلاع" : "Stay informed"}</strong>
          <p>
            {ar
              ? "تحديثات المنتج والأدلة العملية، دون رسائل مزعجة."
              : "Product updates and practical guides, without the noise."}
          </p>
          <Link href="/contact?intent=updates">
            <Icon name="mail" size={16} />
            {ar ? "طلب التحديثات" : "Request updates"}
          </Link>
        </div>
      </div>
      <div className="marketing-container footer-bottom">
        <span>© 2026 Remote Work Analytics</span>
        <span>
          {ar
            ? "مصمم للفرق التي تعمل من أي مكان"
            : "Built for teams working from anywhere"}
        </span>
      </div>
    </footer>
  );
}
