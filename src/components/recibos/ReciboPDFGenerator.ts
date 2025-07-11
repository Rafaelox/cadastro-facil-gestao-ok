import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Recibo } from '@/types/recibo';

interface ReciboComParcelas extends Omit<Recibo, 'pagamentos'> {
  parcelas?: {
    numero_parcela: number;
    valor_parcela: number;
    data_vencimento: string;
    status: string;
  }[];
  pagamentos?: {
    data_pagamento: string;
    valor?: number;
    valor_original?: number;
    parcelas?: {
      numero_parcela: number;
      valor_parcela: number;
      data_vencimento: string;
      status: string;
    }[];
  };
}

export function generateReciboNormalPDF(recibo: ReciboComParcelas) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // ========== CABEÇALHO COM DADOS DA EMPRESA ==========
  let yPosition = 15;
  
  // Logo da empresa (se houver)
  if (recibo.dados_empresa.logo_url) {
    try {
      // Reservar espaço para logo no futuro
      // doc.addImage(recibo.dados_empresa.logo_url, 'JPEG', 15, yPosition, 40, 20);
    } catch (error) {
      console.warn('Erro ao carregar logo:', error);
    }
  }
  
  // Nome da empresa em destaque no topo
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(recibo.dados_empresa.nome, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;
  
  // Linha com dados principais da empresa
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  let linhaDados = '';
  if (recibo.dados_empresa.cpf_cnpj) {
    const labelDoc = recibo.dados_empresa.tipo_pessoa === 'fisica' ? 'CPF' : 'CNPJ';
    linhaDados += `${labelDoc}: ${recibo.dados_empresa.cpf_cnpj}`;
  }
  
  if (recibo.dados_empresa.telefone) {
    linhaDados += linhaDados ? ` • Tel: ${recibo.dados_empresa.telefone}` : `Tel: ${recibo.dados_empresa.telefone}`;
  }
  
  if (recibo.dados_empresa.email) {
    linhaDados += linhaDados ? ` • Email: ${recibo.dados_empresa.email}` : `Email: ${recibo.dados_empresa.email}`;
  }
  
  if (linhaDados) {
    doc.text(linhaDados, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
  }
  
  // Endereço da empresa
  let linhaEndereco = '';
  if (recibo.dados_empresa.endereco) {
    linhaEndereco = recibo.dados_empresa.endereco;
    
    if (recibo.dados_empresa.cidade && recibo.dados_empresa.estado) {
      linhaEndereco += ` - ${recibo.dados_empresa.cidade}/${recibo.dados_empresa.estado}`;
    }
    
    if (recibo.dados_empresa.cep) {
      linhaEndereco += ` - CEP: ${recibo.dados_empresa.cep}`;
    }
    
    doc.text(linhaEndereco, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
  }
  
  // Linha separadora dupla
  yPosition += 5;
  doc.setLineWidth(1);
  doc.line(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 2;
  doc.setLineWidth(0.3);
  doc.line(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 15;
  
  // ========== TÍTULO DO RECIBO ==========
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBO', pageWidth / 2, yPosition, { align: 'center' });
  
  // Número do recibo no canto superior direito
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${recibo.numero_recibo}`, pageWidth - 15, 20, { align: 'right' });
  
  // Data atual
  const dataAtual = format(new Date(recibo.created_at), 'dd/MM/yyyy', { locale: ptBR });
  doc.text(`Data: ${dataAtual}`, pageWidth - 15, 30, { align: 'right' });
  
  yPosition += 20;
  
  // Dados do pagador (cliente)
  yPosition += 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO PAGADOR:', 20, yPosition);
  
  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`Nome: ${recibo.dados_cliente.nome}`, 20, yPosition);
  yPosition += 5;
  
  if (recibo.dados_cliente.cpf) {
    doc.text(`CPF: ${recibo.dados_cliente.cpf}`, 20, yPosition);
    yPosition += 5;
  }
  
  if (recibo.dados_cliente.endereco) {
    doc.text(`Endereço: ${recibo.dados_cliente.endereco}`, 20, yPosition);
    yPosition += 5;
  }
  
  if (recibo.dados_cliente.telefone) {
    doc.text(`Telefone: ${recibo.dados_cliente.telefone}`, 20, yPosition);
    yPosition += 5;
  }
  
  // Linha separadora
  yPosition += 10;
  doc.line(20, yPosition, pageWidth - 20, yPosition);
  
  // Texto principal do recibo
  yPosition += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  // Data e hora completa
  const dataHoraCompleta = format(new Date(recibo.created_at), "dd 'de' MMMM 'de' yyyy', às' HH:mm", { locale: ptBR });
  const cidadeTexto = recibo.dados_empresa.cidade || 'Porto Alegre';
  
  // Obter valor total correto (priorizar valor_original do pagamento, depois valor do pagamento, por último valor do recibo)
  let valorTotal = recibo.valor;
  if (recibo.pagamentos?.valor_original) {
    valorTotal = recibo.pagamentos.valor_original;
  } else if (recibo.pagamentos?.valor) {
    valorTotal = recibo.pagamentos.valor;
  }
  const valorExtenso = numeroParaExtenso(valorTotal);
  const cpfCliente = recibo.dados_cliente.cpf ? `, CPF nº ${recibo.dados_cliente.cpf}` : '';
  
  // Verificar se é parcelado para ajustar o texto
  const parcelas = recibo.parcelas || recibo.pagamentos?.parcelas || [];
  const isParcelado = parcelas && parcelas.length > 0;
  
  // Data do pagamento como referência principal
  const dataPagamento = recibo.pagamentos?.data_pagamento ? 
    format(new Date(recibo.pagamentos.data_pagamento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) :
    format(new Date(recibo.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  
  let textoRecibo = '';
  if (isParcelado) {
    textoRecibo = `Recebemos de ${recibo.dados_cliente.nome}${cpfCliente}, o valor total de R$ ${valorTotal.toFixed(2).replace('.', ',')} (${valorExtenso}), em ${dataPagamento}, referente aos serviços prestados, conforme parcelamento detalhado abaixo.`;
  } else {
    textoRecibo = `Recebemos de ${recibo.dados_cliente.nome}${cpfCliente}, o valor de R$ ${valorTotal.toFixed(2).replace('.', ',')} (${valorExtenso}), em ${dataPagamento}, referente aos serviços prestados.`;
  }
  
  // Quebrar texto em linhas
  const linhasTexto = doc.splitTextToSize(textoRecibo, pageWidth - 40);
  doc.text(linhasTexto, 20, yPosition);
  yPosition += linhasTexto.length * 6;
  
  // Descrição adicional se houver
  if (recibo.descricao) {
    yPosition += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIÇÃO DOS SERVIÇOS:', 20, yPosition);
    
    yPosition += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(recibo.descricao, pageWidth - 40);
    doc.text(lines, 20, yPosition);
    yPosition += lines.length * 5;
  }
  
  // Data e local
  yPosition += 20;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${cidadeTexto}, ${dataHoraCompleta}.`, 20, yPosition);
  
  // Informações do pagamento e parcelas (se houver)
  if (recibo.pagamento_id) {
    yPosition += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMAÇÕES DO PAGAMENTO:', 20, yPosition);
    
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Referente ao Pagamento #${recibo.pagamento_id}`, 20, yPosition);
    yPosition += 5;
    
    // Exibir informações das parcelas se disponível
    if ((recibo.parcelas && recibo.parcelas.length > 0) || (recibo.pagamentos?.parcelas && recibo.pagamentos.parcelas.length > 0)) {
      const parcelas = recibo.parcelas || recibo.pagamentos?.parcelas || [];
      yPosition += 15;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('DETALHAMENTO DO PARCELAMENTO:', 20, yPosition);
      
      yPosition += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Informações gerais do parcelamento
      const totalParcelas = parcelas.length;
      const valorTotalParcelamento = parcelas.reduce((total: number, parcela: any) => total + parcela.valor_parcela, 0);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`VALOR TOTAL DO PAGAMENTO: R$ ${valorTotal.toFixed(2).replace('.', ',')}`, 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Parcelado em ${totalParcelas} vezes:`, 20, yPosition);
      yPosition += 10;
      
      // Tabela de parcelas
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Parcela', 20, yPosition);
      doc.text('Valor', 70, yPosition);
      doc.text('Vencimento', 120, yPosition);
      doc.text('Status', 170, yPosition);
      
      yPosition += 3;
      doc.setLineWidth(0.3);
      doc.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 5;
      
      // Listar cada parcela
      doc.setFont('helvetica', 'normal');
      parcelas.forEach((parcela: any, index: number) => {
        const dataVencimento = format(new Date(parcela.data_vencimento), 'dd/MM/yyyy', { locale: ptBR });
        const statusParcela = parcela.status === 'pago' ? 'Pago' : 'Pendente';
        
        doc.text(`${parcela.numero_parcela}/${totalParcelas}`, 20, yPosition);
        doc.text(`R$ ${parcela.valor_parcela.toFixed(2).replace('.', ',')}`, 70, yPosition);
        doc.text(dataVencimento, 120, yPosition);
        doc.text(statusParcela, 170, yPosition);
        yPosition += 5;
        
        // Verificar se precisa de nova página
        if (yPosition > doc.internal.pageSize.height - 50 && index < parcelas.length - 1) {
          doc.addPage();
          yPosition = 20;
        }
      });
      
      yPosition += 10;
      
      // Resumo final
      yPosition += 5;
      doc.setLineWidth(0.3);
      doc.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`VALOR TOTAL GERAL: R$ ${valorTotal.toFixed(2).replace('.', ',')}`, 20, yPosition);
      yPosition += 5;
      doc.text(`POR EXTENSO: ${valorExtenso}`, 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('Este recibo comprova o recebimento do valor total conforme detalhamento das parcelas acima.', 20, yPosition);
    } else {
      // Pagamento à vista
      yPosition += 15;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('FORMA DE PAGAMENTO:', 20, yPosition);
      
      yPosition += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Pagamento à vista - valor integral recebido.', 20, yPosition);
    }
  }
  
  // Observações
  if (recibo.observacoes) {
    yPosition += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES:', 20, yPosition);
    
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const obsLines = doc.splitTextToSize(recibo.observacoes, pageWidth - 40);
    doc.text(obsLines, 20, yPosition);
    yPosition += obsLines.length * 5;
  }
  
  // Assinatura
  yPosition += 30;
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 50, yPosition, pageWidth / 2 + 50, yPosition);
  yPosition += 8;
  doc.setFontSize(10);
  doc.text('Assinatura do Emissor', pageWidth / 2, yPosition, { align: 'center' });
  
  // Footer
  const footerY = doc.internal.pageSize.height - 20;
  doc.setFontSize(8);
  doc.text(`Recibo gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 
    pageWidth / 2, footerY, { align: 'center' });
  
  // Salvar PDF
  doc.save(`recibo-${recibo.numero_recibo}.pdf`);
}

export function generateReciboDoacaoPDF(recibo: ReciboComParcelas) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // ========== CABEÇALHO COM DADOS DA EMPRESA ==========
  let yPosition = 15;
  
  // Logo da empresa (se houver)
  if (recibo.dados_empresa.logo_url) {
    try {
      // Reservar espaço para logo no futuro
      // doc.addImage(recibo.dados_empresa.logo_url, 'JPEG', 15, yPosition, 40, 20);
    } catch (error) {
      console.warn('Erro ao carregar logo:', error);
    }
  }
  
  // Nome da empresa em destaque no topo
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(recibo.dados_empresa.nome, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;
  
  // Linha com dados principais da empresa
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  let linhaDados = '';
  if (recibo.dados_empresa.cpf_cnpj) {
    const labelDoc = recibo.dados_empresa.tipo_pessoa === 'fisica' ? 'CPF' : 'CNPJ';
    linhaDados += `${labelDoc}: ${recibo.dados_empresa.cpf_cnpj}`;
  }
  
  if (recibo.dados_empresa.telefone) {
    linhaDados += linhaDados ? ` • Tel: ${recibo.dados_empresa.telefone}` : `Tel: ${recibo.dados_empresa.telefone}`;
  }
  
  if (recibo.dados_empresa.email) {
    linhaDados += linhaDados ? ` • Email: ${recibo.dados_empresa.email}` : `Email: ${recibo.dados_empresa.email}`;
  }
  
  if (linhaDados) {
    doc.text(linhaDados, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
  }
  
  // Endereço da empresa
  let linhaEndereco = '';
  if (recibo.dados_empresa.endereco) {
    linhaEndereco = recibo.dados_empresa.endereco;
    
    if (recibo.dados_empresa.cidade && recibo.dados_empresa.estado) {
      linhaEndereco += ` - ${recibo.dados_empresa.cidade}/${recibo.dados_empresa.estado}`;
    }
    
    if (recibo.dados_empresa.cep) {
      linhaEndereco += ` - CEP: ${recibo.dados_empresa.cep}`;
    }
    
    doc.text(linhaEndereco, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
  }
  
  // Linha separadora dupla
  yPosition += 5;
  doc.setLineWidth(1);
  doc.line(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 2;
  doc.setLineWidth(0.3);
  doc.line(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 15;
  
  // ========== TÍTULO DO RECIBO ==========
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBO DE DOAÇÃO', pageWidth / 2, yPosition, { align: 'center' });
  
  // Número do recibo no canto superior direito
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${recibo.numero_recibo}`, pageWidth - 15, 20, { align: 'right' });
  
  // Data atual
  const dataAtual = format(new Date(recibo.created_at), 'dd/MM/yyyy', { locale: ptBR });
  doc.text(`Data: ${dataAtual}`, pageWidth - 15, 30, { align: 'right' });
  
  yPosition += 20;
  
  // Dados do doador
  yPosition += 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO DOADOR:', 20, yPosition);
  
  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`Nome: ${recibo.dados_cliente.nome}`, 20, yPosition);
  yPosition += 5;
  
  if (recibo.dados_cliente.cpf) {
    doc.text(`CPF: ${recibo.dados_cliente.cpf}`, 20, yPosition);
    yPosition += 5;
  }
  
  // Declaração de doação
  yPosition += 20;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  const declaracao = `Declaramos que recebemos do doador acima identificado a quantia de R$ ${recibo.valor.toFixed(2).replace('.', ',')} (${numeroParaExtenso(recibo.valor)}) referente à doação em dinheiro para apoio às atividades da organização.`;
  
  const declaracaoLines = doc.splitTextToSize(declaracao, pageWidth - 40);
  doc.text(declaracaoLines, 20, yPosition);
  yPosition += declaracaoLines.length * 6;
  
  // Descrição da doação
  if (recibo.descricao) {
    yPosition += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('FINALIDADE DA DOAÇÃO:', 20, yPosition);
    
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(recibo.descricao, pageWidth - 40);
    doc.text(descLines, 20, yPosition);
    yPosition += descLines.length * 5;
  }
  
  // Valor destacado
  yPosition += 20;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`VALOR DA DOAÇÃO: R$ ${recibo.valor.toFixed(2).replace('.', ',')}`, 20, yPosition);
  
  // Observações
  if (recibo.observacoes) {
    yPosition += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES:', 20, yPosition);
    
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const obsLines = doc.splitTextToSize(recibo.observacoes, pageWidth - 40);
    doc.text(obsLines, 20, yPosition);
    yPosition += obsLines.length * 5;
  }
  
  // Agradecimento
  yPosition += 20;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'italic');
  doc.text('Agradecemos pela sua generosidade e apoio às nossas atividades!', 
    pageWidth / 2, yPosition, { align: 'center' });
  
  // Assinatura
  yPosition += 30;
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 50, yPosition, pageWidth / 2 + 50, yPosition);
  yPosition += 8;
  doc.setFontSize(10);
  doc.text('Assinatura do Responsável', pageWidth / 2, yPosition, { align: 'center' });
  
  // Footer
  const footerY = doc.internal.pageSize.height - 20;
  doc.setFontSize(8);
  doc.text(`Recibo de doação gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 
    pageWidth / 2, footerY, { align: 'center' });
  
  // Salvar PDF
  doc.save(`recibo-doacao-${recibo.numero_recibo}.pdf`);
}

// Função simplificada para converter número em extenso (apenas básico)
function numeroParaExtenso(valor: number): string {
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  
  let parteInteira = Math.floor(valor);
  const centavos = Math.round((valor - parteInteira) * 100);
  
  if (parteInteira === 0) {
    return centavos > 0 ? `${centavos} centavos` : 'zero reais';
  }
  
  // Implementação simplificada para valores até 999
  let extenso = '';
  
  if (parteInteira >= 100) {
    if (parteInteira === 100) {
      extenso += 'cem';
    } else {
      extenso += centenas[Math.floor(parteInteira / 100)];
    }
    parteInteira %= 100;
    if (parteInteira > 0) extenso += ' e ';
  }
  
  if (parteInteira >= 20) {
    extenso += dezenas[Math.floor(parteInteira / 10)];
    parteInteira %= 10;
    if (parteInteira > 0) extenso += ' e ';
  } else if (parteInteira >= 10) {
    extenso += especiais[parteInteira - 10];
    parteInteira = 0;
  }
  
  if (parteInteira > 0) {
    extenso += unidades[parteInteira];
  }
  
  extenso += valor === 1 ? ' real' : ' reais';
  
  if (centavos > 0) {
    extenso += ` e ${centavos} centavos`;
  }
  
  return extenso;
}