-- Migration: status do pedido — Aberta / Em Trânsito / Embarcada
-- Converte status antigos (desembarcada, fechada) para embarcada.

UPDATE pedidos
SET status = 'embarcada'
WHERE status IN ('desembarcada', 'fechada');
