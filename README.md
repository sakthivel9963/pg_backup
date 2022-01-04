# pg_backup

This will backup the postgres function or store procedure or table create script to separate file for each table and function for all the schema or particular schema.

# Installation

Using npm:

```sh
npm install postgres_backup
```

Using yarn:

```sh
yarn add postgres_backup
```

## Notes

This project will create backup directory at the root of your project folder.

# Example

Initialize the pg_backup

```javascript
const pg_backup = require('postgres_backup');
const pgConfig = {
  databaseName: 'require',
  userName: 'require',
  host: 'require',
  password: 'require',
  schema_name: 'optional',
  port: 'optional',
};
const pgClient = new pg_backup(pgConfig);
```

> **NOTE:** You can pass the directory name as second argument for the the `pg_backup(pgConfig,dirname)`

Get the store-procedure or functions:

```javascript
pgClient.getStoreProcedure();
```

Get the table structure:

```javascript
pgClient.getTableStructure();
```

## License

[MIT](LICENSE)
