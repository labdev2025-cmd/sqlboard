-- Loja FICTÍCIA para MySQL/MariaDB (dados gerados, sem dados reais).
DROP TABLE IF EXISTS itens_pedido, pedidos, clientes, produtos, categorias;

CREATE TABLE categorias (
  id INT PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE
) COMMENT = 'Categorias de produtos';

CREATE TABLE produtos (
  id INT PRIMARY KEY,
  categoria_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  preco DECIMAL(12,2) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL,
  CONSTRAINT fk_prod_cat FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  INDEX produtos_categoria_idx (categoria_id)
) COMMENT = 'Catálogo de produtos';

CREATE TABLE clientes (
  id INT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  uf CHAR(2) NOT NULL,
  data_cadastro DATE NOT NULL,
  INDEX clientes_uf_idx (uf)
) COMMENT = 'Clientes fictícios';

CREATE TABLE pedidos (
  id INT PRIMARY KEY,
  cliente_id INT NOT NULL,
  data_pedido DATETIME NOT NULL,
  status VARCHAR(20) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  codigo_grande BIGINT NOT NULL,
  CONSTRAINT fk_ped_cli FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  INDEX pedidos_data_idx (data_pedido)
) COMMENT = 'Pedidos';

INSERT INTO categorias VALUES (1,'Eletrônicos'),(2,'Casa'),(3,'Papelaria'),(4,'Esporte'),(5,'Livros');

INSERT INTO produtos (id, categoria_id, nome, preco, ativo, criado_em)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 40)
SELECT n, 1 + MOD(n, 5), CONCAT('Produto ', n), ROUND(10 + MOD(n * 37, 490) + MOD(n, 100) / 100, 2), MOD(n, 7) <> 0,
       TIMESTAMP('2025-01-01') + INTERVAL n DAY
FROM seq;

INSERT INTO clientes (id, nome, uf, data_cadastro)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 100)
SELECT n, CONCAT(ELT(1 + MOD(n, 6), 'Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio'), ' ', n),
       ELT(1 + MOD(n, 4), 'CE', 'SP', 'RJ', 'MG'), DATE('2024-01-01') + INTERVAL MOD(n * 7, 600) DAY
FROM seq;

INSERT INTO pedidos (id, cliente_id, data_pedido, status, total, codigo_grande)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 500)
SELECT n, 1 + MOD(n * 13, 100), TIMESTAMP('2025-01-01') + INTERVAL MOD(n * 17, 600) DAY,
       ELT(1 + MOD(n, 4), 'entregue', 'enviado', 'pago', 'cancelado'),
       ROUND(20 + MOD(n * 31, 900) + 0.99, 2), 9007199254740993 + n
FROM seq;
