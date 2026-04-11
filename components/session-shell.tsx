import Link from "next/link";

import { JourneyShell } from "@/components/journey-shell";
import type { Viewer } from "@/lib/domain";
import {
  formatJourneyStage,
  getJourneySteps,
  getStageIndex,
  type JourneyStage,
} from "@/lib/journey";

export function SessionShell({
  viewer,
  activeHref,
  stage,
  eyebrow,
  title,
  description,
  supportingMeta = [],
  children,
}: {
  viewer: Viewer;
  activeHref: "/journey" | "/simulator/new" | "/hub";
  stage: JourneyStage;
  eyebrow: string;
  title: string;
  description: string;
  supportingMeta?: Array<{ label: string; value: string }>;
  children: React.ReactNode;
}) {
  const currentIndex = getStageIndex(stage);

  return (
    <JourneyShell viewer={viewer} activeHref={activeHref}>
      <section className="session-hero">
        <div className="session-hero-copy">
          <div className="session-breadcrumb">
            <Link href="/journey">我的旅程</Link>
            <span>/</span>
            <span>{formatJourneyStage(stage)}</span>
          </div>
          <span className="session-kicker">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <div className="session-progress-card">
          <div className="session-progress-head">
            <strong>当前阶段</strong>
            <span>{formatJourneyStage(stage)}</span>
          </div>
          <div className="session-progress-list">
            {getJourneySteps().map((item, index) => {
              const state =
                index < currentIndex ? "done" : index === currentIndex ? "active" : "upcoming";

              return (
                <div key={item.id} className={`session-progress-item ${state}`}>
                  <div className="session-progress-dot" aria-hidden="true" />
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {supportingMeta.length > 0 ? (
        <section className="session-meta-row">
          {supportingMeta.map((item) => (
            <article key={item.label} className="session-meta-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>
      ) : null}

      {children}
    </JourneyShell>
  );
}
