import { describe, expect, it } from "vitest";
import { parseFamilyTags } from "@/domain/tags/parseTags";

describe("parseFamilyTags", () => {
  it("parses tags case-insensitively and cleans the title", () => {
    const result = parseFamilyTags({ title: "[fix] Fußball [Kind1] [PACKEN]!" });
    expect(result.cleanTitle).toBe("Fußball");
    expect(result.rigidity).toBe("fixed");
    expect(result.personKeys).toEqual(["KIND1"]);
    expect(result.importance).toBe("important");
    expect(result.needsPackingPreparation).toBe(true);
    expect(result.preparationNotes).toBe("Tasche packen");
  });

  it("reads tags from descriptions and ignores unknown tags", () => {
    const result = parseFamilyTags({ title: "Spielplatz", description: "[optional] [alle] [unbekannt]" });
    expect(result.cleanTitle).toBe("Spielplatz");
    expect(result.rigidity).toBe("optional");
    expect(result.appliesToAll).toBe(true);
    expect(result.unknownTags).toEqual(["UNBEKANNT"]);
  });

  it("uses the highest rigidity when conflicting tags are present", () => {
    const result = parseFamilyTags({ title: "[optional] [flex] [fix] Arzt" });
    expect(result.rigidity).toBe("fixed");
  });
});
