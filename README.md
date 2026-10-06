🩺 Estágio Digital — API de Gestão e Validação de Estágios de Enfermagem

Status: 🚧 Em Desenvolvimento (MVP)

API B2B desenvolvida para automatizar e digitalizar o controle de frequência e validação de horas de estágio para instituições de ensino técnico e superior.

🎯 O Problema

Escolas técnicas e faculdades de saúde frequentemente gerenciam o controle de estágio por meio de fichas físicas de papel. Esse formato apresenta diversos gargalos:

Refazer documentos: Pequenos erros exigem o preenchimento de uma nova folha.

Risco de perda: Folhas físicas são facilmente danificadas ou perdidas.

Carga operacional de revisão: Dificuldade e lentidão da coordenação para consolidar e validar as horas cumpridas.

💡 A Solução

O Estágio Digital substitui o papel por uma aprovação digital com trilha de auditoria, reduzindo erros, eliminando retrabalho e permitindo acompanhamento em tempo real pelas coordenações.

🛠️ Tech Stack

Linguagem: Node.js + TypeScript

Framework Web: Express

ORM: Prisma

Banco de Dados: PostgreSQL

Versionamento & Governança: Git / GitHub (Git Flow + Conventional Commits)

🔐 Perfis do Sistema

Aluno: Registra relatórios e horas das atividades de estágio.

Professora (Preceptora): Revisa, aprova ou devolve os registros para correção.

Coordenação: Acompanha o saldo de horas das turmas em relação à carga exigida e extrai relatórios.

🚀 Como Executar o Projeto Localmente

(Instruções detalhadas serão adicionadas conforme o avanço das branches de setup e banco de dados).

# Clonar o repositório
git clone https://github.com/SEU-USUARIO/NOME-DO-REPOSITORIO.git

# Entrar na pasta do projeto
cd NOME-DO-REPOSITORIO

# Instalar as dependências
npm install


📋 Roadmap do MVP

[x] Definição de escopo e modelo de dados

[ ] Setup do projeto (chore/project-setup)

[ ] Schema do banco de dados e migrations (feat/database-schema)

[ ] Autenticação e Autorização JWT (feat/auth)

[ ] Módulo de Registro de Estágio (feat/registro-estagio)

[ ] Módulo de Validação e Auditoria (feat/aprovacao)

[ ] Painel e Relatórios da Coordenação (feat/painel-coordenacao)

[ ] Integração Contínua (ci/github-actions)

📄 Licença

Este projeto é um MVP proprietário em fase de desenvolvimento.