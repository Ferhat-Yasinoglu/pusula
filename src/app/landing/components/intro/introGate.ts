/**
 * The intro gate (spec §5.1): an inline script `page.tsx` renders before the
 * landing markup. It runs before first paint and sets
 * `<html data-intro="play">` only on a genuine first visit in this tab:
 *
 * - no `pusula.intro.v1` in sessionStorage (the intro has not played yet);
 * - Pause not stored (`pusula.landing.paused` = "1" stops the heartbeat, so
 *   the intro could not run; the visitor asked for stillness anyway);
 * - no reduced-motion preference;
 * - no URL hash, no restored scroll position, a visible tab.
 *
 * Its own failsafe: if the page's JavaScript never takes over, the attribute
 * is flipped to "done" (and the hand-off event fired) after 4.6s, so the nav
 * comes back even when hydration fails. `IntroSequence` cancels that timer
 * (`window[INTRO_GATE_TIMER]`) once it runs the intro itself. The CSS
 * failsafe in `landing.css` hides the intro layers at 4.5s on its own.
 *
 * `introGateDecision` mirrors the condition for unit tests
 * (`tests/unit/landing-intro.test.ts` pins both).
 */

export const INTRO_STORAGE_KEY = "pusula.intro.v1";
/** Mirrors `PAUSED_STORAGE_KEY` in `runtime/heartbeat.ts` (pinned by the intro test). */
export const INTRO_PAUSED_KEY = "pusula.landing.paused";
export const INTRO_GATE_FAILSAFE_MS = 4600;
/** Window property holding the gate's failsafe timer id. */
export const INTRO_GATE_TIMER = "__pusulaIntroGate";

export const INTRO_GATE =
  "(function(){try{var d=document.documentElement,s=null,p=null;" +
  `try{s=sessionStorage.getItem('${INTRO_STORAGE_KEY}')}catch(e){}` +
  `try{p=localStorage.getItem('${INTRO_PAUSED_KEY}')}catch(e){}` +
  "if(!s&&p!=='1'&&!matchMedia('(prefers-reduced-motion: reduce)').matches" +
  "&&!location.hash&&!(window.scrollY>0)&&!document.hidden){d.setAttribute('data-intro','play');" +
  `window.${INTRO_GATE_TIMER}=setTimeout(function(){if(d.getAttribute('data-intro')==='play'){d.setAttribute('data-intro','done');` +
  `try{window.dispatchEvent(new Event('pusula:intro-handoff'))}catch(e){}}},${INTRO_GATE_FAILSAFE_MS})}` +
  "}catch(e){}})();";

export type IntroGateEnv = {
  storedIntro: string | null;
  storedPaused: string | null;
  reducedMotion: boolean;
  hash: string;
  scrollY: number;
  hidden: boolean;
};

/** The gate's condition as a function: true → the intro plays. */
export function introGateDecision(env: IntroGateEnv): boolean {
  return (
    !env.storedIntro &&
    env.storedPaused !== "1" &&
    !env.reducedMotion &&
    !env.hash &&
    !(env.scrollY > 0) &&
    !env.hidden
  );
}
