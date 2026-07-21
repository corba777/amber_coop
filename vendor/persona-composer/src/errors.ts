/** Composer errors. */

export class CompositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompositionError";
  }
}

export class ValidationError extends CompositionError {
  readonly errors: string[];

  constructor(message: string, errors?: string[]) {
    super(errors ? errors.join("; ") : message);
    this.name = "ValidationError";
    this.errors = errors ?? [message];
  }
}
