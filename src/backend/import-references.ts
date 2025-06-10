import fs from "fs";
import { Pool } from "pg";

// PostgreSQL connection configuration
const pool = new Pool({
  user: "andicretu",
  host: "localhost",
  database: "lawrag",
  password: "password",
  port: 5432,
});

// Path to the JSON file
const filePath = "LAWRAG/src/app/output/references-stub.json";

// Type Definition for Reference
interface Reference {
  sourceDetaliiId: number;
  referenceType: string;
  targetCodeText: string;
  sectionLabel?: string;
}

// Type Map (raw types to ENUM values)
const typeMap: Record<string, string> = {
  "MODIFICAT DE": "is_modified_by",
  "COMPLETAT DE": "is_completed_by",
  "ABROGAT DE": "is_abrogated_by",
  "ABROGA": "abrogates",
  "REFERA PE": "refers_to",
  "REFERIT DE": "is_referred_by",
  "ACTUALIZEAZA PE": "updates",
  "SUSPENDAT DE": "is_suspended_by",
  "SUSPENDA": "suspends",
  "RECTIFICAT DE": "is_corrected_by",
  "RECTIFICA": "corrects",
  "ARE LEGATURA CU": "refers_to",
  "REFERIRE LA": "refers_to",
  
  "is_modified_by": "is_modified_by",
  "is_completed_by": "is_completed_by",
  "is_abrogated_by": "is_abrogated_by",
  "abrogates": "abrogates",
  "refers_to": "refers_to",
  "is_referred_by": "is_referred_by",
  "updates": "updates",
  "is_suspended_by": "is_suspended_by",
  "suspends": "suspends",
  "is_corrected_by": "is_corrected_by",
  "corrects": "corrects"
};

// Maximum PostgreSQL parameter limit (32767) and per row parameter count (4)
const MAX_PARAMETERS = 32767;
const PARAMETERS_PER_ROW = 4;
const MAX_TEXT_LENGTH = 255; // Limit for VARCHAR(255)

// Function to insert a batch of references into the database
async function insertReferenceBatch(batch: Reference[]) {
  const totalParams = batch.length * PARAMETERS_PER_ROW;

  if (totalParams > MAX_PARAMETERS) {
    const safeBatchSize = Math.floor(MAX_PARAMETERS / PARAMETERS_PER_ROW);
    console.warn(`⚠️ Batch size exceeds parameter limit. Splitting into smaller batches of ${safeBatchSize}.`);
    
    for (let i = 0; i < batch.length; i += safeBatchSize) {
      await insertReferenceBatch(batch.slice(i, i + safeBatchSize));
    }
    return;
  }

  const queryText = `
    INSERT INTO legal_references (source_detalii_id, reference_type, target_code_text, section_label)
    VALUES ${batch
      .map((_, index) => 
        `($${index * PARAMETERS_PER_ROW + 1}, $${index * PARAMETERS_PER_ROW + 2}, $${index * PARAMETERS_PER_ROW + 3}, $${index * PARAMETERS_PER_ROW + 4})`
      ).join(", ")}
  `;

  const values = batch.flatMap(reference => [
    reference.sourceDetaliiId,
    typeMap[reference.referenceType] || "refers_to",
    reference.targetCodeText.slice(0, MAX_TEXT_LENGTH), // Truncate if too long
    reference.sectionLabel ? reference.sectionLabel.slice(0, MAX_TEXT_LENGTH) : undefined // Truncate if too long
  ]);

  await pool.query(queryText, values);
}

// Function to check database connection
async function checkDatabaseConnection() {
  try {
    const client = await pool.connect();
    console.log("✅ Database connection established.");
    client.release();
  } catch (error) {
    console.error("❌ Failed to connect to the database. Please check your connection settings.");
    console.error(`Error Details: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Main function to read the JSON file and insert references in bulk
async function migrateReferences() {
  await checkDatabaseConnection(); // Ensure DB is connected

  try {
    const data = fs.readFileSync(filePath, "utf-8");
    const references: Reference[] = JSON.parse(data);
    console.log(`Found ${references.length} references. Migrating in batches...`);

    let batch: Reference[] = [];
    for (const reference of references) {
      if (typeof reference.referenceType !== "string") {
        console.error(`❌ Invalid reference type: ${JSON.stringify(reference.referenceType)}`);
        continue;
      }

      const mappedType = typeMap[reference.referenceType];

      if (!mappedType) {
        console.warn(`Unknown reference type: ${reference.referenceType} - Defaulting to "refers_to"`);
      }

      batch.push({
        sourceDetaliiId: reference.sourceDetaliiId,
        referenceType: mappedType || "refers_to",
        targetCodeText: reference.targetCodeText.slice(0, MAX_TEXT_LENGTH),
        sectionLabel: reference.sectionLabel ? reference.sectionLabel.slice(0, MAX_TEXT_LENGTH) : undefined
      });

      if (batch.length >= 1000) {
        await insertReferenceBatch(batch);
        console.log(`✅ Inserted batch of ${batch.length} references.`);
        batch = [];
      }
    }

    // Insert any remaining references in the last batch
    if (batch.length > 0) {
      await insertReferenceBatch(batch);
      console.log(`✅ Inserted last batch of ${batch.length} references.`);
    }

    console.log("✅ Migration completed successfully.");
  } catch (error) {
    console.error("❌ Error migrating references:", error);
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateReferences();
