# Segurança e privacidade

## Dados e sessão

A análise roda no navegador. O motor é incorporado ao bundle e não busca código em CDN durante a análise. O FlyOrDie mantém sua própria conexão de jogo e suas políticas de dados.

O launcher usa um perfil persistente separado do navegador habitual. Esse perfil contém cookies e outros dados de autenticação: mantenha-o fora do repositório e de arquivos compartilhados. O painel salva apenas preferências de profundidade, análise automática, orientação, setas e voz.

As fixtures de teste e mídia usam contexto novo, rotas locais e dados fictícios. Não usam o perfil de login. Evite gravar traces ou screenshots da sessão autenticada para publicar na documentação.

## Controles do projeto

- Dependências fixadas no lockfile.
- JS e WASM do motor conferidos por tamanho e SHA-256 no build e no navegador.
- Dados externos tratados como texto; interface isolada em Shadow DOM.
- Ponte com origem validada, operações restritas e limites de tamanho de mensagens.
- Execução de lance vinculada à posição e à partida atuais; sem repetição automática após falha.
- O controlador usa a entrada padrão do processo; não abre um serviço de controle HTTP.

## Dependências e atualização

A tabela descreve a base de versões do projeto, não uma lista de versões mais recentes.

| Componente | Versão fixada |
|---|---|
| Node.js | 24.22.3, com patches posteriores da série 24 aceitos |
| npm | 12.2.2, série 12 |
| launcher Firefox launcher | 0.5.9 |
| launcher Firefox browser | 158.0.1-beta.41 |
| playwright-core | 1.62.1 |
| esbuild | 0.28.2 |
| chess.js | 1.4.0 |
| Stockfish.js | 19.0.1 |

Execute `npm run audit:deps` para consultar avisos conhecidos das dependências npm. Esse comando não examina o sistema operacional ou o código nativo do navegador. Não há uma relação de CVEs individuais validada neste repositório.

A revisão de referência de 15/11/2026 registrou correções no Firefox 160 posteriores à base Gecko 158.0.1 do navegador selecionado. A incorporação dessas correções ao launcher Firefox deve ser conferida nas releases do fork antes de declarar equivalência de segurança. Atualizar o launcher, sozinho, não comprova a atualização do binário do navegador.

O launcher 0.5.9 exige playwright-core anterior a 1.63. Para atualizar, confira a compatibilidade, instale patches suportados, refaça o build e execute os testes de navegador e ponte. Revalide também a integração com o cliente real.

Referências para acompanhar versões:

- [Node.js](https://nodejs.org/en/blog/release/)
- [Avisos de segurança Mozilla](https://www.mozilla.org/security/advisories/)
- [Stockfish.js](https://github.com/nmrugg/stockfish.js)

## Relatar um problema

Descreva versão, ambiente, passos de reprodução e impacto. Remova cookies, tokens, senhas e nomes de jogadores dos anexos. Para informações de origem e licenças, consulte [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
