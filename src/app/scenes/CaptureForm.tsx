import { useState, type FormEvent } from "react";

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

function validate(fields: Fields): FieldErrors {
  const errors: FieldErrors = {};
  if (fields.name.trim().length === 0) {
    errors.name = "Contanos tu nombre.";
  }
  if (!EMAIL_PATTERN.test(fields.email.trim())) {
    errors.email = "Ese email no parece válido.";
  }
  if (!PHONE_PATTERN.test(fields.phone.trim())) {
    errors.phone = "Incluí tu WhatsApp o teléfono, con código de país si podés.";
  }
  return errors;
}

// Scene 3 — placeholder fidelity: real fields, real inline validation, right
// mobile keyboards. onSubmit is wired by the caller to the real S2 write path
// and must never drop typed values on failure (CLAUDE.md §7's known trap).
export function CaptureForm({ onSubmit }: CaptureFormProps) {
  const [fields, setFields] = useState<Fields>({ name: "", email: "", phone: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);

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
    if (Object.keys(errors).length > 0 || submitting) return;
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

  return (
    <form className="capture-form" onSubmit={handleSubmit} noValidate>
      <div className="capture-field">
        <input
          type="text"
          inputMode="text"
          autoComplete="name"
          placeholder="Nombre"
          value={fields.name}
          onChange={(event) => updateField("name", event.target.value)}
          onBlur={() => markTouched("name")}
        />
        {touched.name && errors.name && <p className="field-error">{errors.name}</p>}
      </div>
      <div className="capture-field">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email"
          value={fields.email}
          onChange={(event) => updateField("email", event.target.value)}
          onBlur={() => markTouched("email")}
        />
        {touched.email && errors.email && <p className="field-error">{errors.email}</p>}
      </div>
      <div className="capture-field">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="WhatsApp o teléfono"
          value={fields.phone}
          onChange={(event) => updateField("phone", event.target.value)}
          onBlur={() => markTouched("phone")}
        />
        {touched.phone && errors.phone && <p className="field-error">{errors.phone}</p>}
      </div>
      {submitFailed && (
        <p className="field-error">
          No pudimos guardar tus datos. Nada de lo que escribiste se perdió — probá enviar de nuevo.
        </p>
      )}
      <button type="submit" disabled={submitting}>
        {submitting ? "Enviando…" : "ENTRAR"}
      </button>
    </form>
  );
}
