/** Thrown when account is inactive or not staff — show "contact admin" UI, do not persist session. */
export class AccountRestrictedError extends Error {
  constructor(
    message = 'Your account cannot access this portal. Please contact your administrator.'
  ) {
    super(message);
    this.name = 'AccountRestrictedError';
    this.code = 'CONTACT_ADMIN';
  }
}

/** Invalid login (wrong credentials / no active account). */
export class LoginCredentialsError extends Error {
  constructor(message = 'Your credentials are wrong.') {
    super(message);
    this.name = 'LoginCredentialsError';
    this.code = 'INVALID_CREDENTIALS';
  }
}

export function isAccountRestrictedError(err) {
  return err instanceof AccountRestrictedError || err?.code === 'CONTACT_ADMIN';
}
