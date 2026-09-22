export class DomainError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DomainError";
    this.status = status;
  }
}

export class CompletionLockedError extends DomainError {
  constructor() {
    super("Este registro foi marcado automaticamente e não pode ser desfeito.", 409);
    this.name = "CompletionLockedError";
  }
}

export class DuplicateReminderTimeError extends DomainError {
  constructor(time: string) {
    super(`Já existe um aviso às ${time}.`, 409);
    this.name = "DuplicateReminderTimeError";
  }
}

export class ReorderMismatchError extends DomainError {
  constructor(what: string) {
    super(`A ordem precisa conter ${what}, sem repetições.`, 400);
    this.name = "ReorderMismatchError";
  }
}

export class ReminderLimitError extends DomainError {
  constructor(limit: number) {
    super(`Este hábito só pode ter ${limit} horário${limit === 1 ? "" : "s"} de aviso.`, 409);
    this.name = "ReminderLimitError";
  }
}
