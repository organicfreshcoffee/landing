// Type declarations for Strudel packages
declare module '@strudel/core' {
  export interface Pattern {
    play(): any;
    stop(): any;
  }
}

declare module '@strudel/mini' {
  export function mini(pattern: string): any;
}

declare module '@strudel/web' {
  export function initStrudel(): Promise<void>;
  export function hush(): void;
}

declare module '@strudel/tonal' {
  // Add tonal-specific type declarations if needed
}
