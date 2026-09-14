/** Indian tax ID format examples shown in validation messages. */
export const GSTIN_FORMAT_EXAMPLE = '22AAAAA0000A1Z5';
export const PAN_FORMAT_EXAMPLE = 'AAAAA0000A';

/** 15-char GSTIN: 2-digit state + 10-char PAN + entity + Z + checksum */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** 10-char PAN: 5 letters + 4 digits + 1 letter */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;
export const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,100}$/;

export interface ClientRegistrationForm {
  company_name: string;
  username: string;
  password: string;
  confirm_password?: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
  pan: string;
}

export function validateClientRegistration(
  form: ClientRegistrationForm,
  options?: { requireConfirmPassword?: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  const requireConfirm = options?.requireConfirmPassword ?? false;

  if (!form.company_name.trim()) {
    errors.company_name = 'Company name is required';
  }

  if (!form.address.trim()) {
    errors.address = 'Address is required';
  }

  const gstin = form.gstin.trim().toUpperCase();
  if (!gstin) {
    errors.gstin = 'GSTIN is required';
  } else if (gstin.length !== 15) {
    errors.gstin = 'GSTIN must be exactly 15 characters';
  } else if (!GSTIN_REGEX.test(gstin)) {
    errors.gstin = `Invalid GSTIN format (e.g. ${GSTIN_FORMAT_EXAMPLE})`;
  }

  const pan = form.pan.trim().toUpperCase();
  if (!pan) {
    errors.pan = 'PAN is required';
  } else if (pan.length !== 10) {
    errors.pan = 'PAN must be exactly 10 characters';
  } else if (!PAN_REGEX.test(pan)) {
    errors.pan = `Invalid PAN format (e.g. ${PAN_FORMAT_EXAMPLE})`;
  } else if (gstin && GSTIN_REGEX.test(gstin) && gstin.substring(2, 12) !== pan) {
    errors.pan = 'PAN must match characters 3–12 of the GSTIN';
  }

  if (!form.email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(form.email.trim())) {
    errors.email = 'Enter a valid email address';
  }

  const phone = form.phone.trim();
  if (!phone) {
    errors.phone = 'Phone is required';
  } else if (!INDIAN_PHONE_REGEX.test(phone)) {
    errors.phone = 'Enter a valid 10-digit Indian mobile number (starts with 6–9)';
  }

  const username = form.username.trim();
  if (!username) {
    errors.username = 'Username is required';
  } else if (username.length < 3) {
    errors.username = 'Username must be at least 3 characters';
  } else if (!USERNAME_REGEX.test(username)) {
    errors.username = 'Username can only use letters, numbers, . _ -';
  }

  if (!form.password.trim()) {
    errors.password = 'Password is required';
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }

  if (requireConfirm) {
    if (!form.confirm_password?.trim()) {
      errors.confirm_password = 'Please confirm password';
    } else if (form.password !== form.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }
  }

  return errors;
}
