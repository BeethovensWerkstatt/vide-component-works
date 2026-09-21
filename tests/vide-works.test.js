import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VideWorks } from '../src/vide-works.js'

if (!customElements.get('vide-works')) {
  customElements.define('vide-works', VideWorks)
}

const work = {
  id: 'work-1',
  title: 'Test work',
  composer: 'Composer',
  movements: [{ id: 'one', label: 'I. Allegro', measures: 10 }],
  relations: [{
    id: 'relation-1',
    type: 'isRelatedTo',
    plist: '/source.svg',
    target: {
      type: 'spot',
      spot: { mdivPos: 1, targetPos: 2, targetType: 'measure', mdivLabel: 'I. Allegro' }
    }
  }]
}

describe('VideWorks', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    window.history.replaceState({}, '', '/works/')
    vi.restoreAllMocks()
  })

  it('loads and links the available works', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'work-1', title: 'Test work', composer: 'Composer' }]
    }))
    const element = document.createElement('vide-works')
    element.setAttribute('api-base', 'http://api.test')
    document.body.appendChild(element)

    await element.updateComplete
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fetch).toHaveBeenCalledWith('http://api.test/works.json')
    expect(element.querySelector('.vide-works-title').textContent).toBe('Test work')
  })

  it('renders corrected SVG previews for every relation in the selected region', async () => {
    window.history.replaceState({}, '', '/works/work-1/')
    vi.stubGlobal('fetch', vi.fn(url => {
      if (url.includes('/works/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ...work,
            relations: [
              { ...work.relations[0], plist: 'https://api.test/documents/prerendered/one.svg' },
              {
                ...work.relations[0],
                id: 'relation-2',
                plist: 'https://api.test/documents/prerendered/two.svg'
              }
            ]
          })
        })
      }
      return Promise.resolve({ ok: true, text: async () => '<svg><path class="supplied"></path></svg>' })
    }))
    const element = document.createElement('vide-works')
    element.setAttribute('api-base', 'http://api.test')
    document.body.appendChild(element)

    await element.updateComplete
    await new Promise(resolve => setTimeout(resolve, 0))
    await element.updateComplete

    await element.selectRelationRegion(element.work.relations[0])
    await element.updateComplete

    expect(element.querySelectorAll('.vide-work-relation-region')).toHaveLength(2)
    expect(element.querySelector('.vide-work-relations')).toBeTruthy()
    expect([...element.querySelectorAll('.vide-work-relation')].map(entry => entry.querySelectorAll('.vide-work-source svg').length)).toEqual([1, 1])
    expect(element.querySelectorAll('.vide-work-source .supplied')).toHaveLength(2)
    expect(fetch).toHaveBeenCalledWith('https://api.test/document/prerendered/one.svg')
    expect(fetch).toHaveBeenCalledWith('https://api.test/document/prerendered/two.svg')

    element.querySelector('.vide-work-relation-toggle').click()
    await element.updateComplete

    expect(element.querySelector('.vide-work-relation-toggle').getAttribute('aria-expanded')).toBe('false')
    expect(element.querySelectorAll('.vide-work-source svg')).toHaveLength(1)
  })

  it('navigates back to the work list and displays API errors', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => work })
      .mockResolvedValueOnce({ ok: false, status: 500 }))
    window.history.replaceState({}, '', '/works/work-1/')
    const element = document.createElement('vide-works')
    element.setAttribute('api-base', 'http://api.test/')
    document.body.appendChild(element)

    await element.updateComplete
    await new Promise(resolve => setTimeout(resolve, 0))
    element.querySelector('.vide-works-back').click()
    await new Promise(resolve => setTimeout(resolve, 0))
    await element.updateComplete

    expect(window.location.pathname).toBe('/works/')
    expect(element.querySelector('.vide-works-error').textContent).toContain('HTTP 500')
  })

  it('loads config-src before fetching works and lets api-base override it', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ apiBase: 'http://config.test' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] }))
    const element = document.createElement('vide-works')
    element.setAttribute('config-src', '/works-config.json')
    element.setAttribute('api-base', 'http://override.test')
    document.body.appendChild(element)

    await element.updateComplete
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fetch).toHaveBeenNthCalledWith(1, '/works-config.json')
    expect(fetch).toHaveBeenNthCalledWith(2, 'http://override.test/works.json')
  })

  it('uses inline and programmatic configuration when no api-base attribute is set', async () => {
    const element = document.createElement('vide-works')
    element.setAttribute('config', '{"apiBase":"http://inline.test"}')

    expect(await element.resolveApiBase()).toBe('http://inline.test')

    element.config = { apiBase: 'http://programmatic.test' }
    expect(await element.resolveApiBase()).toBe('http://programmatic.test')
  })

  it('shows a configuration loading failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const element = document.createElement('vide-works')
    element.setAttribute('config-src', '/missing-config.json')
    document.body.appendChild(element)

    await element.updateComplete
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(element.querySelector('.vide-works-error').textContent).toContain('HTTP 404')
  })

  it('does not render an image for a selected relation without a source SVG', async () => {
    const workWithoutSource = {
      ...work,
      relations: [{
        ...work.relations[0],
        id: 'relation-without-source',
        plist: ''
      }]
    }
    window.history.replaceState({}, '', '/works/work-1/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => workWithoutSource }))
    const element = document.createElement('vide-works')
    element.setAttribute('api-base', 'http://api.test')
    document.body.appendChild(element)

    await element.updateComplete
    await new Promise(resolve => setTimeout(resolve, 0))
    element.querySelector('.vide-work-relation-region').click()
    await element.updateComplete

    expect(element.querySelector('.vide-work-source')).toBeNull()
  })

  it('separates complete-movement and restricted-range sketch markers', async () => {
    const workWithMovementSketch = {
      ...work,
      relations: [
        {
          ...work.relations[0],
          id: 'movement-sketch',
          target: {
            type: 'spot',
            spot: { mdivPos: 1, targetType: 'mdiv', mdivLabel: 'I. Allegro' }
          }
        },
        work.relations[0]
      ]
    }
    window.history.replaceState({}, '', '/works/work-1/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => workWithMovementSketch }))
    const element = document.createElement('vide-works')
    element.setAttribute('api-base', 'http://api.test')
    document.body.appendChild(element)

    await element.updateComplete
    await new Promise(resolve => setTimeout(resolve, 0))
    await element.updateComplete

    expect(element.querySelectorAll('.vide-work-movement-ruler')).toHaveLength(1)
    expect(element.querySelectorAll('.vide-work-complete-movement-track .vide-work-relation-region')).toHaveLength(1)
    expect(element.querySelectorAll('.vide-work-restricted-range-track .vide-work-relation-region')).toHaveLength(1)
  })

  it('opens only overlapping relations from the selected timeline lane', async () => {
    const workWithBothRelationTypes = {
      ...work,
      relations: [
        {
          ...work.relations[0],
          id: 'movement-sketch',
          target: {
            type: 'spot',
            spot: { mdivPos: 1, targetType: 'mdiv', mdivLabel: 'I. Allegro' }
          }
        },
        {
          ...work.relations[0],
          id: 'range-sketch',
          target: {
            type: 'spot',
            spot: { mdivPos: 1, targetPos: 2, targetType: 'measure', mdivLabel: 'I. Allegro' }
          }
        }
      ]
    }
    window.history.replaceState({}, '', '/works/work-1/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => workWithBothRelationTypes }))
    const element = document.createElement('vide-works')
    element.setAttribute('api-base', 'http://api.test')
    document.body.appendChild(element)

    await element.updateComplete
    await new Promise(resolve => setTimeout(resolve, 0))
    await element.selectRelationRegion(element.work.relations[0])

    expect(element.selectedRelations.map(relation => relation.id)).toEqual(['movement-sketch'])

    await element.selectRelationRegion(element.work.relations[1])

    expect(element.selectedRelations.map(relation => relation.id)).toEqual(['range-sketch'])
  })

  it('dims other movements and shows complete-movement and range sketch counts on hover', async () => {
    const workWithMovementSketches = {
      ...work,
      movements: [
        { id: 'one', label: 'I. Allegro', measures: 10 },
        { id: 'two', label: 'II. Adagio', measures: 10 }
      ],
      relations: [
        {
          ...work.relations[0],
          id: 'movement-sketch',
          target: {
            type: 'spot',
            spot: { mdivPos: 1, targetType: 'mdiv', mdivLabel: 'I. Allegro' }
          }
        },
        work.relations[0]
      ]
    }
    window.history.replaceState({}, '', '/works/work-1/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => workWithMovementSketches }))
    const element = document.createElement('vide-works')
    element.setAttribute('api-base', 'http://api.test')
    document.body.appendChild(element)

    await element.updateComplete
    await new Promise(resolve => setTimeout(resolve, 0))
    const [firstMovement, secondMovement] = element.querySelectorAll('.vide-work-movement')
    firstMovement.dispatchEvent(new MouseEvent('mouseenter'))
    await element.updateComplete

    expect(firstMovement.classList).toContain('is-hovered')
    expect(secondMovement.classList).not.toContain('is-hovered')
    expect(element.querySelector('.vide-work-movement-ruler').classList).toContain('is-hovering')
    expect(firstMovement.querySelector('.vide-work-movement-title').textContent).toBe('I. Allegro')
    expect(firstMovement.querySelector('.vide-work-movement-counts').textContent).toBe('Full: 1; ranges: 1')

    firstMovement.dispatchEvent(new MouseEvent('mouseleave'))
    await element.updateComplete

    expect(element.querySelector('.vide-work-movement-ruler').classList).not.toContain('is-hovering')
  })

  it('restores a work route redirected through the static-host fallback', () => {
    window.history.replaceState({}, '', '/works/?_path=%2Fwork-1')
    const element = document.createElement('vide-works')

    expect(element.workIdFromLocation()).toBe('work-1')
  })
})
