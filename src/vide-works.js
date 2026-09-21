import { LitElement, html, nothing } from 'lit'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'
import { fetchWork, fetchWorks, overlappingRelations } from './work-data.js'

/**
 * Root element for the works SPA island.
 */
export class VideWorks extends LitElement {
  static properties = {
    works: { state: true },
    work: { state: true },
    loading: { state: true },
    error: { state: true },
    selectedRelations: { state: true },
    selectedRelation: { state: true },
    svgPreviews: { state: true },
    collapsedRelationIds: { state: true },
    hoveredMovementId: { state: true }
  }

  constructor () {
    super()
    this.works = []
    this.work = null
    this.loading = true
    this.error = ''
    this.selectedRelations = []
    this.selectedRelation = null
    this.svgPreviews = []
    this.collapsedRelationIds = new Set()
    this.hoveredMovementId = ''
    this._config = null
    this._apiBase = ''
    this.onPopState = this.loadRoute.bind(this)
  }

  createRenderRoot () {
    return this
  }

  connectedCallback () {
    super.connectedCallback()
    window.addEventListener('popstate', this.onPopState)
  }

  disconnectedCallback () {
    window.removeEventListener('popstate', this.onPopState)
    super.disconnectedCallback()
  }

  firstUpdated () {
    this.initialize()
  }

  get config () {
    return this._config
  }

  set config (value) {
    this._config = value
  }

  render () {
    if (this.loading) return html`<p class="vide-works-status">Loading works...</p>`
    if (this.error) return html`<p class="vide-works-status vide-works-error">${this.error}</p>`
    return this.work ? this.renderWork() : this.renderWorkList()
  }

  renderWorkList () {
    return html`
      <section class="vide-works-list" aria-labelledby="works-heading">
        <h1 id="works-heading">Works</h1>
        <ol>
          ${this.works.map(work => html`
            <li>
              <button type="button" @click=${() => this.navigateToWork(work.id)}>
                <span class="vide-works-title">${work.title}</span>
                <span>${work.composer}${work.opus ? `, ${work.opus}` : ''}</span>
              </button>
            </li>
          `)}
        </ol>
      </section>
    `
  }

  renderWork () {
    return html`
      <article class="vide-work-detail">
        <button class="vide-works-back" type="button" @click=${this.navigateToList}>All works</button>
        <header>
          <h1>${this.work.title}</h1>
          <p>${this.work.composer}${this.work.opus ? `, ${this.work.opus}` : ''}</p>
        </header>
        ${this.renderTimeline()}
        ${this.selectedRelations.length > 0 ? this.renderRelations() : nothing}
      </article>
    `
  }

  renderTimeline () {
    const totalMeasures = this.work.totalMeasures || 1
    const completeMovementRelations = this.work.relations.filter(relation => this.isCompleteMovementRelation(relation))
    const restrictedRangeRelations = this.work.relations.filter(relation => !this.isCompleteMovementRelation(relation))
    return html`
      <section class="vide-work-timeline" aria-label="Work structure and related source regions">
        <div class=${`vide-work-movement-ruler${this.hoveredMovementId ? ' is-hovering' : ''}`}>
          ${this.work.movements.map(movement => html`
            <div
              class=${`vide-work-movement${movement.id === this.hoveredMovementId ? ' is-hovered' : ''}`}
              style=${`left:${(movement.offset / totalMeasures) * 100}%`}
              @mouseenter=${() => { this.hoveredMovementId = movement.id }}
              @mouseleave=${() => { this.hoveredMovementId = '' }}
            >
              <div class="vide-work-movement-label">
                <span class="vide-work-movement-title">${movement.label}</span>
                <span class="vide-work-movement-counts">Full: ${this.movementRelationCounts(movement).completeMovement}; ranges: ${this.movementRelationCounts(movement).restrictedRange}</span>
              </div>
            </div>
          `)}
          ${completeMovementRelations.length > 0
? html`
            <div class="vide-work-timeline-track vide-work-complete-movement-track">
              ${completeMovementRelations.map(relation => this.renderRelationRegion(relation, totalMeasures))}
            </div>
          `
: nothing}
          <div class="vide-work-timeline-track vide-work-restricted-range-track">
            ${restrictedRangeRelations.map(relation => this.renderRelationRegion(relation, totalMeasures))}
          </div>
        </div>
      </section>
    `
  }

  renderRelationRegion (relation, totalMeasures) {
    return html`
            <button
              class="vide-work-relation-region"
              type="button"
              aria-label=${`Show relations for ${relation.label}, ${relation.measureLabel}`}
              style=${this.relationStyle(relation, totalMeasures)}
              @click=${() => this.selectRelationRegion(relation)}
            ></button>
    `
  }

  isCompleteMovementRelation (relation) {
    const target = relation.target || {}
    const start = target.type === 'range' ? target.start : target.spot
    const end = target.type === 'range' ? target.end : target.spot
    return start?.targetType === 'mdiv' && end?.targetType === 'mdiv'
  }

  movementRelationCounts (movement) {
    const startMeasure = movement.offset
    const endMeasure = movement.offset + movement.measures - 1
    return this.work.relations.reduce((counts, relation) => {
      if (relation.startMeasure > endMeasure || relation.endMeasure < startMeasure) return counts
      if (this.isCompleteMovementRelation(relation)) counts.completeMovement++
      else counts.restrictedRange++
      return counts
    }, { completeMovement: 0, restrictedRange: 0 })
  }

  renderRelations () {
    return html`
      <section class="vide-work-relations" aria-live="polite" aria-labelledby="relations-heading">
        <h2 id="relations-heading">Relations in this region</h2>
        <ol>
          ${this.selectedRelations.map(relation => html`
            <li class="vide-work-relation">
              <button
                class="vide-work-relation-toggle"
                type="button"
                aria-label=${`${this.isRelationCollapsed(relation) ? 'Show' : 'Hide'} preview for ${relation.label}`}
                aria-expanded=${String(!this.isRelationCollapsed(relation))}
                @click=${() => this.toggleRelationPreview(relation)}
              ><span></span></button>
              <button
                type="button"
                class=${`vide-work-relation-metadata${relation.id === this.selectedRelation?.id
                  ? ' is-selected'
                  : ''}`}
                @click=${() => { this.selectedRelation = relation }}
              >
                <span>${relation.label}</span>
                <span>${relation.measureLabel}</span>
                <span>${relation.type}${relation.resp ? `, ${relation.resp.replace(/^#/, '')}` : ''}</span>
              </button>
              ${this.previewForRelation(relation) && !this.isRelationCollapsed(relation)
? html`
                <figure class="vide-work-source">
                  ${unsafeSVG(this.previewForRelation(relation).svgMarkup)}
                </figure>
              `
: nothing}
            </li>
          `)}
        </ol>
      </section>
    `
  }

  relationStyle (relation, totalMeasures) {
    const left = (relation.startMeasure / totalMeasures) * 100
    const width = ((relation.endMeasure - relation.startMeasure + 1) / totalMeasures) * 100
    return `left:${left}%;width:${width}%`
  }

  async loadRoute () {
    this.loading = true
    this.error = ''
    this.work = null
    this.hoveredMovementId = ''
    this.selectedRelations = []
    this.selectedRelation = null
    this.revokeSvgPreviews()

    try {
      const workId = this.workIdFromLocation()
      if (workId) {
        this.work = await fetchWork(this.apiBase, workId)
      } else {
        this.works = await fetchWorks(this.apiBase)
      }
    } catch (error) {
      this.error = error.message || 'Unable to load works.'
    } finally {
      this.loading = false
    }
  }

  get apiBase () {
    return this._apiBase || this.getAttribute('api-base') || ''
  }

  async initialize () {
    try {
      this._apiBase = await this.resolveApiBase()
      await this.loadRoute()
    } catch (error) {
      this.loading = false
      this.error = error.message || 'Unable to load configuration.'
    }
  }

  async resolveApiBase () {
    let apiBase = ''
    const configSrc = this.getAttribute('config-src')
    if (configSrc) {
      const response = await fetch(configSrc)
      if (!response.ok) throw new Error(`Unable to load configuration: HTTP ${response.status}`)
      apiBase = (await response.json()).apiBase || ''
    }

    const inlineConfig = this.getAttribute('config')
    if (inlineConfig) {
      apiBase = JSON.parse(inlineConfig).apiBase || apiBase
    }

    if (this._config && typeof this._config === 'object' && !Array.isArray(this._config)) {
      apiBase = this._config.apiBase || apiBase
    }

    return this.getAttribute('api-base') || apiBase
  }

  workIdFromLocation () {
    const redirectedPath = new URLSearchParams(window.location.search).get('_path')
    const path = redirectedPath ? `/works${redirectedPath}` : window.location.pathname
    const match = path.match(/\/works\/([^/]+)\/?$/)
    return match ? decodeURIComponent(match[1]) : ''
  }

  navigateToWork (workId) {
    window.history.pushState({}, '', `${this.worksBasePath()}${encodeURIComponent(workId)}/`)
    this.loadRoute()
  }

  navigateToList () {
    window.history.pushState({}, '', this.worksBasePath())
    this.loadRoute()
  }

  worksBasePath () {
    const match = window.location.pathname.match(/^(.*\/works\/)/)
    return match ? match[1] : '/works/'
  }

  async selectRelationRegion (relation) {
    const isCompleteMovement = this.isCompleteMovementRelation(relation)
    const relationsInSameLane = this.work.relations.filter(candidate => this.isCompleteMovementRelation(candidate) === isCompleteMovement)
    this.selectedRelations = overlappingRelations(relationsInSameLane, relation)
    this.selectedRelation = relation
    this.collapsedRelationIds = new Set()
    this.revokeSvgPreviews()
    const previews = await Promise.all(this.selectedRelations
      .filter(candidate => candidate.plist)
      .map(candidate => this.loadSvgPreview(candidate)))
    this.svgPreviews = previews.filter(Boolean)
  }

  async loadSvgPreview (relation) {
    try {
      const response = await fetch(relation.plist)
      if (!response.ok) return null
      const svgText = await response.text()
      return {
        relationId: relation.id,
        label: relation.label,
        svgMarkup: sanitizeSvgMarkup(svgText)
      }
    } catch (_error) {
      return null
    }
  }

  revokeSvgPreviews () {
    this.svgPreviews = []
  }

  previewForRelation (relation) {
    return this.svgPreviews.find(preview => preview.relationId === relation.id)
  }

  isRelationCollapsed (relation) {
    return this.collapsedRelationIds.has(relation.id)
  }

  toggleRelationPreview (relation) {
    const collapsedRelationIds = new Set(this.collapsedRelationIds)
    if (collapsedRelationIds.has(relation.id)) {
      collapsedRelationIds.delete(relation.id)
    } else {
      collapsedRelationIds.add(relation.id)
    }
    this.collapsedRelationIds = collapsedRelationIds
  }
}

function sanitizeSvgMarkup (svgText) {
  const document = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const svg = document.documentElement
  if (svg.localName !== 'svg' || document.querySelector('parsererror')) return ''

  svg.querySelectorAll('script, foreignObject').forEach(element => element.remove())
  svg.querySelectorAll('*').forEach(element => {
    Array.from(element.attributes).forEach(attribute => {
      if (attribute.name.toLowerCase().startsWith('on')) element.removeAttribute(attribute.name)
    })
  })

  return new XMLSerializer().serializeToString(svg)
}
