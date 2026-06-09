-- Active: 1780959804566@@127.0.0.1@3306@bd_dsapi


CREATE DATABASE IF NOT EXISTS bd_dsapi
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE bd_dsapi;


CREATE TABLE cidades (
    id   INT          NOT NULL AUTO_INCREMENT,
    nome VARCHAR(50)  NOT NULL,
    PRIMARY KEY (id)
);
INSERT INTO cidades (nome) VALUES ('São Paulo'), ('Rio de Janeiro'), ('Belo Horizonte');


CREATE TABLE categorias (
    id   INT           NOT NULL AUTO_INCREMENT,
    nome VARCHAR(100)  NOT NULL,
    PRIMARY KEY (id)
);
insert into categorias (nome) values ('Eletrônicos'), ('Roupas'), ('Alimentos');


CREATE TABLE clientes (
    id          INT           NOT NULL AUTO_INCREMENT,
    nome        VARCHAR(100)  NOT NULL,
    altura      DOUBLE,
    nascimento  DATE,
    cidade_id   INT           NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_clientes_cidade
        FOREIGN KEY (cidade_id) REFERENCES cidades (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE pedidos (
    id         INT           NOT NULL AUTO_INCREMENT,
    horario    DATETIME      NOT NULL,
    endereco   VARCHAR(200),
    cliente_id INT           NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_pedidos_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE produtos (
    id           INT           NOT NULL AUTO_INCREMENT,
    nome         VARCHAR(100)  NOT NULL,
    preco        DOUBLE        NOT NULL,
    quantidade   DOUBLE        NOT NULL DEFAULT 0,
    categoria_id INT           NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_produtos_categoria
        FOREIGN KEY (categoria_id) REFERENCES categorias (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE pedidos_produtos (
    pedido_id  INT    NOT NULL,
    produto_id INT    NOT NULL,
    preco      DOUBLE NOT NULL,
    quantidade DOUBLE NOT NULL,
    PRIMARY KEY (pedido_id, produto_id),
    CONSTRAINT fk_pp_pedido
        FOREIGN KEY (pedido_id)  REFERENCES pedidos  (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_pp_produto
        FOREIGN KEY (produto_id) REFERENCES produtos (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);