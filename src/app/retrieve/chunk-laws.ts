import { Client } from 'pg';

// Configuration
const MAX_CHARS = 5000;      // maximum characters per chunk
const MIN_CHARS = 500;       // minimum characters before splitting
const OVERLAP_CHARS = 800;   // characters of overlap between chunks   // characters of overlap between chunks

/** Parsed row from nodes */
interface ParsedNode {
  id: number;
  document_id: number;
  parent_id: number | null;
  level: string;
  label: string;
  source_class: string;
  content: string;
  sort_order: number;
}

/** What we store per chunk */
interface Chunk {
  doc_id:       number;
  start_node:   number;
  end_node:     number;
  chunk_text:   string;
  sequence_idx: number;
  token_count:  number;
}


// Splits a long text into segments ≤ maxChars, breaking at paragraph or word boundaries.
function splitText(text: string, maxChars: number): string[] {
  const segments: string[] = [];
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p);

  let current = '';
  for (const para of paras) {
    // Can we append this whole paragraph?
    const withPara = current ? current + '\n\n' + para : para;
    if (withPara.length <= maxChars) {
      current = withPara;
    } else {
      // Flush what's in current
      if (current) {
        segments.push(current);
        current = '';
      }
      // Paragraph alone still too big?
      if (para.length <= maxChars) {
        current = para;
      } else {
        // Split paragraph into word‐wise segments
        const words = para.split(/\s+/);
        let seg = '';
        for (const w of words) {
          const withWord = seg ? seg + ' ' + w : w;
          if (withWord.length <= maxChars) {
            seg = withWord;
          } else {
            // Flush the segment
            if (seg) segments.push(seg);
            // If a single word is still too long, hard‐break it
            if (w.length > maxChars) {
              for (let i = 0; i < w.length; i += maxChars) {
                segments.push(w.slice(i, i + maxChars));
              }
              seg = '';
            } else {
              seg = w;
            }
          }
        }
        if (seg) segments.push(seg);
      }
    }
  }
  if (current) segments.push(current);
  return segments;
}


function buildChunks(
  documentId:   number,
  contentNodes: ParsedNode[],
  maxChars:     number,
  minChars:     number
): Chunk[] {
  const chunks: Chunk[] = [];

  // bufferNodes holds {id, text} for each node that has not yet been emitted.
  type NodeEntry = { id: number; text: string };
  let bufferNodes: NodeEntry[] = [];                   // ← CHANGED: used for streaming
  let bufferLen = 0;                                   // ← CHANGED: current length of joined bufferNodes

  let sequenceIdx = 0;
  const structuralLevels = ['titlu','carte','capitol','articol','parte','anexa','semnatura'];

  // Recompute bufferLen from bufferNodes array if needed
  const recomputeBufferLen = () => {
    if (bufferNodes.length === 0) {
      bufferLen = 0;
    } else {
      bufferLen = bufferNodes.reduce((acc, node, i) => {
        // +1 for '\n' between consecutive nodes
        return acc + node.text.length + (i > 0 ? 1 : 0);
      }, 0);
    }
  };

  // Helper to emit exactly the first `n` entries of bufferNodes as one chunk.
  const emitChunkForFront = (n: number) => {
    // Build text from bufferNodes[0..n-1]
    const partText = bufferNodes
      .slice(0, n)
      .map(nent => nent.text)
      .join('\n');

    chunks.push({
      doc_id:       documentId,
      start_node:   bufferNodes[0].id,
      end_node:     bufferNodes[n - 1].id,
      chunk_text:   partText.trim(),
      sequence_idx: sequenceIdx++,
      token_count:  partText.split(/\s+/).length,
    });

    // Remove those first n entries
    bufferNodes = bufferNodes.slice(n);
    recomputeBufferLen();
  };

  // Flush any remaining bufferNodes at the very end (with overlap)
  const flushRemaining = () => {
    if (bufferNodes.length === 0) return;

    // 1) Build fullText from everything in bufferNodes
    const fullText = bufferNodes.map(n => n.text).join('\n');

    // 2) Emit one final chunk
    chunks.push({
      doc_id:       documentId,
      start_node:   bufferNodes[0].id,
      end_node:     bufferNodes[bufferNodes.length - 1].id,
      chunk_text:   fullText.trim(),
      sequence_idx: sequenceIdx++,
      token_count:  fullText.split(/\s+/).length,
    });

    // 3) Compute overlapText from the tail of fullText
    let overlapText = '';
    if (fullText.length > OVERLAP_CHARS) {
      overlapText = fullText.slice(-OVERLAP_CHARS);
    } else {
      overlapText = fullText;
    }

    // 4) Keep only those nodes whose first 20 chars appear in overlapText
    const overlapIds = bufferNodes
      .map(n => n.id)
      .filter(id => {
        const entry = bufferNodes.find(e => e.id === id)!;
        return overlapText.includes(entry.text.slice(0, 20));
      });

    // 5) Reset bufferNodes to only the overlapping nodes (in original order)
    bufferNodes = bufferNodes.filter(n => overlapIds.includes(n.id));
    recomputeBufferLen();
  };

  // Main loop: process each node in order
  for (let i = 0; i < contentNodes.length; i++) {
    const node = contentNodes[i];
    const text = node.content.trim();
    if (!text) continue;

    const next = contentNodes[i + 1];
    const nextLen = next ? next.content.trim().length : 0;

    // 1) If this node’s text alone is longer than maxChars, hard‐split it
    if (text.length > maxChars) {
      // First, if there is anything buffered, try to emit as many full chunks as possible,
      // then leave any overlap for the next round.
      while (bufferNodes.length > 0) {
        // Attempt to pack as many nodes from bufferNodes into a chunk of ≤ maxChars
        let cumLen = 0;
        let countFit = 0;
        for (let j = 0; j < bufferNodes.length; j++) {
          const addLen = (j > 0 ? 1 : 0) + bufferNodes[j].text.length;
          if (cumLen + addLen <= maxChars) {
            cumLen += addLen;
            countFit = j + 1;
          } else {
            break;
          }
        }
        if (countFit === 0) {
          // Somehow the first buffered node itself exceeds maxChars; but we know none of these
          // are > maxChars because we only push smaller nodes—so we can break.
          break;
        }
        // Emit those countFit nodes
        emitChunkForFront(countFit);
      }
      // After that loop, do final overlap of whatever remains
      flushRemaining();

      // Now split this oversized node by itself
      const parts = splitText(text, maxChars);
      for (const part of parts) {
        chunks.push({
          doc_id:       documentId,
          start_node:   node.id,
          end_node:     node.id,
          chunk_text:   part.trim(),
          sequence_idx: sequenceIdx++,
          token_count:  part.split(/\s+/).length,
        });
      }

      // Clear buffer entirely—no overlap carries over from within a single-node split
      bufferNodes = [];
      bufferLen = 0;
      continue;
    }

    // 2) If this node is structural and we already have ≥ minChars buffered, and next is not too small,
    //    emit as many full‐capacity chunks as possible before appending
    const isStructural = structuralLevels.includes(node.level);
    const canSplitHere = bufferLen >= minChars;
    const nextTooSmall = nextLen > 0 && nextLen < minChars;
    if (isStructural && canSplitHere && !nextTooSmall) {
      // As long as bufferNodes has enough to emit a chunk (≤ maxChars), do so:
      while (bufferNodes.length > 0) {
        let cumLen = 0;
        let countFit = 0;
        for (let j = 0; j < bufferNodes.length; j++) {
          const addLen = (j > 0 ? 1 : 0) + bufferNodes[j].text.length;
          if (cumLen + addLen <= maxChars) {
            cumLen += addLen;
            countFit = j + 1;
          } else {
            break;
          }
        }
        if (countFit === 0) break;
        emitChunkForFront(countFit);
      }
      flushRemaining();
    }

    // 3) If appending this node would exceed maxChars, emit as many full‐capacity chunks from bufferNodes as possible
    const sep = bufferNodes.length > 0 ? 1 : 0;
    const nodeTotalLen = sep + text.length;
    if (bufferLen + nodeTotalLen > maxChars) {
      // Emit full‐capacity chunks from bufferNodes until there's room
      while (bufferNodes.length > 0) {
        let cumLen = 0;
        let countFit = 0;
        for (let j = 0; j < bufferNodes.length; j++) {
          const addLen = (j > 0 ? 1 : 0) + bufferNodes[j].text.length;
          if (cumLen + addLen <= maxChars) {
            cumLen += addLen;
            countFit = j + 1;
          } else {
            break;
          }
        }
        if (countFit === 0) break;
        emitChunkForFront(countFit);
      }
      flushRemaining();
    }

    // 4) Now we can append this node safely (bufferLen + nodeTotalLen ≤ maxChars)
    bufferNodes.push({ id: node.id, text });
    if (bufferLen > 0) {
      bufferLen += 1 + text.length;
    } else {
      bufferLen += text.length;
    }
  }

  // 5) Finally, if any nodes remain, flush them (with overlap)
  flushRemaining();

 // ─── POST-PROCESS: ADD OVERLAP_CHARS FROM PREVIOUS CHUNK ───────────────────
  for (let i = 1; i < chunks.length; i++) {
    // Only overlap if it’s the same document_id
    if (chunks[i].doc_id === chunks[i - 1].doc_id) {
      const prevText = chunks[i - 1].chunk_text;

      // Take the last OVERLAP_CHARS chars (or the entire prevText if shorter)
      // 1) Compute where the last OVERLAP_CHARS would begin
      const rawStart = Math.max(0, prevText.length - OVERLAP_CHARS);

      // 2) Find the next space after rawStart (so we don’t cut a word)
      let sliceStart = rawStart;
      const nextSpace = prevText.indexOf(' ', rawStart);
      if (nextSpace !== -1) {
        sliceStart = nextSpace + 1;
      }

      // 3) Extract overlapText from the chosen boundary
      const overlapText = prevText.slice(sliceStart);


      // Prepend overlap + newline to the current chunk’s text
      const original = chunks[i].chunk_text;
      const newText = overlapText + "\n" + original;
      chunks[i].chunk_text = newText;

      // Recompute token_count from the updated text
      chunks[i].token_count = newText.trim().split(/\s+/).length;
    }
  }

  return chunks;
}

// Rest of chunkLaws unchanged...
export async function chunkLaws(shouldStop: () => boolean = () => false) {
  console.log(`🔄 Starting chunking pass...`);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

    // If law_chunks is empty, reset all chunked flags so we can re-run from scratch
const { rows: countRows } = await client.query<{ cnt: string }>(
  `SELECT COUNT(*)::text AS cnt
  FROM law_chunks;`
);

  const totalChunks = parseInt(countRows[0].cnt, 10);
  if (totalChunks === 0) {
    console.log(`🆕 No existing chunks found; resetting all document.chunked flags.`);
    await client.query(
      `UPDATE documents
      SET chunked = FALSE;`
    );

  }

    // Determine resume point: smallest document_id already chunked
    const { rows: chk } = await client.query<{ last_id: number }>(
    `SELECT MIN(id) AS last_id
      FROM documents
      WHERE chunked = TRUE;`
    );


  const lastChunked = chk[0].last_id;

  // Compute resumePoint: one below the smallest chunked ID, or highest if none
  let resumePoint: number;
  if (lastChunked == null) {
    const { rows: maxDoc } = await client.query<{ max_id: number }>(
      `SELECT MAX(id) AS max_id FROM documents;`
    );
    resumePoint = maxDoc[0].max_id;
  } else {
    resumePoint = lastChunked - 1;
  }
  console.log(`🔢 Resuming from document ID ${resumePoint}`);

  const { rows: docs } = await client.query<{ id: number }>(
    `SELECT id
      FROM documents
     WHERE id <= $1
       AND (chunked = FALSE OR chunked IS NULL)
     ORDER BY id DESC;`,
    [resumePoint]
  );
  console.log(`📑 ${docs.length} documents queued for chunking.`);

  for (const { id: documentId } of docs) {
    console.log(`\n⏳ Chunking document ${documentId}…`);

    const { rows: nodes } = await client.query<ParsedNode>(
      `SELECT *
      FROM nodes
      WHERE document_id = $1
      AND source_class <> 'S_LGI'
      ORDER BY sort_order;`,
      [documentId]
    );

    const content = nodes.filter(n => n.level !== 'metadata' && n.label !== 'header');
    const chunks = buildChunks(documentId, content, MAX_CHARS, MIN_CHARS);
    console.log("  → Built ${chunks.length} chunks.");

    await client.query('BEGIN');
    try {
    const insertSql = `
    INSERT INTO law_chunks (
      document_id,
      start_node_id,
      end_node_id,
      chunk_text,
      sequence_idx,
      token_count
      )
    VALUES ($1,$2,$3,$4,$5,$6);`;


      for (const c of chunks) {
        if (shouldStop()) throw new Error('Aborted');
        await client.query(insertSql, [
          c.doc_id,
          c.start_node,
          c.end_node,
          c.chunk_text,
          c.sequence_idx,
          c.token_count
        ]);
      }
    await client.query(
      `UPDATE documents
      SET chunked = TRUE
      WHERE id = $1;`,
      [documentId]
    );
      await client.query('COMMIT');
      console.log(`✅ Document ${documentId} marked chunked.`);
    }  catch {
      await client.query('ROLLBACK');
      console.error(`Document ${documentId} NOT marked chunked due to interruption.`);
      break; 
    }
  }
  await client.end();
  console.log('\n🎉 Chunking pass complete.');
}