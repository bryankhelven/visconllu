# VisCoNLL-U

Visualizador e comparador web estático para árvores de dependência em **CoNLL-U**. A aplicação roda inteiramente no navegador, sem backend e sem dependências JavaScript externas em runtime.

## Modelo de trabalho A/B

A versão atual usa **duas entradas independentes**, A e B. Cada entrada possui:

- uma memória de **Arquivo** própria;
- uma memória de **Texto** própria;
- seleção independente entre Arquivo e Texto;
- um **snapshot renderizado** separado da memória editável;
- estado de alteração pendente (memória diferente do snapshot);
- botão de atualização exclusivo daquele lado;
- opção de **Fixar/Desfixar**;
- zoom próprio.

Isso permite, por exemplo, manter **A fixa como referência** e editar repetidamente B, atualizando apenas a árvore B. Também permite Arquivo × Arquivo, Arquivo × Texto, Texto × Arquivo ou Texto × Texto.

## Funcionalidades

- **Texto é a entrada inicial padrão**; o upload de arquivo permanece disponível como opção secundária no seletor;
- upload independente de `.conllu`, `.conll` ou `.txt` em A e B;
- drag & drop;
- nome e tamanho do arquivo carregado em cada memória;
- rascunhos de texto A/B preservados separadamente em `sessionStorage` quando disponível;
- troca Arquivo ↔ Texto sem destruir a outra memória do mesmo lado;
- snapshot explícito: editar/carregar uma memória **não substitui automaticamente** a árvore já exibida;
- **Atualizar A** e **Atualizar B** independentes;
- **Atualizar ambos** respeitando lados fixados;
- **Fixar A/B** para impedir substituição acidental do snapshot de referência;
- preservação da sentença atual por `sent_id` quando um lado é atualizado, quando possível;
- validação estrutural básica do CoNLL-U (10 colunas, IDs, HEADs e raízes);
- suporte a multiword tokens (`1-2`) sem transformá-los em nós sintáticos;
- FORM, LEMMA, UPOS, XPOS e atributos `FEATS.*`/`MISC.*` configuráveis;
- três modos de visualização:
  - **Uma por vez**: escolha A/B e navegue por sentença;
  - **Contínuo**: todas as árvores do snapshot A ou B em sequência vertical;
  - **Comparar**: snapshot A e snapshot B lado a lado ou empilhados;
- **CoNLL-U abaixo** em todos os modos;
- comparação com alinhamento por `sent_id`;
- zoom local, colocado junto da árvore que ele controla;
- zoom independente em A e B na comparação;
- zoom out / reset / zoom in / Ajustar à largura;
- exportação SVG e PNG da árvore individual;
- exportação SVG independente de A/B na comparação;
- exportação de todas as árvores em ZIP de SVGs;
- layout responsivo e dark mode pela preferência do sistema;
- processamento local, sem envio do CoNLL-U a servidor.

## Fluxo recomendado: referência fixa × candidato mutável

1. Selecione **A** e carregue/cole o CoNLL-U de referência.
2. Clique em **Atualizar A na visualização**.
3. Clique em **Fixar A**.
4. Selecione **B** e carregue um segundo arquivo ou use a memória de Texto.
5. Clique em **Atualizar B na visualização**.
6. Abra **Comparar**.
7. Edite B quantas vezes quiser. A árvore B continua mostrando o snapshot anterior até você clicar em **Atualizar B**; A permanece intocada.
8. Desfixe A somente quando quiser substituir a referência.

## Combinações suportadas

Cada entrada A/B possui sua própria memória de arquivo e de texto. Portanto são suportados diretamente:

```text
A: arquivo  × B: arquivo
A: arquivo  × B: texto
A: texto    × B: arquivo
A: texto    × B: texto
```

Trocar o tipo ativo de uma entrada não apaga a memória do outro tipo.

## Executar

Não há etapa de build. Basta abrir `index.html` no navegador.

Opcionalmente:

```bash
python -m http.server 8000
```

No Windows/PowerShell:

```powershell
py -m http.server 8000
```

## Estrutura

```text
visconllu/
├── index.html
├── styles.css
├── app.js
├── conllu-utils.js
├── tree-renderer.js
├── zip-utils.js
├── sample.conllu
├── README.md
├── LICENSE.md
├── THIRD_PARTY_NOTICES.md
├── tests/
│   └── conllu-utils.test.js
└── .github/
    └── workflows/
        └── pages.yml
```

## Testes

Parsing/validação:

```bash
node --test tests/conllu-utils.test.js
```

O smoke test de navegador desta versão cobre, entre outros pontos:

- Arquivo A × Arquivo B distintos;
- A fixada e B mutável;
- substituição somente de B por Texto sem rerenderizar A;
- detecção de snapshot desatualizado;
- atualização específica de B;
- zoom A independente de B;
- zoom junto das árvores, e não na toolbar global;
- modo contínuo;
- comparação empilhada/lado a lado;
- ausência de erros JavaScript durante o fluxo testado.

## Arquivos grandes

**Uma por vez** é o modo mais econômico para treebanks grandes. **Contínuo** renderiza todas as árvores do snapshot escolhido e pode consumir bastante memória em corpora extensos. A exportação total para ZIP também é proporcional ao número e tamanho das sentenças.

## Implementação

`tree-renderer.js` contém um renderer SVG próprio e somente leitura. O aplicativo não usa D3, jQuery, Arborator Draft ou CDN em runtime.

Arborator Draft e Portparser v2 foram referências públicas para o tipo de visualização e fluxo de uso. Consulte `THIRD_PARTY_NOTICES.md`.

## Licença

O projeto permanece sob **AGPL-3.0-or-later** nesta versão. Veja `LICENSE.md`.
