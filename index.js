const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const rootPath = path.resolve(__dirname);

const date = new Date();
const formatDate = `${
  date.getMonth() + 1
}_${date.getDate()}_${date.getFullYear()}`;

class pg_backup {
  /**
   *  Create private variables for the constructor
   *  Declare the variable at the scope of the class
   *  Variable or Functions start with '#' will consider as private
   */
  #POSTGRES_DATABASE_NAME;
  #POSTGRES_USER;
  #POSTGRES_HOST;
  #POSTGRES_PORT_NUMBER;
  #POSTGRES_PASSWORD;
  #schema_name;
  #baseDir;

  constructor(
    { databaseName, userName, host, port = 5432, password, schema_name = '' },
    baseDir = ''
  ) {
    this.#POSTGRES_DATABASE_NAME = databaseName;
    this.#POSTGRES_USER = userName;
    this.#POSTGRES_HOST = host;
    this.#POSTGRES_PORT_NUMBER = port;
    this.#POSTGRES_PASSWORD = password;
    this.#schema_name = schema_name;
    this.#baseDir = baseDir
      ? path.join(rootPath, `../../${baseDir}/backup_${formatDate}`)
      : path.join(rootPath, `../../backup_${formatDate}`);
  }

  async #createDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async getStoreProcedure() {
    try {
      const client = new Client({
        user: this.#POSTGRES_USER,
        host: this.#POSTGRES_HOST,
        database: this.#POSTGRES_DATABASE_NAME,
        password: this.#POSTGRES_PASSWORD,
        port: this.#POSTGRES_PORT_NUMBER,
      });
      await client.connect();
      console.log(`Processing Started`);
      await this.#createDir(this.#baseDir);
      const getSchemaQuery = {
        text: `select schema_name
from information_schema.schemata where case when $1 = '' then true else schema_name = $1 end ORDER BY schema_name`,
        values: [this.#schema_name],
      };
      const getSchemaResult = await (await client.query(getSchemaQuery)).rows;
      if (getSchemaResult && getSchemaResult.length) {
        await getSchemaResult.reduce(async (previousPromise, value) => {
          await previousPromise;
          const schemaName = value.schema_name;
          const schemaDirPath = `${this.#baseDir}/${schemaName}`;
          await this.#createDir(schemaDirPath);
          const functionDirPath = `${schemaDirPath}/functions`;
          await this.#createDir(functionDirPath);

          // retrieve store procedure and store in file
          const getFunctionQuery = {
            text: `SELECT  proname as "store_procedure_name",  pg_get_function_arguments(p.oid) as "params"
, pg_catalog.pg_get_functiondef(p.oid) as "store_procedure" , nspname as "schema"
FROM    pg_catalog.pg_namespace n
JOIN    pg_catalog.pg_proc p
ON      pronamespace = n.oid
WHERE   nspname = $1`,
            values: [schemaName],
          };
          const getFunctionResult = await client.query(getFunctionQuery);
          const { rowCount: functionRowCount, rows: functionData } =
            await getFunctionResult;
          if (functionData && functionData.length) {
            await functionData.reduce(
              async (previousFunctionPromise, functionValue, functionIndex) => {
                await previousFunctionPromise;
                console.log(
                  `Processing function ${functionIndex + 1}/${functionRowCount}`
                );
                const paramsCount = functionValue.params
                  ? functionValue.params.split(',').length
                  : 0;
                const functionFilePath = `${functionDirPath}/${functionValue.store_procedure_name}_${paramsCount}.sql`;
                if (fs.existsSync(functionFilePath)) {
                  fs.unlinkSync(functionFilePath);
                }
                fs.writeFileSync(
                  functionFilePath,
                  functionValue.store_procedure
                );
              },
              Promise.resolve()
            );
          }
        }, Promise.resolve());
      }
      console.log(`Processing Completed`);
      await client.end();
    } catch (error) {
      console.error(error);
    }
  }

  async getTableStructure() {
    try {
      const client = new Client({
        user: this.#POSTGRES_USER,
        host: this.#POSTGRES_HOST,
        database: this.#POSTGRES_DATABASE_NAME,
        password: this.#POSTGRES_PASSWORD,
        port: this.#POSTGRES_PORT_NUMBER,
      });
      await client.connect();
      console.log(`Processing Started`);
      await this.#createDir(this.#baseDir);
      const getSchemaQuery = {
        text: `select schema_name
from information_schema.schemata where case when $1 = '' then true else schema_name = $1 end ORDER BY schema_name`,
        values: [this.#schema_name],
      };
      const getSchemaResult = await (await client.query(getSchemaQuery)).rows;
      if (getSchemaResult && getSchemaResult.length) {
        await getSchemaResult.reduce(async (previousPromise, value) => {
          await previousPromise;
          const schemaName = value.schema_name;
          const schemaDirPath = `${this.#baseDir}/${schemaName}`;
          await this.#createDir(schemaDirPath);
          const tableDirPath = `${schemaDirPath}/tables`;
          await this.#createDir(tableDirPath);

          // retrieve table structure and store in file
          const getTableQuery = {
            text: `SELECT 'CREATE TABLE ' || pn.nspname || '.' || pc.relname || E'(\n' || string_agg(pa.attname || ' ' || pg_catalog.format_type(pa.atttypid, pa.atttypmod) || coalesce(' DEFAULT ' ||( SELECT pg_catalog.pg_get_expr(d.adbin, d.adrelid) FROM pg_catalog.pg_attrdef d          WHERE d.adrelid = pa.attrelid AND d.adnum = pa.attnum  AND pa.atthasdef ),'') || ' ' ||CASE pa.attnotnull WHEN TRUE THEN 'NOT NULL'
ELSE 'NULL'
END, E',\n') ||
coalesce((SELECT E',\n' || string_agg('CONSTRAINT ' || pc1.conname || ' ' || pg_get_constraintdef(pc1.oid), E',\n' ORDER BY pc1.conindid)
FROM pg_constraint pc1
WHERE pc1.conrelid = pa.attrelid), '') ||
E');' as "create_statement"
, relname as "table_name"
FROM pg_catalog.pg_attribute pa
JOIN pg_catalog.pg_class pc
ON pc.oid = pa.attrelid
JOIN pg_catalog.pg_namespace pn
ON pn.oid = pc.relnamespace
AND pn.nspname = $1
WHERE pa.attnum > 0
AND NOT pa.attisdropped
GROUP BY pn.nspname, pc.relname, pa.attrelid`,
            values: [schemaName],
          };
          const getTableResult = await client.query(getTableQuery);
          const { rowCount: tableRowCount, rows: TableData } =
            await getTableResult;
          if (TableData && TableData.length) {
            await TableData.reduce(
              async (previousTablePromise, tableValue, tableIndex) => {
                await previousTablePromise;
                console.log(
                  `Processing table ${tableIndex + 1}/${tableRowCount}`
                );

                const tableFilePath = `${tableDirPath}/${tableValue.table_name}.sql`;
                if (fs.existsSync(tableFilePath)) {
                  fs.unlinkSync(tableFilePath);
                }
                fs.writeFileSync(tableFilePath, tableValue.create_statement);
              },
              Promise.resolve()
            );
          }
        }, Promise.resolve());
      }
      console.log(`Processing Completed`);
      await client.end();
    } catch (error) {
      console.error(error);
    }
  }
}

module.exports = pg_backup;
