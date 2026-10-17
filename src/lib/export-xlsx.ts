export async function downloadXlsx(filename: string, sheetName: string, rows: unknown[]) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), sheetName.slice(0, 31));
  XLSX.writeFile(book, filename);
}
