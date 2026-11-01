import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import VisitorLanguageSwitch from "./VisitorLanguageSwitch";
import { VISITOR_STEPS, formatCount, stepLabel, visitorStats } from "./visitorModel";
import "./visitor.css";

/**
 * The public visitor page: one hero, four figures, three setup steps and a
 * footer, in the visitor's language (TR / EN / DE / FA, Persian right-to-left).
 * A server component, so the whole page is in the first response and works
 * without JavaScript; only the language buttons hydrate.
 */
export default async function VisitorLanding({ providers }: { providers: number }) {
  const t = await getTranslations("visitor");
  const locale = await getLocale();
  const stats = visitorStats(providers, locale);

  return (
    <div className="vz">
      <nav className="vz-nav">
        <Link href="/landing" className="vz-brand">
          <span className="vz-mark" aria-hidden="true" />
          Pusula
        </Link>
        <div className="vz-links">
          <a href="#vz-stats">{t("navFeatures")}</a>
          <a href="#vz-steps">{t("navSteps")}</a>
          <Link href="/docs">{t("navDocs")}</Link>
        </div>
        <VisitorLanguageSwitch label={t("languageLabel")} />
      </nav>

      <main id="main-content" className="vz-main">
        <section className="vz-hero">
          <div className="vz-hero-copy">
            <span className="vz-kicker">{t("badge")}</span>
            <h1 className="vz-h1">
              {t("titleLead")}
              <br />
              <em>{t("titleProviders", { count: formatCount(providers, locale) })}</em>
            </h1>
            <p className="vz-lead">{t("lead")}</p>
            <div className="vz-ctas">
              <Link href="/dashboard" className="vz-cta vz-cta--pri">
                {t("ctaPanel")}
              </Link>
              <Link href="/docs" className="vz-cta vz-cta--sec">
                {t("ctaDocs")}
              </Link>
            </div>
            <code className="vz-code" dir="ltr">
              npx pusula
            </code>
          </div>
          <div className="vz-art" aria-hidden="true">
            <div className="vz-ring">
              <div className="vz-core">Pusula</div>
            </div>
          </div>
        </section>

        <section id="vz-stats" className="vz-stats">
          {stats.map((stat) => (
            <div className="vz-card" key={stat.labelKey}>
              <div className="vz-num">{stat.value}</div>
              <div className="vz-muted">{t(stat.labelKey)}</div>
            </div>
          ))}
        </section>

        <section id="vz-steps" className="vz-steps-wrap">
          <h2 className="vz-steps-title">{t("stepsTitle")}</h2>
          <div className="vz-steps">
            {VISITOR_STEPS.map((n) => (
              <div className="vz-card" key={n}>
                <div className="vz-step-n">{stepLabel(n, locale)}</div>
                <h3 className="vz-step-t">{t(`step${n}Title`)}</h3>
                <p className="vz-step-d">{t(`step${n}Desc`)}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="vz-foot">
        <span>{t("footer")}</span>
        <span>MIT · Pusula</span>
      </footer>
    </div>
  );
}
