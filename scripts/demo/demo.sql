-- Banco de demonstração do sqlboard: uma loja FICTÍCIA.
-- Todos os nomes, e-mails e valores são gerados; não há dados reais.
-- Idempotente: recria o schema "loja" a cada execução.

DROP SCHEMA IF EXISTS loja CASCADE;
CREATE SCHEMA loja;
COMMENT ON SCHEMA loja IS 'Loja fictícia para demonstração do sqlboard';

SELECT setseed(0.42);

CREATE TABLE loja.categorias (
  id serial PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  descricao text
);
COMMENT ON TABLE loja.categorias IS 'Categorias de produtos';

CREATE TABLE loja.produtos (
  id serial PRIMARY KEY,
  categoria_id int NOT NULL REFERENCES loja.categorias(id),
  nome text NOT NULL,
  sku text NOT NULL UNIQUE,
  preco numeric(12,2) NOT NULL,
  custo numeric(12,2),
  ativo boolean NOT NULL DEFAULT true,
  descricao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE loja.produtos IS 'Catálogo de produtos';
COMMENT ON COLUMN loja.produtos.preco IS 'Preço de venda em reais';
CREATE INDEX produtos_categoria_idx ON loja.produtos(categoria_id);

CREATE TABLE loja.clientes (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  cidade text NOT NULL,
  uf char(2) NOT NULL,
  segmento text NOT NULL,
  data_cadastro date NOT NULL,
  observacoes text
);
COMMENT ON TABLE loja.clientes IS 'Clientes fictícios';
CREATE INDEX clientes_uf_idx ON loja.clientes(uf);

CREATE TABLE loja.pedidos (
  id serial PRIMARY KEY,
  cliente_id int NOT NULL REFERENCES loja.clientes(id),
  data_pedido timestamptz NOT NULL,
  status text NOT NULL,
  canal text NOT NULL,
  valor_frete numeric(10,2),
  cupom text
);
COMMENT ON TABLE loja.pedidos IS 'Pedidos dos últimos dois anos';
CREATE INDEX pedidos_data_idx ON loja.pedidos(data_pedido);
CREATE INDEX pedidos_cliente_idx ON loja.pedidos(cliente_id);

CREATE TABLE loja.itens_pedido (
  pedido_id int NOT NULL REFERENCES loja.pedidos(id),
  produto_id int NOT NULL REFERENCES loja.produtos(id),
  quantidade int NOT NULL,
  preco_unitario numeric(12,2) NOT NULL,
  desconto numeric(5,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (pedido_id, produto_id)
);
COMMENT ON TABLE loja.itens_pedido IS 'Itens de cada pedido';

INSERT INTO loja.categorias (nome, descricao) VALUES
  ('Eletrônicos', 'Fones, carregadores e acessórios'),
  ('Casa', 'Utensílios e decoração'),
  ('Papelaria', 'Cadernos, canetas e organizadores'),
  ('Esporte', 'Roupas e equipamentos esportivos'),
  ('Livros', 'Ficção, técnicos e infantis'),
  ('Brinquedos', NULL);

INSERT INTO loja.produtos (categoria_id, nome, sku, preco, custo, ativo, descricao, criado_em)
SELECT
  1 + (g % 6),
  (ARRAY['Fone','Caneca','Caderno','Bola','Romance','Quebra-cabeça','Luminária','Mochila','Garrafa','Agenda'])[1 + (g % 10)]
    || ' ' || (ARRAY['Aurora','Brisa','Cometa','Duna','Eco','Farol','Gaia','Horizonte'])[1 + (g % 8)]
    || ' ' || g,
  'SKU-' || lpad(g::text, 5, '0'),
  round((10 + random() * 490)::numeric, 2),
  CASE WHEN g % 7 = 0 THEN NULL ELSE round((5 + random() * 200)::numeric, 2) END,
  g % 11 <> 0,
  CASE WHEN g % 5 = 0
    THEN repeat('Produto de demonstração com descrição longa para testar quebra de linha e truncamento na interface. ', 3)
    ELSE 'Produto de demonstração.' END,
  now() - (random() * interval '730 days')
FROM generate_series(1, 120) AS g;

INSERT INTO loja.clientes (nome, email, cidade, uf, segmento, data_cadastro, observacoes)
SELECT
  (ARRAY['Ana','Bruno','Carla','Diego','Elisa','Fábio','Gabriela','Heitor','Isabela','João','Larissa','Marcos','Natália','Otávio','Paula','Rafael'])[1 + (g % 16)]
    || ' ' || (ARRAY['Silva','Souza','Lima','Costa','Rocha','Alves','Pereira','Gomes'])[1 + ((g / 16) % 8)]
    || ' ' || g,
  'cliente' || g || '@exemplo.test',
  (ARRAY['Cidade Alta','Vila Nova','Porto Claro','Serra Azul','Campo Verde','Lago Sereno'])[1 + (g % 6)],
  (ARRAY['CE','SP','RJ','MG','BA','PR','RS','PE'])[1 + (g % 8)],
  (ARRAY['Varejo','Atacado','Corporativo'])[1 + (g % 3)],
  (current_date - (random() * 900)::int),
  CASE WHEN g % 9 = 0 THEN 'Cliente prefere entrega pela manhã.' ELSE NULL END
FROM generate_series(1, 400) AS g;

INSERT INTO loja.pedidos (cliente_id, data_pedido, status, canal, valor_frete, cupom)
SELECT
  1 + (random() * 399)::int,
  now() - (random() * interval '730 days'),
  (ARRAY['entregue','entregue','entregue','enviado','pago','cancelado'])[1 + (random() * 5)::int],
  (ARRAY['site','app','loja física','marketplace'])[1 + (random() * 3)::int],
  CASE WHEN random() < 0.2 THEN NULL ELSE round((random() * 40)::numeric, 2) END,
  CASE WHEN random() < 0.1 THEN 'BEMVINDO10' ELSE NULL END
FROM generate_series(1, 3000) AS g;

INSERT INTO loja.itens_pedido (pedido_id, produto_id, quantidade, preco_unitario, desconto)
SELECT DISTINCT ON (p.id, pr.id)
  p.id,
  pr.id,
  1 + (random() * 4)::int,
  pr.preco,
  CASE WHEN random() < 0.15 THEN round((random() * 20)::numeric, 2) ELSE 0 END
FROM loja.pedidos p
CROSS JOIN LATERAL (
  SELECT id, preco FROM loja.produtos
  WHERE p.id > 0
  ORDER BY random()
  LIMIT 1 + (p.id % 4)
) pr;

CREATE VIEW loja.vendas_mensais AS
SELECT
  date_trunc('month', p.data_pedido)::date AS mes,
  c.nome AS categoria,
  sum(i.quantidade * i.preco_unitario - i.desconto) AS receita,
  count(DISTINCT p.id) AS pedidos
FROM loja.pedidos p
JOIN loja.itens_pedido i ON i.pedido_id = p.id
JOIN loja.produtos pr ON pr.id = i.produto_id
JOIN loja.categorias c ON c.id = pr.categoria_id
WHERE p.status <> 'cancelado'
GROUP BY 1, 2;
COMMENT ON VIEW loja.vendas_mensais IS 'Receita mensal por categoria (exclui cancelados)';

ANALYZE;
