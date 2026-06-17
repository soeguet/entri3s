export interface TemplatePayload {
  durationMinutes: number;
  notes: string | null;
  tagIds: number[];
}

export function parsePayload(json: string): TemplatePayload {
  try {
    const p = JSON.parse(json) as Partial<TemplatePayload>;
    return {
      durationMinutes: p.durationMinutes ?? 60,
      notes: p.notes ?? null,
      tagIds: Array.isArray(p.tagIds) ? p.tagIds : [],
    };
  } catch {
    return { durationMinutes: 60, notes: null, tagIds: [] };
  }
}

export function buildPayload(p: TemplatePayload): string {
  return JSON.stringify(p);
}
