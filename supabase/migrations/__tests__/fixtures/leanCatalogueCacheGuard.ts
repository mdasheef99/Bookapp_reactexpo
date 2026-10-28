// 02b section 12: M84 declares nullable cache provenance; only M85 writes it.
export function assertM84CacheProvenanceUnwritten(sql: string) {
  const table = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?marketplace_sec\.phase9_catalogue_lookup_effects\b[\s\S]*?;/iu)?.[0] ?? '';
  for (const column of ['cache_entry_id','cache_payload_digest']) {
    expect(table).toMatch(new RegExp(`\\b${column}\\b`, 'iu'));
    const declaration = table.match(new RegExp(`\\b${column}\\b[^,;]*`, 'iu'))?.[0] ?? '';
    expect(declaration).not.toMatch(/\b(?:NOT\s+NULL|GENERATED|DEFAULT\b(?!\s+NULL\b))/iu);
    // Section 12: M84 defines nullable provenance; only M85 writes it.
    expect(sql.replace(table,'')).not.toMatch(new RegExp(`\\b${column}\\b`, 'iu'));
  }
  for (const insert of sql.matchAll(/INSERT\s+INTO\s+marketplace_sec\.phase9_catalogue_lookup_effects\b([\s\S]*?);/giu))
    expect(insert[1]).toMatch(/^\s*(?:AS\s+\w+\s*)?\(/iu); // no positional INSERT can populate cache columns
}
