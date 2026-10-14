// Creates the FICTITIOUS demo database on SQL Server (used by CI tests).
// Env: MSSQL_ADMIN_HOST, MSSQL_ADMIN_PORT, MSSQL_ADMIN_PASSWORD (sa), DEMO_DB_PASSWORD.
import sql from "mssql"

const config = {
  server: process.env.MSSQL_ADMIN_HOST ?? "127.0.0.1",
  port: Number(process.env.MSSQL_ADMIN_PORT ?? 1433),
  user: process.env.MSSQL_ADMIN_USER ?? "sa",
  password: process.env.MSSQL_ADMIN_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
}
const roPassword = process.env.MSSQL_RO_PASSWORD ?? "Demo_ro_local1"

const master = await sql.connect({ ...config, database: "master" })
await master.request().batch(`
  IF DB_ID('sqlboard_demo') IS NULL CREATE DATABASE sqlboard_demo;
  IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'sqlboard_ro')
    CREATE LOGIN sqlboard_ro WITH PASSWORD = '${roPassword}', CHECK_POLICY = OFF;
`)
await master.close()

const db = await new sql.ConnectionPool({ ...config, database: "sqlboard_demo" }).connect()
await db.request().batch(`
  IF OBJECT_ID('dbo.pedidos') IS NOT NULL DROP TABLE dbo.pedidos;
  IF OBJECT_ID('dbo.clientes') IS NOT NULL DROP TABLE dbo.clientes;
  CREATE TABLE dbo.clientes (id int PRIMARY KEY, nome nvarchar(120) NOT NULL, uf char(2) NOT NULL, data_cadastro date NOT NULL);
  CREATE TABLE dbo.pedidos (
    id int PRIMARY KEY, cliente_id int NOT NULL REFERENCES dbo.clientes(id),
    data_pedido datetime2 NOT NULL, status nvarchar(20) NOT NULL,
    total decimal(12,2) NOT NULL, codigo_grande bigint NOT NULL
  );
  CREATE INDEX pedidos_data_idx ON dbo.pedidos(data_pedido);
  IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'sqlboard_ro')
    CREATE USER sqlboard_ro FOR LOGIN sqlboard_ro;
  ALTER ROLE db_datareader ADD MEMBER sqlboard_ro;
`)
const ufs = ["CE", "SP", "RJ", "MG"]
const status = ["entregue", "enviado", "pago", "cancelado"]
for (let n = 1; n <= 100; n++) {
  await db.request()
    .input("id", sql.Int, n)
    .input("nome", sql.NVarChar, `Cliente ${n}`)
    .input("uf", sql.Char(2), ufs[n % 4])
    .input("d", sql.Date, new Date(Date.UTC(2024, 2, 1 + (n % 28))))
    .query("INSERT INTO dbo.clientes VALUES (@id, @nome, @uf, @d)")
}
for (let n = 1; n <= 200; n++) {
  await db.request()
    .input("id", sql.Int, n)
    .input("c", sql.Int, 1 + ((n * 13) % 100))
    .input("d", sql.DateTime2, new Date(Date.UTC(2025, n % 9, 1 + (n % 28), 10)))
    .input("s", sql.NVarChar, status[n % 4])
    .input("t", sql.Decimal(12, 2), 20 + ((n * 31) % 900) + 0.99)
    .input("g", sql.BigInt, (9007199254740993n + BigInt(n)).toString())
    .query("INSERT INTO dbo.pedidos VALUES (@id, @c, @d, @s, @t, @g)")
}
await db.close()
console.log("Demo SQL Server pronta (sqlboard_demo).")
