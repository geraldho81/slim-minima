"use client";

import { useEffect, useState } from "react";
import ContactForm, { type ContactField } from "@/components/site/ContactForm";
import { getContactFormForPreview } from "@/app/admin/actions";

type Props = {
  formId: string;
  eyebrow: string;
  heading: string;
  body: string;
  // Legacy inline config, used when no saved form is selected.
  fields: ContactField[];
  submitLabel: string;
  successMode: "inline" | "redirect";
  successMessage: string;
  successPath: string;
  formName: string;
};

type Loaded = {
  fields: ContactField[];
  submitLabel: string;
  successMode: "inline" | "redirect";
  successMessage: string;
  successPath: string;
  formName: string;
};

// Editor-canvas stand-in for the contact-form block. The canvas can't run the
// block's server-side getData, so when a saved form is picked we load it here.
export default function ContactFormBlockPreview(p: Props) {
  // Load the saved form (if one is picked) without any synchronous setState in
  // the effect: store the result tagged with its formId, then derive the view
  // state during render so it always tracks the current formId.
  const [loaded, setLoaded] = useState<{ id: string; data: Loaded | null } | null>(null);

  useEffect(() => {
    const formId = p.formId;
    if (!formId) return;
    let active = true;
    getContactFormForPreview(formId)
      .then((row) => {
        if (!active) return;
        setLoaded({
          id: formId,
          data: row
            ? {
                fields: row.fields,
                submitLabel: row.submitLabel,
                successMode: row.successMode,
                successMessage: row.successMessage,
                successPath: row.successPath,
                formName: row.formName,
              }
            : null,
        });
      })
      .catch(() => {
        if (active) setLoaded({ id: formId, data: null });
      });
    return () => {
      active = false;
    };
  }, [p.formId]);

  const loadedForThis = loaded?.id === p.formId ? loaded : null;
  const form = loadedForThis?.data ?? null;
  const state: "idle" | "loading" | "missing" = !p.formId
    ? "idle"
    : !loadedForThis
      ? "loading"
      : loadedForThis.data
        ? "idle"
        : "missing";

  const eff: Loaded | null = form ?? (p.formId ? null : { fields: p.fields, submitLabel: p.submitLabel, successMode: p.successMode, successMessage: p.successMessage, successPath: p.successPath, formName: p.formName });

  return (
    <section className="cms-container cms-block cms-form-section">
      <div className="cms-form-layout">
        <div className="cms-form-intro">
          {p.eyebrow && <p className="cms-eyebrow">{p.eyebrow}</p>}
          {p.heading && <h2>{p.heading}</h2>}
          {p.body && p.body.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
        </div>
        <div>
          {eff ? (
            <ContactForm
              fields={eff.fields}
              submitLabel={eff.submitLabel}
              successMode={eff.successMode}
              successMessage={eff.successMessage}
              successPath={eff.successPath}
              receiverToken=""
              formName={eff.formName}
            />
          ) : (
            <div className="cms-image-placeholder">
              {state === "loading"
                ? "Loading form..."
                : state === "missing"
                  ? "That form was deleted. Pick another under the block settings."
                  : "Pick a form in the block settings on the right. Build forms under Contacts."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
