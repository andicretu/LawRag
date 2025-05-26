import { Client } from 'pg';

// Configuration
const MAX_CHARS = 3000;      // maximum characters per chunk
const MIN_CHARS = 500;       // minimum characters before splitting

interface ParsedNode {
  id: number;
  doc_id: number;
  parent_id: number | null;
  level: string;    // structural or content level
  label: string;    // header, content, metadata
  source_class: string; // parser source class tag
  text: string;
  seq: number;
}

interface Chunk {
  doc_id: number;
  start_node: number;
  end_node: number;
  chunk_text: string;
  node_ids: number[];
  node_tags: string[];
  node_offsets: [number, number][];
  sequence_index: number;
  token_count: number;
}

/**
 * Build chunks from content nodes, with metadata/header prefix injected.
 * Rolls back the last element if adding a new node would exceed MAX_CHARS.
 */
function buildChunks(
  contentNodes: ParsedNode[],
  prefixNodes: ParsedNode[],
  maxChars: number,
  minChars: number
): Chunk[] {
  const chunks: Chunk[] = [];

  // Prepare prefix buffer (metadata + headers)
  let prefixBuffer = '';
  const prefixNodeIds: number[] = [];
  const prefixNodeTags: string[] = [];
  const prefixNodeOffsets: [number, number][] = [];
  let cursor = 0;

  for (const node of prefixNodes) {
    const text = node.text.trim();
    if (!text) continue;
    if (prefixBuffer.length > 0) prefixBuffer += '\n';
    const start = cursor;
    prefixBuffer += text;
    cursor += text.length;
    const end = cursor;
    prefixNodeIds.push(node.id);
    prefixNodeTags.push(node.level);
    prefixNodeOffsets.push([start, end]);
  }
  prefixBuffer += '\n'; // end prefix

  let buffer = '';
  let nodeIds = [...prefixNodeIds];
  let nodeTags = [...prefixNodeTags];
  let nodeOffsets = [...prefixNodeOffsets];
  let sequenceIdx = 0;

  const structuralLevels = ['titlu', 'carte', 'capitol', 'articol', 'parte', 'anexa', 'semnatura'];

  for (let i = 0; i < contentNodes.length; i++) {
    const node = contentNodes[i];
    const text = node.text.trim();
    if (!text) continue;

    // Peek at next node size
    const nextNode = contentNodes[i + 1];
    const nextTextLen = nextNode ? nextNode.text.trim().length : 0;

    // Determine if we should split before this node
    const isBoundary = structuralLevels.includes(node.level);
    const bufferLen = buffer.length;
    const canSplitNow = bufferLen >= minChars;
    const nextTooSmall = nextTextLen > 0 && nextTextLen < minChars;

    if (isBoundary && canSplitNow && !nextTooSmall) {
      // emit current chunk
      const chunkText = prefixBuffer + buffer;
      chunks.push({
        doc_id: prefixNodes[0].doc_id,
        start_node: nodeIds[0],
        end_node: nodeIds[nodeIds.length - 1],
        chunk_text: chunkText,
        node_ids: [...nodeIds],
        node_tags: [...nodeTags],
        node_offsets: [...nodeOffsets],
        sequence_index: sequenceIdx++,
        token_count: chunkText.split(/\s+/).length,
      });
      // reset for next chunk
      buffer = '';
      nodeIds = [...prefixNodeIds];
      nodeTags = [...prefixNodeTags];
      nodeOffsets = [...prefixNodeOffsets];
      cursor = prefixBuffer.length;
    }

    // Hard max split with rollback of last element
    if (buffer.length + text.length > maxChars) {
      // Roll back the last appended element
      let rollbackNode: ParsedNode | null = null;
      let rollbackText = '';
      if (nodeIds.length > prefixNodeIds.length) {
        const lastIndex = nodeIds.length - 1;
        const lastNodeId = nodeIds[lastIndex];
        const [lastStart, lastEnd] = nodeOffsets[lastIndex];
        rollbackText = buffer.slice(lastStart, lastEnd);
        rollbackNode = contentNodes.find(n => n.id === lastNodeId) || null;
        buffer = buffer.slice(0, lastStart);
        nodeIds.pop();
        nodeTags.pop();
        nodeOffsets.pop();
      }
      // emit chunk without overflow element
      const chunkText = prefixBuffer + buffer;
      chunks.push({
        doc_id: prefixNodes[0].doc_id,
        start_node: nodeIds[0],
        end_node: nodeIds[nodeIds.length - 1],
        chunk_text: chunkText,
        node_ids: [...nodeIds],
        node_tags: [...nodeTags],
        node_offsets: [...nodeOffsets],
        sequence_index: sequenceIdx++,
        token_count: chunkText.split(/\s+/).length,
      });
      // reset for next chunk and re-inject rolled-back node
      buffer = '';
      nodeIds = [...prefixNodeIds];
      nodeTags = [...prefixNodeTags];
      nodeOffsets = [...prefixNodeOffsets];
      cursor = prefixBuffer.length;
      if (rollbackNode) {
        const delim = buffer.length > 0 ? '\n' : '';
        const startOff = cursor + delim.length;
        buffer += delim + rollbackText;
        cursor = startOff + rollbackText.length;
        const endOff = cursor;
        nodeIds.push(rollbackNode.id);
        nodeTags.push(rollbackNode.level);
        nodeOffsets.push([startOff, endOff]);
      }
    }

    // Append current node text
    const delim = buffer.length > 0 ? '\n' : '';
    const startOffset = buffer.length === 0
      ? cursor = prefixBuffer.length
      : cursor;
    const chunkableText = delim + text;
    buffer += chunkableText;
    const endOffset = (startOffset) + chunkableText.length;
    nodeIds.push(node.id);
    nodeTags.push(node.level);
    nodeOffsets.push([startOffset, endOffset]);
  }

  // Final chunk if any content remains
  if (buffer.trim()) {
    const chunkText = prefixBuffer + buffer;
    chunks.push({
      doc_id: prefixNodes[0].doc_id,
      start_node: nodeIds[0],
      end_node: nodeIds[nodeIds.length - 1],
      chunk_text: chunkText,
      node_ids: [...nodeIds],
      node_tags: [...nodeTags],
      node_offsets: [...nodeOffsets],
      sequence_index: sequenceIdx,
      token_count: chunkText.split(/\s+/).length,
    });
  }

  return chunks;
}

/**
 * Main runner: fetch parsed nodes, filter out S_LGI, chunk them, and insert into law_chunks.
 */
export async function chunkLaws() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Fetch all parsed nodes ordered by doc and sequence
  const res = await client.query<ParsedNode>(`
    SELECT id, document_id, parent_id, level, label, source_class, content, sort_order
    FROM nodes
    ORDER BY document_id, sort_order;
  `);

  // Group nodes by document, skipping source_class S_LGI
  const docs = new Map<number, ParsedNode[]>();
  for (const node of res.rows) {
    if (node.source_class === 'S_LGI') continue;
    if (!docs.has(node.doc_id)) docs.set(node.doc_id, []);
    docs.get(node.doc_id)!.push(node);
  }

  // Clear existing chunks
  await client.query(`TRUNCATE TABLE law_chunks;`);

  for (const [docId, nodes] of docs) {
    // Identify metadata and header nodes as prefix
    const prefixNodes = nodes.filter(n =>
      n.level === 'metadata' || n.label === 'header'
    );
    // Remaining nodes are content
    const contentNodes = nodes.filter(n =>
      n.level !== 'metadata' && n.label !== 'header'
    );

    const chunks = buildChunks(contentNodes, prefixNodes, MAX_CHARS, MIN_CHARS);

    // Insert chunks into database
    for (const chunk of chunks) {
      await client.query(
        `INSERT INTO law_chunks
          (document_id, start_node, end_node, chunk_text, node_ids, node_tags, node_offsets, sequence_index, token_count)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          chunk.doc_id,
          chunk.start_node,
          chunk.end_node,
          chunk.chunk_text,
          JSON.stringify(chunk.node_ids),
          JSON.stringify(chunk.node_tags),
          JSON.stringify(chunk.node_offsets),
          chunk.sequence_index,
          chunk.token_count,
        ]
      );
    }
    console.log(`Inserted ${chunks.length} chunks for document_id=${docId}`);
  }

  await client.end();
  console.log('Chunking completed.');
}

