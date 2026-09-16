import { useEffect, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import senyaLogo from "../assets/senya-logo.png";
import { verifyCode } from "../verifyCode";
import { submitLead, type LeadInput } from "../submitLead";
import { CaptureForm } from "./CaptureForm";

type Step = "scroll" | "code" | "form" | "done";
type CodeStatus = "idle" | "checking" | "wrong";

const SPIN_SECONDS = 2.6;
const PULSE_SECONDS = 1.4;

// Scenes 1-3 merged into one in-place flow (scroll reveals the code field,
// acceptance reveals the capture form) rather than separate scene changes —
// matches PLAN.md's "acceptance drives 3 and 4 in place, with no page
// change". Placeholder fidelity everywhere except the mark itself; the
// terminal glitch treatment and reduced-motion choreography (PDR-001/003)
// are still open work.
export function OpeningScene() {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState<Step>("scroll");
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<CodeStatus>("idle");
  const [duplicate, setDuplicate] = useState(false);

  useEffect(() => {
    if (step !== "scroll") return;
    const reveal = () => setStep("code");
    window.addEventListener("wheel", reveal, { passive: true, once: true });
    window.addEventListener("touchmove", reveal, { passive: true, once: true });
    return () => {
      window.removeEventListener("wheel", reveal);
      window.removeEventListener("touchmove", reveal);
    };
  }, [step]);

  // Leaving the opening takes the scroll runway with it, so the document can be
  // left part-scrolled at the moment the gate appears. Return to the top once,
  // before the locked scene removes scrolling entirely.
  useEffect(() => {
    if (step === "scroll") return;
    window.scrollTo(0, 0);
  }, [step]);

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCodeStatus("checking");
    const result = await verifyCode(code);
    if (result.ok && result.value) {
      setStep("form");
      return;
    }
    setCodeStatus("wrong");
  }

  async function handleCaptureSubmit(fields: LeadInput): Promise<boolean> {
    const result = await submitLead(fields);
    if (!result.ok) {
      return false;
    }
    setDuplicate(result.value.duplicate);
    setStep("done");
    return true;
  }

  // Everything past the opening is a step where a keyboard can appear, so the
  // frame is locked: small-viewport height, content in the upper band, no page
  // scrolling. See .scene--locked in index.css for why.
  const locked = step !== "scroll";

  return (
    <>
      <section
        className={[
          "scene",
          "scene-opening",
          locked ? "scene--locked" : "",
          step === "form" ? "scene--compact-mark" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="opening-mark">
          <motion.img
            src={senyaLogo}
            alt="Senya"
            className="opening-logo"
            width={739}
            height={505}
            animate={prefersReducedMotion ? { opacity: [0.45, 1, 0.45] } : { rotateY: 360 }}
            transition={
              prefersReducedMotion
                ? { duration: PULSE_SECONDS, repeat: Infinity, ease: "easeInOut" }
                : { duration: SPIN_SECONDS, repeat: Infinity, ease: "linear" }
            }
          />
        </div>
        {step === "scroll" && <p className="scroll-cue">Desliza para continuar ↓</p>}

        {step === "code" && (
          <motion.form
            className="gate-form"
            onSubmit={handleCodeSubmit}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.25 : 0.5, ease: "easeOut" }}
          >
            <label className="visually-hidden" htmlFor="gate-code">
              Santo y Seña
            </label>
            <input
              id="gate-code"
              name="code"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="Santo y Seña"
              value={code}
              aria-invalid={codeStatus === "wrong"}
              aria-describedby="gate-error"
              onChange={(event) => {
                setCode(event.target.value);
                setCodeStatus("idle");
              }}
            />
            <button type="submit" disabled={codeStatus === "checking" || code.length === 0}>
              ENTRAR
            </button>
            {/* Always mounted, always occupies its line: the message must not
                shift the form when it appears, and an aria-live region only
                announces reliably if it was in the DOM beforehand. */}
            <p className="gate-wrong" id="gate-error" role="alert">
              {codeStatus === "wrong" ? "Incorrecto" : ""}
            </p>
          </motion.form>
        )}

        {step === "form" && (
          <motion.div
            className="capture-shell"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.25 : 0.5, ease: "easeOut" }}
          >
            <CaptureForm onSubmit={handleCaptureSubmit} />
          </motion.div>
        )}

        {step === "done" && (
          <p className="done-message">
            {duplicate
              ? "YA ESTABAS EN LISTA. LAS SEÑALES SERÁN CLARAS"
              : "BIENVENIDO, HAS SIDO REGISTRADO, LAS SEÑALES SERÁN CLARAS"}
          </p>
        )}
      </section>

      {/* The opening is exactly one viewport tall, so on a phone there is
          nothing to swipe and the touchmove that advances the gate may never
          fire. This gives the document somewhere to travel. */}
      {step === "scroll" && <div className="scroll-runway" aria-hidden="true" />}
    </>
  );
}
