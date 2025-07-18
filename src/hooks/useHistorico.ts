import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { HistoricoItem, HistoricoFilters } from '@/types';

export type { HistoricoItem };

export const useHistorico = () => {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadHistorico = useCallback(async (filters: HistoricoFilters = {}) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('historico')
        .select('*')
        .order('data_atendimento', { ascending: false });

      if (filters.clienteId) {
        query = query.eq('cliente_id', filters.clienteId);
      }

      if (filters.consultorId) {
        query = query.eq('consultor_id', filters.consultorId);
      }

      const { data: historicoData, error } = await query;

      if (error) throw error;

      // Enriquecer dados com nomes dos relacionamentos
      const enrichedData = await Promise.all(
        (historicoData || []).map(async (item: any) => {
          // Buscar nome do consultor
          const { data: consultor } = await supabase
            .from('consultores')
            .select('nome')
            .eq('id', item.consultor_id)
            .maybeSingle();

          // Buscar nome do serviço
          const { data: servico } = await supabase
            .from('servicos')
            .select('nome')
            .eq('id', item.servico_id)
            .maybeSingle();

          // Buscar nome do cliente
          const { data: cliente } = await supabase
            .from('clientes')
            .select('nome')
            .eq('id', item.cliente_id)
            .maybeSingle();

          // Buscar nome da forma de pagamento se existir
          let formaPagamento = null;
          if (item.forma_pagamento) {
            const { data } = await supabase
              .from('formas_pagamento')
              .select('nome')
              .eq('id', item.forma_pagamento)
              .maybeSingle();
            formaPagamento = data;
          }

          return {
            ...item,
            consultor_nome: consultor?.nome || 'Não encontrado',
            servico_nome: servico?.nome || 'Não encontrado',
            cliente_nome: cliente?.nome || 'Não encontrado',
            forma_pagamento_nome: formaPagamento?.nome || 'Não informado'
          };
        })
      );

      setHistorico(enrichedData);
      return enrichedData;
    } catch (error) {
      toast({
        title: "Erro ao carregar histórico",
        description: "Não foi possível carregar os dados do histórico.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    historico,
    isLoading,
    loadHistorico,
    setHistorico
  };
};