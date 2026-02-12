// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />

declare module 'tablesort' {
  interface TablesortOptions {
    descending?: boolean;
    sortAttribute?: string;
  }
  function Tablesort(el: HTMLTableElement, options?: TablesortOptions): { refresh(): void };
  export = Tablesort;
}
