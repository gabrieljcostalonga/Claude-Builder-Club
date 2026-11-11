import { describe, expect, it } from "vitest";
import { normalizeSupabaseKey, normalizeSupabaseUrl } from "@/lib/supabase/config";

describe("normalizeSupabaseUrl", () => {
  it.each([
    ["https://abcd1234.supabase.co", "https://abcd1234.supabase.co"],
    ["https://abcd1234.supabase.co/", "https://abcd1234.supabase.co"],
    ["https://abcd1234.supabase.co/rest/v1/", "https://abcd1234.supabase.co"],
    ["https://abcd1234.supabase.co/auth/v1", "https://abcd1234.supabase.co"],
    ["  'https://abcd1234.supabase.co'  ", "https://abcd1234.supabase.co"],
    ["abcd1234.supabase.co", "https://abcd1234.supabase.co"],
    ["https://supabase.com/dashboard/project/abcd1234", "https://abcd1234.supabase.co"],
    ["https://supabase.com/dashboard/project/abcd1234/settings/api", "https://abcd1234.supabase.co"],
    ["http://localhost:54321", "http://localhost:54321"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeSupabaseUrl(input)).toBe(expected);
  });

  it("explica quando está vazia ou inválida", () => {
    expect(() => normalizeSupabaseUrl(undefined)).toThrow(/não definida/);
    expect(() => normalizeSupabaseUrl("   ")).toThrow(/não definida/);
    expect(() => normalizeSupabaseUrl("https://")).toThrow(/inválida/);
  });
});

describe("normalizeSupabaseKey", () => {
  it("remove espaços e aspas e exige valor", () => {
    expect(normalizeSupabaseKey(' "sb_publishable_x" ', "K")).toBe("sb_publishable_x");
    expect(() => normalizeSupabaseKey("", "K")).toThrow(/K não definida/);
  });
});
