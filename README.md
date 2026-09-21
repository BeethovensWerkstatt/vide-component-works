# vide-component-works

Lit-based SPA island for browsing Beethoven works and their relations to prerendered transcriptions.

## Usage

Load the compiled stylesheet and module, then add the custom element:

```html
<link rel="stylesheet" href="vide-component-works/dist/vide-works.css">
<vide-works api-base="http://localhost:8080/exist/apps/api"></vide-works>
<script type="module" src="vide-component-works/dist/index.js"></script>
```

The element displays `/works/` as an index and `/works/{id}/` as a work detail page. Configure the API with `api-base`, a JSON `config` attribute, a JSON `config-src` resource, or the JavaScript `config` property. An `api-base` attribute has the highest precedence.

## Development

```sh
npm install
npm run lint
npm run test:coverage
npm run build
```