# Casos de Teste - Velô Sprint (Configurador de Veículo Elétrico)

Este documento contém os casos de teste funcionais criados após uma análise completa do código do sistema Velô Sprint, cobrindo os módulos: Landing Page, Configurador de Veículo, Checkout/Pedido, Análise de Crédito Automática, Confirmação e Consulta de Pedidos.

---

### CT01 - Acesso e Navegação da Landing Page

#### Objetivo
Validar o carregamento da Landing Page e a transição para o módulo de configuração.

#### Pré-Condições
- O sistema deve estar online.

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | Acessar a URL raiz do sistema. | A Landing Page é exibida corretamente com as informações do veículo Velô Sprint. |
| 2 | Clicar no botão para iniciar a configuração. | O sistema redireciona o usuário para a tela `/configure` (Configurador de Veículo). |

#### Resultados Esperados
- O usuário consegue iniciar o fluxo de compra sem erros.

#### Critérios de Aceitação
- Elementos visuais da Landing Page carregam corretamente.
- O redirecionamento de rotas funciona.

---

### CT02 - Configuração do Veículo - Precificação Base

#### Objetivo
Validar que o preço base do veículo (R$ 40.000) é mantido caso não sejam selecionados itens adicionais tarifados (ex: rodas "Aero" não possuem custo extra).

#### Pré-Condições
- Usuário na tela de Configuração (`/configure`).

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | Verificar o preço inicial exibido. | O valor total exibe R$ 40.000,00. |
| 2 | Alterar cor exterior e interior. | O valor total permanece R$ 40.000,00 (cores não alteram preço). |
| 3 | Manter as rodas padrão "Aero". | O valor total permanece R$ 40.000,00. |
| 4 | Clicar em "Avançar". | O sistema direciona para o Checkout (`/order`) com Total = R$ 40.000,00. |

#### Resultados Esperados
- O sistema preserva o valor base nas configurações padrões.

#### Critérios de Aceitação
- Cores exteriores e interiores não podem impactar o subtotal.

---

### CT03 - Configuração do Veículo - Precificação Dinâmica (Opcionais)

#### Objetivo
Validar a soma e subtração dos itens opcionais ao valor base do carro conforme as regras de negócio.

#### Pré-Condições
- Usuário na tela de Configuração.
- Valor inicial: R$ 40.000.

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | Selecionar Rodas "Sport". | O valor exibido atualiza para R$ 42.000,00 (+ R$ 2.000). |
| 2 | Marcar o opcional "Precision Park". | O valor exibido atualiza para R$ 47.500,00 (+ R$ 5.500). |
| 3 | Marcar o opcional "Flux Capacitor". | O valor exibido atualiza para R$ 52.500,00 (+ R$ 5.000). |
| 4 | Desmarcar as Rodas "Sport" (voltar para "Aero"). | O valor exibido atualiza para R$ 50.500,00 (- R$ 2.000). |

#### Resultados Esperados
- O cálculo do preço responde em tempo real à interação do usuário.

#### Critérios de Aceitação
- Rodas "Sport" custam R$ 2.000.
- "Precision Park" custa R$ 5.500.
- "Flux Capacitor" custa R$ 5.000.

---

### CT04 - Pagamento À Vista (Bypass de Crédito)

#### Objetivo
Validar que a escolha do método de pagamento "À Vista" ignora a análise de crédito e aprova o pedido automaticamente.

#### Pré-Condições
- Usuário na tela de Checkout (`/order`).
- Dados pessoais preenchidos corretamente.

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | Selecionar o botão de pagamento "À Vista". | A opção "À Vista" fica destacada. Campos de entrada/financiamento são ocultados. |
| 2 | Clicar em "Confirmar Pedido". | O sistema finaliza a compra sem requisição à API de crédito. |
| 3 | Verificar o redirecionamento. | O usuário é levado à tela de Sucesso com status "APROVADO". |

#### Resultados Esperados
- Pagamentos à vista não passam por bloqueio de Score de crédito.

#### Critérios de Aceitação
- O payload de criação de pedido é enviado com `paymentMethod: 'avista'` e status de APROVADO automático.

---

### CT05 - Simulação de Financiamento - Cálculo de Juros Compostos

#### Objetivo
Validar se o valor da prestação do financiamento (travado em 12x) respeita a regra de 2% de juros compostos ao mês sobre o valor a ser financiado.

#### Pré-Condições
- Usuário no Checkout.
- Valor total do carro configurado = R$ 40.000.

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | Selecionar "Financiamento". | O formulário exibe o campo "Valor da Entrada". |
| 2 | Digitar R$ 10.000 no campo de entrada. | O sistema calcula o saldo devedor = R$ 30.000. |
| 3 | Verificar o valor das parcelas exibidas (12x). | O valor deve ser calculado rigorosamente pela fórmula de juros compostos (Atenção: Atualmente pode ser detectado um bug na UI que aplica taxa simples em `pages/Order.tsx`). |

#### Resultados Esperados
- O sistema calcula e exibe corretamente o valor financiado e as parcelas com 2% de juros compostos a.m. 

#### Critérios de Aceitação
- Taxa mensal: 2%.
- Prazo fixo: 12 meses.
- Fórmula matemática correta aplicada ao montante devedor.

---

### CT06 - Submissão de Checkout - Validação de Campos Obrigatórios e Formatação

#### Objetivo
Validar que os inputs do formulário de checkout respeitam as validações (máscaras, tamanho mínimo, formato de email) estabelecidas no schema Zod.

#### Pré-Condições
- Usuário na tela de Checkout.

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | Deixar "Nome" e "Sobrenome" em branco ou com 1 letra e tentar enviar. | Exibe erro: "Nome deve ter pelo menos 2 caracteres" / "Sobrenome deve ter pelo menos 2 caracteres". |
| 2 | Preencher um email sem "@" (formato inválido) e tentar enviar. | Exibe erro: "Email inválido". |
| 3 | Preencher CPF e Telefone de forma incompleta e enviar. | Exibe erros de "CPF inválido" e "Telefone inválido". |
| 4 | Não selecionar nenhuma loja no Dropdown e enviar. | Exibe erro: "Selecione uma loja". |

#### Resultados Esperados
- O pedido não prossegue até que todos os campos estejam de acordo com as regras de tipagem e formato.

#### Critérios de Aceitação
- Bloqueio de envio em falha de esquema Zod.
- Uso de máscara no Telefone e CPF.

---

### CT07 - Submissão de Checkout - Aceite dos Termos de Uso

#### Objetivo
Garantir que a checkbox de "Termos de Uso e Privacidade" funcione como bloqueador da compra.

#### Pré-Condições
- Formulário do cliente perfeitamente preenchido.
- Selecionado um método de pagamento.

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | Deixar a checkbox dos Termos de Uso desmarcada. | A caixa não está assinalada. |
| 2 | Clicar em "Confirmar Pedido". | Exibe erro de validação: "Aceite os termos". |
| 3 | Marcar a checkbox e clicar novamente. | O fluxo de pedido é iniciado. |

#### Resultados Esperados
- Aceite explícito é obrigatório.

#### Critérios de Aceitação
- Erro visual exigindo aceite do usuário antes da criação na base de dados.

---

### CT08 - Análise de Crédito: Score > 700 (Aprovado)

#### Objetivo
Validar a aprovação automática via integração de API para clientes com alto Score.

#### Pré-Condições
- Checkout preenchido e "Financiamento" escolhido.
- Entrada menor que 50% do total.
- CPF consultado retorna Score = 750.

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | Clicar em "Confirmar Pedido". | O sistema aciona a função Supabase `credit-analysis`. |
| 2 | Aguardar o redirecionamento. | Tela de Confirmação é exibida com o Pedido processado. |
| 3 | Verificar o Status do Pedido na tela. | Status do Pedido exibe "APROVADO". |

#### Resultados Esperados
- Pedido salvo e aprovado devido ao alto score.

#### Critérios de Aceitação
- Regra `Score > 700 -> APROVADO` aplicada.

---

### CT09 - Análise de Crédito: Score 501 a 700 (Em Análise)

#### Objetivo
Validar que clientes com Score intermediário tenham seus pedidos postos em fila de análise.

#### Pré-Condições
- Checkout preenchido.
- Financiamento com Entrada < 50%.
- API retorna Score = 600.

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | Submeter o pedido. | Requisição feita à API de crédito. |
| 2 | Verificar a tela de Confirmação. | A tela é carregada com a mensagem de que o pedido foi criado, mas com Status "EM_ANALISE". |

#### Resultados Esperados
- Pedido salvo aguardando intervenção manual.

#### Critérios de Aceitação
- Regra `Score >= 501 && Score <= 700 -> EM_ANALISE` aplicada.

---

### CT10 - Análise de Crédito: Score <= 500 (Reprovado)

#### Objetivo
Validar que scores baixos forçam a reprovação do pedido no checkout de financiamentos.

#### Pré-Condições
- Checkout preenchido.
- Financiamento com Entrada < 50%.
- API retorna Score = 400.

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | Submeter o pedido. | Requisição feita à API de crédito. |
| 2 | Verificar a tela de Confirmação. | A tela informa que a operação foi concluída e exibe Status do Pedido como "REPROVADO". |

#### Resultados Esperados
- Fluxo de recusa automático funciona corretamente.

#### Critérios de Aceitação
- Regra `Score <= 500 -> REPROVADO` aplicada.

---

### CT11 - Análise de Crédito: Exceção Entrada >= 50%

#### Objetivo
Testar a exceção à regra: entradas altas compensam scores reprováveis, aprovando automaticamente.

#### Pré-Condições
- Veículo = R$ 40.000.
- Financiamento selecionado.
- API retorna Score = 350.

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | No campo "Valor da Entrada", digitar R$ 20.000 (exatamente 50%). | O cálculo de parcelamento é atualizado. |
| 2 | Submeter o pedido. | O sistema envia as requisições para criar a ordem. |
| 3 | Verificar o resultado final. | A tela de sucesso confirma o pedido com Status "APROVADO", ignorando a faixa do Score baixo. |

#### Resultados Esperados
- A regra de exceção aprova sem considerar as faixas de score convencionais.

#### Critérios de Aceitação
- Regra `(entryValue / totalPrice) >= 0.5 && score < 700 -> APROVADO` observada no código é aplicada com sucesso.

---

### CT12 - Confirmação do Pedido e Geração do Order Number

#### Objetivo
Validar a finalização da compra gerando um Identificador de Consulta.

#### Pré-Condições
- Pedido submetido com sucesso.

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | Acessar a tela de Sucesso. | O resumo de dados pessoais e valores é exibido. |
| 2 | Observar o código principal (ex: ID no formato UUID). | O código único do pedido está claro na interface do usuário. |

#### Resultados Esperados
- O pedido exibe o código para permitir rastreio/consulta futura.

#### Critérios de Aceitação
- Exibição visível e fidedigna ao banco de dados do ID.

---

### CT13 - Consulta de Pedidos com Número Válido

#### Objetivo
Garantir o funcionamento da ferramenta de Busca (`/lookup`).

#### Pré-Condições
- O número de um pedido real é conhecido.

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | Navegar até a tela de Consulta de Pedidos. | O formulário de busca aparece. |
| 2 | Inserir o número válido e clicar em "Buscar Pedido". | Card de informações é renderizado via API. |
| 3 | Analisar o resultado. | O card exibe os opcionais, total, pagamento e Status do pedido atualizados. |

#### Resultados Esperados
- Consulta traz os detalhes exatos e seguros do pedido.

#### Critérios de Aceitação
- Todos os campos principais mapeiam adequadamente o estado do banco.

---

### CT14 - Consulta de Pedidos com Número Inexistente/Inválido

#### Objetivo
Validar o tratamento de falhas ao buscar um pedido falso.

#### Pré-Condições
- Usuário na página de Consulta de Pedidos.

#### Passos

| Id | Ação | Resultado Esperado |
|----|------|--------------------|
| 1 | Digitar "PEDIDO-FALSO" no input. | Campo aceita a string. |
| 2 | Clicar em "Buscar Pedido". | Carregamento é feito, e resulta na mensagem "Pedido não encontrado". |

#### Resultados Esperados
- Feedback visual é exibido para o usuário de maneira limpa.

#### Critérios de Aceitação
- Exibição de card de aviso com ícone e texto instrutivo.
