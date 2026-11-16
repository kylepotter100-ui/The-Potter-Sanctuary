import { describe, it, expect } from "vitest";
import { csvCell } from "@/lib/csv";

describe("csvCell", () => {
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://x\",\"y\")")).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(csvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(1)")).toBe("'@SUM(1)");
  });
  it("leaves ordinary values alone and quotes delimiters", () => {
    expect(csvCell("Jane")).toBe("Jane");
    expect(csvCell(50)).toBe("50");
    expect(csvCell("Smith, Jane")).toBe('"Smith, Jane"');
    expect(csvCell(null)).toBe("");
  });
});
