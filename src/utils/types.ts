export interface Dispatch<T> {
  (value: T): void;
}

export interface Action {
  (): void;
}
