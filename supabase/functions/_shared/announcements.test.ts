import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { announcementMatchesClass } from "./announcements.ts";

Deno.test("an all-classes announcement reaches every parent", () => {
  assertEquals(announcementMatchesClass(null, "Primary 3"), true);
});

Deno.test("a class announcement reaches that class", () => {
  assertEquals(announcementMatchesClass("Primary 3", "Primary 3"), true);
});

Deno.test("a class announcement does not reach another class", () => {
  assertEquals(announcementMatchesClass("Senior 2", "Primary 3"), false);
});
