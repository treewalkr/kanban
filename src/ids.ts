const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"; // no 0/O/1/I/l — CLI-friendly

export function newId(len = 5): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "lane"
  );
}
