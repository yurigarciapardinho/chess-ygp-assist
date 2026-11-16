# Arquitetura e desenvolvimento

## Fluxo da análise

O launcher abre um contexto persistente do launcher Firefox e instala o bundle no mundo da página. No frame nativo `/games/webapp/x.html`, a captura começa antes da primeira pintura. O painel é montado apenas na janela principal.

O adaptador observa comandos Canvas 2D, agrupa as linhas do histórico e recompõe os movimentos com chess.js. Uma FEN completa alimenta o Stockfish em um Worker. A sessão cancela análises antigas quando a posição muda. O resultado atualiza mini-tabuleiro, avaliação numérica, setas e voz.

O leitor usa comandos de desenho, sem depender de hashes de pixels. A captura reconhece sprites, recortes do tabuleiro e clips retangulares, e aceita letras de coordenadas em maiúsculas ou minúsculas. O contrato observado do renderizador é `CODE_RELEASE=20260722`; mudanças no cliente pedem nova validação.

A posição inicial exige arranjo completo das peças e histórico vazio recém-desenhado. Para partidas longas, o controlador rola a lista do primeiro lance até o fim. A reconstrução preserva direitos de roque, en passant e contadores. Canvas reutilizado em revanche e retorno ao lobby invalidam o estado anterior.

## Organização

| Módulo | Responsabilidade |
|---|---|
| `src/adapters/` | Descoberta de frames, captura e decodificação do histórico |
| `src/core/` | FEN/PGN, legalidade, revisão da sessão, orientação e coordenadas |
| `src/engine/` | UCI, Worker e manifesto de integridade |
| `src/ui/` | Shadow DOM, mini-tabuleiro SVG, setas e preferências |
| `src/entries/` | Inicialização, análise e coordenação dos controles |
| `tools/browser-control.mjs` | Recuperação de histórico e entrada de mouse |
| `tools/control-bridge.mjs` | Ponte entre contexto isolado e mundo da página |

O objeto F2P pertence à página de lançamento e não é uma fonte de posição. A identificação do jogo também reconhece os endereços Bullet/Blitz. Frames internos, inclusive rankings em sandbox, não recebem painéis adicionais.

A ponte usa CustomEvents JSON em um Document compartilhado, com canal aleatório por contexto e duas operações: recuperar histórico e executar um lance validado. O clique usa coordenadas CSS, incluindo escalas e bordas dos iframes. Antes de clicar, o controlador verifica FEN, partida, vez, orientação, legalidade e visibilidade das casas. Confirma a mudança de posição sem repetir uma tentativa incerta.

## Build

```sh
npm ci
npm run build
```

O esbuild incorpora JS e WASM do pacote Stockfish após comparar tamanho e SHA-256 com `src/engine/manifest.json`. O navegador repete a verificação antes de iniciar o Worker. A versão Lite usa uma thread e não exige SharedArrayBuffer. Os quatro arquivos desktop/mobile e userscript compartilham o mesmo núcleo responsivo.

Para atualizar também os arquivos gerados na raiz:

```sh
npm run build -- --publish-local
```

## Testes

```sh
npm test
npm run build
npm run verify:browser
npm run verify:bridge
npm run audit:deps
```

`verify:browser` abre um contexto launcher Firefox headless separado, sem perfil de login. O Playwright serve fixtures por interceptação de rotas: não há tráfego de partida real. A suíte cobre abertura, revanche, rolagem consumida em Window, roque, geometria escalada, entrada de mouse, motor WASM, CSS adversarial e janelas Bullet/Blitz sem F2P. A ponte tem verificação própria.

Os relatórios ficam em `artifacts/`, fora do Git. Os cenários controlados tornam regressões reproduzíveis; conferências no cliente real complementam os testes quando o FlyOrDie muda seu renderizador.

## Mídia da documentação

Requisitos adicionais: FFmpeg com suporte a GIF no PATH, além do navegador launcher Firefox instalado.

```sh
npm run build
npm run docs:media
```

`tools/capture-media.mjs` usa o motor e o painel reais em uma fixture de apresentação a 1280×800. As peças vetoriais derivam do desenho do próprio painel. O cenário é identificado como demonstração local, com histórico e jogador fictícios. Todas as rotas são atendidas localmente e o contexto é descartado ao encerrar.

São gerados `.github/screenshot-gameplay.png`, `screenshot-panel.png`, `screenshot-sync.png`, `screenshot-fen.png` e `demo-gameplay.gif`. O GIF reúne frames da sincronização, análise, seta e execução de um lance pela entrada de mouse do controlador. O relatório registra dimensões, frames e resultado em `artifacts/media-report.json`.

A interface atual apresenta avaliação numérica. As imagens não acrescentam uma barra de avaliação inexistente nem simulam respostas do Stockfish.
