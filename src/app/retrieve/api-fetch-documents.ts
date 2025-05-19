import dotenv from 'dotenv';
import axios from 'axios';
import { Pool } from 'pg';
import { createClientAsync, Client as SoapClient } from 'soap';
import { parseStringPromise, processors } from 'xml2js';

// Load environment variables
dotenv.config();

// Configuration
const {
  SOAP_WSDL_URL,
  SOAP_ENDPOINT = SOAP_WSDL_URL ? SOAP_WSDL_URL.replace('?wsdl', '/SOAP') : undefined,
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DEBUG = 'false',
  SEARCH_OPERATION = 'Search',
} = process.env;

if (!SOAP_WSDL_URL || !SOAP_ENDPOINT) {
  throw new Error('Missing SOAP_WSDL_URL or SOAP_ENDPOINT in environment');
}

// Database pool setup
const pool = new Pool({
  host: DB_HOST,
  port: Number(DB_PORT || 5432),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
});

// Exported search criteria type
export type SearchCriteria = Record<string, unknown>;

interface RawLegisDocument {
  Url: string;
  Titlu: string;
  TipAct: string;
  Emitent: string;
  DataPublicare: string;
  Text: string;
}

interface Document {
  url: string;
  title: string;
  type: string;
  emitent: string;
  publicationDate: Date;
  text: string;
}
 //Safely access nested properties
 function getAt<T>(obj: unknown, path: Array<string | number>): T | undefined {
  return path.reduce<unknown | undefined>((acc, key) => {
    if (
      acc &&
      typeof acc === 'object' &&
      ((typeof key === 'string' && key in acc) ||
        (typeof key === 'number' && Array.isArray(acc) && acc[key] != null))
    ) {
      return (acc as Record<string | number, unknown>)[key];
    }
    return undefined;
  }, obj) as T | undefined;
}

/**
 * Parse XML string into JS object with normalized tags
 */
async function parseXml(xml: string): Promise<unknown> {
  return parseStringPromise(xml, {
    tagNameProcessors: [processors.stripPrefix],
    explicitArray: false,
    mergeAttrs: true,
    trim: true,
  });
}

/**
 * Fetch authentication token from SOAP service
 */
async function getToken(client: SoapClient): Promise<string> {
  const [result] = await client.GetTokenAsync({});
  const token = (result as { GetTokenResult?: string }).GetTokenResult;
  if (!token) throw new Error('Empty token received from SOAP service');
  if (DEBUG === 'true') console.debug('Received token:', token);
  return token;
}

type SearchMethod = (args: { token: string } & SearchCriteria) => Promise<unknown[]>;
type ExtendedSoapClient = SoapClient & Record<string, SearchMethod>;

/**
 * Perform search with token and return parsed documents
 */
async function searchLegislation(
  client: SoapClient,
  token: string,
  criteria: SearchCriteria
): Promise<Document[]> {
  const methodName = `${SEARCH_OPERATION}Async`;
  const extendedClient = client as ExtendedSoapClient;
  const soapMethod = extendedClient[methodName];
  if (typeof soapMethod !== 'function') {
    throw new Error(`SOAP method ${methodName} not found on client`);
  }

  let responseXml: string;
  try {
    const [result] = await soapMethod({ token, ...criteria });
    const resultKey = `${SEARCH_OPERATION}Result`;
    responseXml =
      (result as Record<string, string>)[resultKey] ||
      (result as Record<string, string>)['SearchResult'];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`SOAP ${methodName} failed:`, msg);
    throw new Error(`SOAP ${SEARCH_OPERATION} failed: ${msg}`);
  }

  const parsed = await parseXml(responseXml);
  const rawList =
    getAt<RawLegisDocument[]>(parsed, [
      'Envelope',
      'Body',
      `${SEARCH_OPERATION}Response`,
      `${SEARCH_OPERATION}Result`,
      'Legi',
      'Lega',
    ]) ||
    getAt<RawLegisDocument[]>(parsed, [
      'Envelope',
      'Body',
      `${SEARCH_OPERATION}Response`,
      `${SEARCH_OPERATION}Result`,
      'Legi',
    ]);

  const items: RawLegisDocument[] = rawList ?? [];
  if (items.length === 0) {
    throw new Error('No <Legi> elements found in SOAP response');
  }

  return items.map((raw) => ({
    url: raw.Url,
    title: raw.Titlu,
    type: raw.TipAct,
    emitent: raw.Emitent,
    publicationDate: new Date(raw.DataPublicare),
    text: raw.Text,
  }));
}

/**
 * Save documents into Postgres
 */
async function saveDocuments(docs: Document[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertText = `
      INSERT INTO documents(
        url, title, type, emitent, publication_date, text
      ) VALUES($1, $2, $3, $4, $5, $6)
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        type = EXCLUDED.type,
        emitent = EXCLUDED.emitent,
        publication_date = EXCLUDED.publication_date,
        text = EXCLUDED.text;
    `;
    for (const doc of docs) {
      await client.query(insertText, [
        doc.url,
        doc.title,
        doc.type,
        doc.emitent,
        doc.publicationDate,
        doc.text,
      ]);
    }
    await client.query('COMMIT');
    if (DEBUG === 'true') console.debug(`Saved ${docs.length} document(s)`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Main fetching flow
 */
export async function fetchFromApi(criteria: SearchCriteria): Promise<void> {
  try {
    const soapClient = await createClientAsync(
        process.env.SOAP_WSDL_URL!,
        { endpoint: process.env.SOAP_ENDPOINT! }
    );
    const token = await getToken(soapClient);
    const documents = await searchLegislation(soapClient, token, criteria);
    if (documents.length) {
      await saveDocuments(documents);
    } else {
      console.warn('No documents found for given criteria');
    }
  } catch (err) {
    console.error('Error in fetchFromApi:', err instanceof Error ? err.message : err);
    throw err;
  } finally {
    await pool.end();
  }
}

/**
 * Optional utility to download and save WSDL locally
 */
export async function saveWsdlLocally(path: string = './service.wsdl'): Promise<void> {
  const fs = await import('fs/promises');
  const { data } = await axios.get<string>(SOAP_WSDL_URL!, { responseType: 'text' });
  await fs.writeFile(path, data, 'utf-8');
  if (DEBUG === 'true') console.debug(`WSDL saved to ${path}`);
}
