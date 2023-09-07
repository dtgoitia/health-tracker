import { BehaviorSubject } from "rxjs";

export interface ErrorMessage {
  header: string;
  description: string;
}

export class ErrorManager {
  public errorsFeed$: BehaviorSubject<ErrorMessage[]>;
  public lastError$: BehaviorSubject<ErrorMessage | undefined>;
  constructor() {
    this.errorsFeed$ = new BehaviorSubject<ErrorMessage[]>([]);
    this.lastError$ = new BehaviorSubject<ErrorMessage | undefined>(undefined);
  }

  public add(error: ErrorMessage): void {
    let previousErrors: ErrorMessage[] = [];
    const subscription = this.errorsFeed$.subscribe((errors) => {
      previousErrors = errors;
    });
    subscription.unsubscribe();

    const errors = [...previousErrors, error];
    console.error(errors);
    this.errorsFeed$.next(errors);
    this.lastError$.next(error);
  }

  public deleteAll(): void {
    this.errorsFeed$.next([]);
    this.lastError$.next(undefined);
  }
}
