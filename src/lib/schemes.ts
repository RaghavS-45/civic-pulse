import { SchemeSchema, type Scheme } from "../types";
import centralSectorScholarship from "../../data/schemes/central-sector-scholarship.json";
import pmVishwakarma from "../../data/schemes/pm-vishwakarma.json";
import pmKisan from "../../data/schemes/pm-kisan.json";
import atalPensionYojana from "../../data/schemes/atal-pension-yojana.json";
import sukanyaSamriddhi from "../../data/schemes/sukanya-samriddhi.json";

// Only hand-verified schemes go here. Add a line after verifying a new data/schemes/<id>.json
const VERIFIED = [pmVishwakarma, pmKisan, atalPensionYojana, sukanyaSamriddhi, centralSectorScholarship];

export const SCHEMES: Scheme[] = VERIFIED.map((s) => SchemeSchema.parse(s));

export function getScheme(id: string): Scheme | undefined {
  return SCHEMES.find((s) => s.id === id);
}

export function clauseCount(s: Scheme): number {
  return s.benefits.length + s.eligibility.length + s.exclusions.length;
}
