import type { FocusEvent } from "react";

/** Reduces browser autofill on fresh auth screens. */
export function preventAutofillOnFocus(
  event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
) {
  event.currentTarget.removeAttribute("readonly");
}

export const authInputNoAutofill = {
  autoComplete: "off" as const,
  readOnly: true,
  onFocus: preventAutofillOnFocus,
};
