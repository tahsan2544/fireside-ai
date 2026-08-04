// File types people can attach in chat — photos plus every common document format.
export const ACCEPTED_UPLOADS = [
  "image/*",
  ".pdf", ".txt", ".md", ".markdown", ".rtf", ".csv", ".tsv", ".json", ".xml",
  ".yml", ".yaml", ".log", ".doc", ".docx", ".odt", ".xls", ".xlsx", ".ods",
  ".ppt", ".pptx", ".odp", ".epub", ".pages", ".numbers", ".key", ".zip",
].join(",");
