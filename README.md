# 🎙️ Audio Transcriptor - Voice Notes App

Um aplicativo moderno e poderoso para transcrição de áudio usando Google Gemini AI. Grave notas de voz, faça upload de arquivos de áudio e obtenha transcrições precisas e polidas automaticamente.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-Apache--2.0-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)

## ✨ Recursos

### 🎯 Principais Funcionalidades

- **🎤 Gravação de Áudio**: Grave notas de voz diretamente do navegador
- **📁 Upload de Arquivos**: Suporte para múltiplos formatos (MP3, M4A, Opus, OGG, WAV, WebM)
- **🤖 Transcrição IA**: Transcrição automática usando Google Gemini AI
- **✨ Polimento Automático**: As transcrições são automaticamente formatadas e polidas
- **💾 Armazenamento Local**: Todas as notas são salvas no localStorage do navegador
- **🔍 Busca**: Pesquise em todas as suas notas rapidamente
- **📊 Estatísticas**: Visualize contagem de palavras, caracteres e mais
- **📤 Exportação**: Exporte notas em Markdown, TXT ou JSON

### 🚀 Recursos Avançados

- **Drag & Drop**: Arraste arquivos de áudio diretamente para o app
- **Atalhos de Teclado**: Navegação rápida e produtiva
- **Temas**: Modo claro e escuro com alternância suave
- **Visualização em Tempo Real**: Waveform animado durante gravação
- **Responsivo**: Interface adaptável para desktop e mobile
- **Acessibilidade**: ARIA labels e navegação por teclado
- **PWA Ready**: Pronto para ser instalado como app

## 🛠️ Tecnologias Utilizadas

- **Frontend**: TypeScript, HTML5, CSS3
- **Build**: Vite 6.2
- **IA**: Google Gemini AI (gemini-2.5-flash)
- **Markdown**: Marked.js
- **Ícones**: Font Awesome 6

## 📋 Pré-requisitos

- Node.js 16+ instalado
- Uma chave de API do Google Gemini ([obtenha aqui](https://aistudio.google.com/app/apikey))

## 🚀 Instalação e Configuração

### 1. Clone o repositório

```bash
git clone <repository-url>
cd audiotranscriptor
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure a API Key do Gemini

Crie um arquivo `.env.local` na raiz do projeto:

```bash
cp .env.local.example .env.local
```

Edite o arquivo `.env.local` e adicione sua chave:

```env
GEMINI_API_KEY=sua_chave_api_aqui
```

**Como obter a API Key:**
1. Acesse [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Faça login com sua conta Google
3. Clique em "Create API Key"
4. Copie a chave gerada

### 4. Execute o app

```bash
npm run dev
```

O app estará disponível em `http://localhost:3000`

## 📱 Como Usar

### Gravar uma Nova Nota

1. Clique no botão vermelho de microfone ou pressione `Espaço`
2. Fale claramente no microfone
3. Clique novamente para parar a gravação
4. Aguarde a transcrição e o polimento automático

### Upload de Arquivos de Áudio

**Método 1 - Botão:**
1. Clique no ícone de upload
2. Selecione um ou múltiplos arquivos de áudio
3. Aguarde o processamento

**Método 2 - Drag & Drop:**
1. Arraste arquivos de áudio para qualquer lugar da janela
2. Solte os arquivos
3. Aguarde o processamento

### Buscar Notas

1. Digite na barra de busca no topo da sidebar
2. Os resultados são filtrados em tempo real
3. Busca em títulos e conteúdo

### Exportar Notas

**Exportar Nota Atual:**
1. Clique no ícone de exportação no cabeçalho
2. Escolha o formato (Markdown, TXT ou JSON)
3. O arquivo será baixado automaticamente

**Exportar Todas as Notas:**
1. Clique no ícone de download na sidebar
2. Escolha o formato
3. Todas as notas serão exportadas em um único arquivo

### Ver Estatísticas

1. Clique no ícone de gráfico no cabeçalho
2. Visualize:
   - Contagem de palavras
   - Contagem de caracteres
   - Data de criação
   - Total de notas

## ⌨️ Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl/Cmd + N` | Nova nota |
| `Ctrl/Cmd + S` | Salvar nota (com feedback) |
| `Ctrl/Cmd + E` | Exportar nota atual (Markdown) |
| `Ctrl/Cmd + B` | Alternar sidebar |
| `Espaço` | Iniciar/parar gravação* |

*Quando não estiver editando texto

## 🎨 Personalização

### Temas

Alterne entre modo claro e escuro clicando no ícone de sol/lua nos controles de gravação.

A preferência é salva automaticamente no navegador.

### Variáveis CSS

O app usa CSS Variables para fácil customização. Edite `index.css`:

```css
:root {
  --color-accent: #82aaff;      /* Cor principal */
  --color-recording: #ff3b30;   /* Cor de gravação */
  --font-primary: 'Inter', ...;  /* Fonte principal */
  /* ... */
}
```

## 📊 Estrutura do Projeto

```
audiotranscriptor/
├── index.html          # HTML principal
├── index.tsx           # Lógica TypeScript
├── index.css           # Estilos CSS
├── vite.config.ts      # Configuração do Vite
├── tsconfig.json       # Configuração TypeScript
├── package.json        # Dependências
├── .env.local.example  # Exemplo de configuração
├── .gitignore          # Arquivos ignorados
└── README.md           # Esta documentação
```

## 🔧 Build para Produção

```bash
npm run build
```

Os arquivos otimizados estarão em `dist/`

### Preview do Build

```bash
npm run preview
```

## 🐛 Solução de Problemas

### Erro: "API Key não configurada"

**Solução:**
- Verifique se o arquivo `.env.local` existe
- Confirme que a variável `GEMINI_API_KEY` está definida
- Reinicie o servidor de desenvolvimento (`npm run dev`)

### Microfone não funciona

**Soluções:**
- Permita acesso ao microfone quando solicitado
- Verifique configurações de privacidade do navegador
- Teste em `localhost` ou `https` (necessário para APIs de mídia)
- Verifique se outro aplicativo está usando o microfone

### Arquivos de áudio não são processados

**Soluções:**
- Verifique se o arquivo é menor que 50MB
- Confirme que o formato é suportado (MP3, M4A, Opus, OGG, WAV, WebM)
- Verifique a console do navegador para erros detalhados

### Transcrição imprecisa

**Dicas:**
- Fale claramente e devagar
- Minimize ruído de fundo
- Use um microfone de qualidade
- Evite longas pausas durante a gravação

## 🔐 Segurança e Privacidade

- ✅ Todas as notas são armazenadas localmente no navegador
- ✅ Nenhum dado é enviado para servidores externos (exceto API Gemini)
- ✅ API Key é armazenada apenas em variáveis de ambiente
- ✅ Sanitização de HTML para prevenir XSS
- ✅ Validação de entrada de usuário
- ⚠️ Use HTTPS em produção

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Changelog

### v2.0.0 (2025-01-13)

**🎉 Melhorias Principais:**
- ✨ Adicionada funcionalidade de busca em notas
- 📤 Sistema de exportação (Markdown, TXT, JSON)
- 📊 Modal de estatísticas com métricas detalhadas
- 🎯 Drag & Drop para upload de arquivos
- ⌨️ Atalhos de teclado para ações comuns
- ♿ Melhorias de acessibilidade (ARIA labels)
- 🎨 Feedback visual aprimorado (toasts, animações)

**🔧 Melhorias Técnicas:**
- 📐 TypeScript mais rigoroso com tipos específicos
- 🧹 Código refatorado e organizado
- 🚀 Performance otimizada com debouncing
- 🔒 Validação e sanitização de entradas
- ✅ Tratamento de erros melhorado
- 📱 Responsividade aprimorada

### v1.0.0 (Inicial)
- 🎤 Gravação de áudio
- 📁 Upload de arquivos
- 🤖 Transcrição com Gemini AI
- 💾 Armazenamento local
- 🎨 Temas claro/escuro

## 📄 Licença

Este projeto está licenciado sob a Licença Apache 2.0 - veja o arquivo LICENSE para detalhes.

## 🙏 Agradecimentos

- Google Gemini AI pela API de transcrição
- Font Awesome pelos ícones
- Comunidade open-source

## 📧 Suporte

Para problemas, sugestões ou dúvidas:
- Abra uma [Issue](https://github.com/seu-usuario/audiotranscriptor/issues)
- Consulte a [Documentação do Gemini](https://ai.google.dev/docs)

---

**Desenvolvido com ❤️ usando Google Gemini AI**
