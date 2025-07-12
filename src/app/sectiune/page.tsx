"use client";

export default function SectiunePage() {
  const text = typeof window !== "undefined" ? localStorage.getItem("selectedChunk") : "";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">📄 Sectiune Extrasă</h1>
      <div className="whitespace-pre-wrap bg-white p-4 rounded-lg shadow text-base leading-relaxed border">
        {text || "Nu există niciun text de afișat."}
      </div>
    </div>
  );
}
