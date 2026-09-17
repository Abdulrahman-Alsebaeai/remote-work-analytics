declare module 'xlsx-populate' {
  interface Cell { value(value: Array<Array<string | number>>): Cell }
  interface Range { style(values: Record<string, string | boolean>): Range }
  interface Column { width(value: number): Column }
  interface Sheet {
    name(value: string): Sheet;
    cell(address: string): Cell;
    range(address: string): Range;
    freezePanes(columns: number, rows: number): Sheet;
    column(name: string): Column;
  }
  interface Workbook { sheet(index: number): Sheet; outputAsync(): Promise<Uint8Array> }
  const XlsxPopulate: { fromBlankAsync(): Promise<Workbook> };
  export default XlsxPopulate;
}
