import { Client } from 'pg';

// Configuration
const MAX_CHARS = 3000;      // maximum characters per chunk
const MIN_CHARS = 500;       // minimum characters before splitting
const OVERLAP_CHARS = 1000;   // characters of overlap between chunks   // characters of overlap between chunks

/** Parsed row from `nodes` */
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

/**
 * Splits a document's content nodes into chunks without metadata prefixes.
 * Adds overlap of last OVERLAP_CHARS characters into next chunk.
 */
function buildChunks(
  documentId:   number,
  contentNodes: ParsedNode[],
  maxChars:     number,
  minChars:     number
): Chunk[] {
  const chunks: Chunk[] = [];
  let buffer = '';
  let nodeIds: number[] = [];
  let sequenceIdx = 0;
  const structuralLevels = ['titlu','carte','capitol','articol','parte','anexa','semnatura'];

  const flushChunk = () => {
    const text = buffer.trim();
    if (!text) return;
    chunks.push({
      doc_id:       documentId,
      start_node:   nodeIds[0],
      end_node:     nodeIds[nodeIds.length - 1],
      chunk_text:   text,
      sequence_idx: sequenceIdx++,
      token_count:  text.split(/\s+/).length,
    });
  };

  for (let i = 0; i < contentNodes.length; i++) {
    const node = contentNodes[i];
    const text = node.content.trim();
    if (!text) continue;

    // peek next
    const next = contentNodes[i + 1];
    const nextLen = next ? next.content.trim().length : 0;

    // calculate prospective length
    const prospective = buffer.length + (buffer ? 1 : 0) + text.length;

    // decide split: structural boundary
    const isBoundary  = structuralLevels.includes(node.level);
    const canSplit    = buffer.length >= minChars;
    const nextTooSmall= nextLen > 0 && nextLen < minChars;

    if ((isBoundary && canSplit && !nextTooSmall) || prospective > maxChars) {
      // flush current chunk
      flushChunk();

      // prepare overlap
      let overlap = '';
      let overlapIds: number[] = [];
      if (buffer.length > OVERLAP_CHARS) {
        overlap = buffer.slice(-OVERLAP_CHARS);
        // find nodes whose text appears in overlap
        overlapIds = nodeIds.filter(id => {
          const n = contentNodes.find(n => n.id === id)!;
          return overlap.includes(n.content.trim().slice(0, 20));
        });
      } else {
        overlap = buffer;
        overlapIds = [...nodeIds];
      }

      // reset buffer and nodeIds to overlap
      buffer = overlap;
      nodeIds = overlapIds;
    }

    // append this node
    if (buffer) buffer += '\n';
    buffer += text;
    nodeIds.push(node.id);
  }

  // final chunk
  flushChunk();
  return chunks;
}

// Rest of chunkLaws unchanged...
export async function chunkLaws(shouldStop: () => boolean = () => false) {
  console.log('🔄 Starting chunking pass...');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

    // If law_chunks is empty, reset all chunked flags so we can re-run from scratch
  const { rows: countRows } = await client.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM law_chunks;`
  );
  const totalChunks = parseInt(countRows[0].cnt, 10);
  if (totalChunks === 0) {
    console.log('🆕 No existing chunks found; resetting all document.chunked flags.');
    await client.query(`UPDATE documents SET chunked = FALSE;`);
  }

    // Determine resume point: smallest document_id already chunked
  const { rows: chk } = await client.query<{ last_id: number }>(
    `SELECT MIN(id) AS last_id FROM documents WHERE chunked = TRUE;`
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
      `SELECT * FROM nodes WHERE document_id = $1 AND source_class <> 'S_LGI' ORDER BY sort_order;`,
      [documentId]
    );

    const content = nodes.filter(n => n.level !== 'metadata' && n.label !== 'header');
    const chunks = buildChunks(documentId, content, MAX_CHARS, MIN_CHARS);
    console.log(`  → Built ${chunks.length} chunks.`);

    await client.query('BEGIN');
    try {
      const insertSql = `INSERT INTO law_chunks (document_id, start_node_id, end_node_id, chunk_text, sequence_idx, token_count)
      VALUES ($1,$2,$3,$4,$5,$6)`;

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
      await client.query(`UPDATE documents SET chunked = TRUE WHERE id = $1;`, [documentId]);
      await client.query('COMMIT');
      console.log(`  ✅ Document ${documentId} marked chunked.`);
    }  catch {
      await client.query('ROLLBACK');
      console.error(`Document ${documentId} NOT marked chunked due to interruption.`);
      break; 
    }
  }
  await client.end();
  console.log('\n🎉 Chunking pass complete.');
}