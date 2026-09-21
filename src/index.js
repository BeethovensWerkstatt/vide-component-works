/**
 * Works Web Component entry point.
 */
import { VideWorks } from './vide-works.js'

if (!customElements.get('vide-works')) {
  customElements.define('vide-works', VideWorks)
}

export { VideWorks }
