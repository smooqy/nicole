# Deploy no cPanel

Este projeto esta pronto para rodar em cPanel com Apache + PHP.

## Arquivos importantes

- `pressel/index.html`: primeira pagina de verificacao.
- `index.html`: checkout original, aberto depois do botao da pressel.
- `up1/`, `up2/`, `up3/`, `up4/`: upsells de taxas apos o pagamento principal.
- `.htaccess`: cria as rotas `/api/pix/create`, `/api/pix/:id` e `/api/qr`.
- `.env`: guarda a chave da NexusPag.
- `api/`: endpoints PHP que geram o PIX e consultam status.
- `pix-create.php`, `pix-status.php`, `qr.php`: endpoints diretos para hospedagens cPanel que nao aplicam rewrite em subpastas.

## Como subir

1. No cPanel, abra `File Manager`.
2. Entre em `public_html`.
3. Envie todos os arquivos desta pasta para `public_html`.
4. Confirme que o arquivo `.htaccess` foi junto.
5. Confirme que o arquivo `.env` foi junto.
6. Abra o site. A primeira tela deve ser a verificacao da pasta `pressel`.
7. Clique no botao da pressel. Ele deve redirecionar para `/index.html`.
8. No checkout original, teste o botao `Gerar PIX`.
9. Fluxo esperado apos pagamentos confirmados: `index.html` -> `up1` -> `up2` -> `up3` -> `up4`.

## Variavel obrigatoria

O arquivo `.env` precisa ter:

```env
NEXUSPAG_API_KEY=sua_chave_da_nexus
```

O `.htaccess` bloqueia acesso publico ao `.env`.

## Requisitos da hospedagem

- PHP 7.4 ou superior.
- Extensao `curl` habilitada, ou `allow_url_fopen` habilitado.
- Apache com `mod_rewrite` habilitado.
