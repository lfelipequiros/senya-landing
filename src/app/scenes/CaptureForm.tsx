import { useRef, useState, type FormEvent } from "react";

interface CaptureFormProps {
  onSubmit: (values: Fields) => Promise<boolean>;
}

interface Fields {
  name: string;
  email: string;
  phone: string;
}

type FieldErrors = Partial<Record<keyof Fields, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s().-]{7,20}$/;

// Error copy is deliberately short: each message has one reserved line in the
// layout (--error-slot), so a message that wrapped to two lines would push the
// form when it appeared — the movement this pass exists to remove. The phone
// case splits empty from malformed so the country-code hint lands only when it
// is the actual problem, and still fits a line at 320px.
function validate(fields: Fields): FieldErrors {
  const errors: FieldErrors = {};
  if (fields.name.trim().length === 0) {
    errors.name = "Contanos tu nombre.";
  }
  if (!EMAIL_PATTERN.test(fields.email.trim())) {
    errors.email = "Ese email no parece válido.";
  }
  if (fields.phone.trim().length === 0) {
    errors.phone = "Falta tu WhatsApp.";
  } else if (!PHONE_PATTERN.test(fields.phone.trim())) {
    errors.phone = "Incluí el código de país.";
  }
  return errors;
}

const FIELD_ORDER: (keyof Fields)[] = ["name", "email", "phone"];

// Scene 3 — placeholder fidelity: real fields, real inline validation, right
// mobile keyboards. onSubmit is wired by the caller to the real S2 write path
// and must never drop typed values on failure (CLAUDE.md §7's known trap).
export function CaptureForm({ onSubmit }: CaptureFormProps) {
  const [fields, setFields] = useState<Fields>({ name: "", email: "", phone: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const inputs = useRef<Partial<Record<keyof Fields, HTMLInputElement | null>>>({});

  const errors = validate(fields);

  function updateField(field: keyof Fields, value: string) {
    setFields((prev) => ({ ...prev, [field]: value }));
  }

  function markTouched(field: keyof Fields) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ name: true, email: true, phone: true });
    if (Object.keys(errors).length > 0 || submitting) {
      // noValidate turns off the browser's own focus-the-first-invalid-field
      // behaviour, so it has to be done here — otherwise someone on a phone
      // sees a rejected submit with no indication of which field to fix.
      const firstInvalid = FIELD_ORDER.find((field) => errors[field]);
      if (firstInvalid) inputs.current[firstInvalid]?.focus();
      return;
    }
    setSubmitting(true);
    setSubmitFailed(false);
    // Typed values live in `fields` regardless of outcome — a failed submit below never clears them
    // (CLAUDE.md §7's known trap: losing someone's input after they cleared the gate).
    const success = await onSubmit(fields);
    if (!success) {
      setSubmitting(false);
      setSubmitFailed(true);
    }
  }

  // Every error slot is always mounted and always occupies its line: an error
  // that appears must not shift the form under the keyboard, and an aria-live
  // region only announces reliably if it was present before the text arrived.
  function fieldError(field: keyof Fields) {
    const message = touched[field] && errors[field] ? errors[field] : "";
    return (
      <p className="field-error" id={`capture-${field}-error`} role="alert">
        {message}
      </p>
    );
  }

  return (
    <form className="capture-form" onSubmit={handleSubmit} noValidate>
      <div className="capture-field">
        <label className="visually-hidden" htmlFor="capture-name">
          Nombre
        </label>
        <input
          id="capture-name"
          name="name"
          ref={(el) => {
            inputs.current.name = el;
          }}
          type="text"
          inputMode="text"
          autoComplete="name"
          enterKeyHint="next"
          placeholder="Nombre"
          value={fields.name}
          aria-invalid={Boolean(touched.name && errors.name)}
          aria-describedby="capture-name-error"
          onChange={(event) => updateField("name", event.target.value)}
          onBlur={() => markTouched("name")}
        />
        {fieldError("name")}
      </div>
      <div className="capture-field">
        <label className="visually-hidden" htmlFor="capture-email">
          Email
        </label>
        <input
          id="capture-email"
          name="email"
          ref={(el) => {
            inputs.current.email = el;
          }}
          type="email"
          inputMode="email"
          autoComplete="email"
          // Without these iOS capitalizes and autocorrects the first character
          // of the address — a capture-rate bug, not a cosmetic one.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          placeholder="Email"
          value={fields.email}
          aria-invalid={Boolean(touched.email && errors.email)}
          aria-describedby="capture-email-error"
          onChange={(event) => updateField("email", event.target.value)}
          onBlur={() => markTouched("email")}
        />
        {fieldError("email")}
      </div>
      <div className="capture-field">
        <label className="visually-hidden" htmlFor="capture-phone">
          WhatsApp o teléfono
        </label>
        <input
          id="capture-phone"
          name="phone"
          ref={(el) => {
            inputs.current.phone = el;
          }}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="send"
          placeholder="WhatsApp o teléfono"
          value={fields.phone}
          aria-invalid={Boolean(touched.phone && errors.phone)}
          aria-describedby="capture-phone-error"
          onChange={(event) => updateField("phone", event.target.value)}
          onBlur={() => markTouched("phone")}
        />
        {fieldError("phone")}
      </div>
      <button type="submit" disabled={submitting}>
        {submitting ? "Enviando…" : "ENTRAR"}
      </button>
      {/* Last element in the form on purpose: this is the one message allowed
          to wrap to several lines (invariant 5 — a failed capture fails loudly,
          and clarity here outranks brevity), and sitting last it pushes nothing
          when it appears. */}
      <p className="submit-failed field-error" role="alert">
        {submitFailed
          ? "No pudimos guardar tus datos. Nada de lo que escribiste se perdió — probá enviar de nuevo."
          : ""}
      </p>
    </form>
  );
}
