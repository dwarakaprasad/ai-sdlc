/** Shared by the server's check and the setup form's hint. */
export const MIN_PASSWORD_LENGTH = 8;

/** A Learner PIN is this many digits; shared by the server's check and the Learner form's hint. */
export const PIN_LENGTH = { min: 4, max: 8 };
export const PIN_PATTERN = new RegExp(`^\\d{${PIN_LENGTH.min},${PIN_LENGTH.max}}$`);
