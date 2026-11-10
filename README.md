# Controle de Gastos

Site estático (HTML + CSS + JavaScript puro, sem dependências) para controlar gastos pessoais:

- **Painel do mês** — receita líquida, despesas, o que já foi pago, o que falta, sobra prevista, gastos por categoria, fixo × variável e limites por categoria. Marque cada conta como paga e informe o valor real.
- **Gastos** — cadastro com tipo (fixo/variável), frequência (única, semanal, mensal, bimestral, trimestral, semestral, anual), parcelamento, forma de pagamento e data de término. Mostra o custo mensal equivalente de cada item.
- **Receitas** — salário bruto e descontos (INSS, IRRF, vales…) para calcular o líquido.
- **Cartões** — fatura projetada de cada cartão e parcelamentos em andamento (quanto falta e quando termina).
- **Projeção** — 6 a 36 meses à frente: receitas × despesas, sobra mensal, saldo acumulado e meses no vermelho.
- **Investimentos** — saldo, aporte mensal, rendimento % a.m., projeção do patrimônio e prazo para atingir metas.

## Privacidade

Os dados ficam **apenas no navegador** (`localStorage`). Nada é enviado para servidor nem para o repositório.
Use **Dados → Baixar backup** para guardar um `.json` e **Importar backup** para restaurar em outro dispositivo.
Os arquivos de backup estão no `.gitignore` para não irem parar no GitHub por engano.

## Publicar no GitHub Pages

1. Crie um repositório (ex.: `controle-gastos`) e envie estes arquivos.
2. No GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. O site fica em `https://lorenaloopes.github.io/controle-gastos/`.

## Rodar localmente

Basta abrir o `index.html` no navegador.
