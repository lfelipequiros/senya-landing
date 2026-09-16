import { useState, type FormEvent } from "react";
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

  return (
    <section
      className={[
        "scene",
        "scene-opening",
        step === "scroll" ? "scene--tappable" : "scene--top",
        step === "form" ? "scene--compact-mark" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      // The whole opening is the target, not just the cue — on a phone the
      // thumb lands wherever it lands. The cue below is a real button so the
      // same move exists for keyboard and screen-reader visitors; advancing is
      // idempotent, so the two firing together is harmless.
      onClick={step === "scroll" ? () => setStep("code") : undefined}
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
        {step === "scroll" && (
          <button type="button" className="tap-cue" onClick={() => setStep("code")}>
            Tocá para continuar
          </button>
        )}

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
  );
}
