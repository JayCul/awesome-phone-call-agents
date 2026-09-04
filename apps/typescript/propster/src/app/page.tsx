import { CallESection } from "@/components/landing/CallESection";
import { CallExperience } from "@/components/landing/CallExperience";
import { Evidence } from "@/components/landing/Evidence";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Hero } from "@/components/landing/Hero";
import { Investigation } from "@/components/landing/Investigation";
import { ListingReality } from "@/components/landing/ListingReality";
import { LiveInvestigation } from "@/components/landing/LiveInvestigation";
import { Nav } from "@/components/landing/Nav";
import { Problem } from "@/components/landing/Problem";
import { PropsterIntro } from "@/components/landing/PropsterIntro";
import { ScoreSection } from "@/components/landing/ScoreSection";
import { TheProperty } from "@/components/landing/TheProperty";
import { UseCases } from "@/components/landing/UseCases";
import { Workflow } from "@/components/landing/Workflow";
import { usingRealCalle } from "@/server/env";

export const dynamic = "force-dynamic";

/**
 * The landing page is one directed sequence, not a stack of feature blocks.
 *
 * It moves through three colour worlds, and the order of them is the argument:
 *
 *   PROPERTY       hero → the property → the doubt → the problem
 *      the emotional appeal of a listing, then the first crack in it
 *
 *   INVESTIGATION  it calls → the call → the investigation
 *      the page turns near-black and the language becomes instrumental
 *
 *   EVIDENCE       evidence → listing vs reality → the score
 *      back to daylight, but everything on screen now has a source
 *
 *   then: use cases → how it works → live → CALL-E → close
 *
 * The visitor should reach "it actually calls the agent" by scrolling, not by
 * being told. This is a server component: it reads the real provider
 * configuration and passes it down, so the page cannot advertise live calling
 * that the server is not actually configured to do.
 */
export default function LandingPage() {
  const live = usingRealCalle();

  return (
    <>
      <Nav />
      <main>
        {/* --- Property world ------------------------------------------------ */}
        <Hero />
        <TheProperty />
        <Problem />
        <PropsterIntro />

        {/* --- Investigation world ------------------------------------------- */}
        <CallExperience />
        <Investigation />

        {/* --- Evidence world ------------------------------------------------- */}
        <Evidence />
        <ListingReality />
        <ScoreSection />

        {/* --- Application ----------------------------------------------------- */}
        <UseCases />
        <Workflow />
        <LiveInvestigation />
        <CallESection live={live} />
        <FinalCTA />
      </main>
    </>
  );
}
