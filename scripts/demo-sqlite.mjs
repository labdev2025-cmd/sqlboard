// Creates data/sqlite/loja.db: a small FICTITIOUS store for the SQLite adapter.
import { mkdirSync, rmSync } from "node:fs"
import path from "node:path"

import Database from "better-sqlite3"

const dir = path.resolve(process.env.SQLBOARD_SQLITE_DIR ?? "data/sqlite")
mkdirSync(dir, { recursive: true })
const file = path.join(dir, process.argv[2] ?? "loja.db")
rmSync(file, { force: true })
const db = new Database(file)
db.exec(`
  CREATE TABLE categorias (id INTEGER PRIMARY KEY, nome TEXT NOT NULL UNIQUE);
  CREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT NOT NULL, uf TEXT NOT NULL, data_cadastro DATE NOT NULL);
  CREATE TABLE pedidos (
    id INTEGER PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    data_pedido DATETIME NOT NULL,
    status TEXT NOT NULL,
    total NUMERIC NOT NULL,
    codigo_grande INTEGER NOT NULL
  );
  CREATE INDEX pedidos_data_idx ON pedidos(data_pedido);
  CREATE VIEW pedidos_por_status AS SELECT status, count(*) AS pedidos FROM pedidos GROUP BY status;
`)
const ufs = ["CE", "SP", "RJ", "MG"]
const nomes = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio"]
const status = ["entregue", "enviado", "pago", "cancelado"]
db.transaction(() => {
  ;["Eletrônicos", "Casa", "Papelaria", "Esporte", "Livros"].forEach((nome, i) =>
    db.prepare("INSERT INTO categorias VALUES (?, ?)").run(i + 1, nome)
  )
  for (let n = 1; n <= 100; n++) {
    const day = String(1 + (n % 28)).padStart(2, "0")
    db.prepare("INSERT INTO clientes VALUES (?, ?, ?, ?)").run(n, `${nomes[n % 6]} ${n}`, ufs[n % 4], `2024-03-${day}`)
  }
  for (let n = 1; n <= 500; n++) {
    const day = String(1 + (n % 28)).padStart(2, "0")
    db.prepare("INSERT INTO pedidos VALUES (?, ?, ?, ?, ?, ?)").run(
      n,
      1 + ((n * 13) % 100),
      `2025-0${1 + (n % 9)}-${day} 10:00:00`,
      status[n % 4],
      (20 + ((n * 31) % 900) + 0.99).toFixed(2),
      9007199254740993n + BigInt(n)
    )
  }
})()
db.close()
console.log(`SQLite de demonstração em ${file}`)
