import { describe, expect, it } from 'vitest'
import { fetchWork, fetchWorks, normalizeWork, overlappingRelations } from '../src/work-data.js'

const rawWork = {
  id: 'work-1',
  movements: [
    { id: 'one', label: 'I. Allegro', measures: 10 },
    { id: 'two', label: 'II. Adagio', measures: 20 }
  ],
  relations: [
    {
      id: 'relation-a',
      type: 'isRelatedTo_from_to',
      plist: '/one.svg',
      target: {
        type: 'range',
        start: { mdivPos: 1, targetPos: 4, targetType: 'measure', mdivLabel: 'I. Allegro' },
        end: { mdivPos: 2, targetPos: 3, targetType: 'measure', mdivLabel: 'II. Adagio' }
      }
    },
    {
      id: 'relation-b',
      type: 'isRelatedTo',
      plist: '/two.svg',
      target: {
        type: 'spot',
        spot: { mdivPos: 2, targetPos: 2, targetType: 'measure', mdivLabel: 'II. Adagio' }
      }
    }
  ]
}

describe('normalizeWork', () => {
  it('maps movement and relation positions into absolute measures', () => {
    const work = normalizeWork({
      ...rawWork,
      relations: [{
        ...rawWork.relations[0],
        plist: 'https://api.test/documents/prerendered/one.svg'
      }, rawWork.relations[1]]
    })

    expect(work.totalMeasures).toBe(30)
    expect(work.movements.map(movement => movement.offset)).toEqual([0, 10])
    expect(work.relations[0]).toMatchObject({
      startMeasure: 3,
      endMeasure: 12,
      label: 'I. Allegro',
      measureLabel: 'Measures 4-3',
      plist: 'https://api.test/document/prerendered/one.svg'
    })
    expect(work.relations[1]).toMatchObject({ startMeasure: 11, endMeasure: 11 })
  })

  it('finds relations whose visual spans overlap', () => {
    const work = normalizeWork(rawWork)

    expect(overlappingRelations(work.relations, work.relations[0]).map(relation => relation.id)).toEqual([
      'relation-a',
      'relation-b'
    ])
  })

  it('loads the collection and an individual work from the API base', async () => {
    const fetchImpl = async url => ({
      ok: true,
      json: async () => url.endsWith('works.json') ? [{ id: 'work-1' }] : rawWork
    })

    await expect(fetchWorks('http://api.test/', fetchImpl)).resolves.toEqual([{ id: 'work-1' }])
    await expect(fetchWork('http://api.test/', 'work 1', fetchImpl)).resolves.toMatchObject({
      id: 'work-1',
      totalMeasures: 30
    })
  })

  it('rejects failed requests and ignores relations without a timeline position', async () => {
    await expect(fetchWorks('http://api.test', async () => ({ ok: false, status: 503 }))).rejects.toThrow('HTTP 503')

    const work = normalizeWork({
      movements: [{ measures: 2 }],
      relations: [{ target: { type: 'spot', spot: {} } }]
    })

    expect(work.relations).toEqual([])
  })

  it('normalizes complete-movement spans and safely skips unusable targets', () => {
    const work = normalizeWork({
      movements: [{ measures: 4 }, { measures: 6 }],
      relations: [
        {
          id: 'movement-span',
          target: {
            type: 'range',
            start: { mdivPos: 2, targetType: 'mdiv' },
            end: { mdivPos: 2, targetType: 'mdiv' }
          }
        },
        { id: 'missing-target' },
        { id: 'unknown-movement', target: { type: 'spot', spot: { mdivPos: 8 } } }
      ]
    })

    expect(work.relations).toHaveLength(1)
    expect(work.relations[0]).toMatchObject({
      startMeasure: 4,
      endMeasure: 9,
      label: '',
      measureLabel: 'Measures 1-1'
    })
  })

  it('accepts empty payload collections and bounds measure positions to their movement', () => {
    expect(normalizeWork({})).toMatchObject({
      movements: [],
      relations: [],
      totalMeasures: 0
    })

    const work = normalizeWork({
      movements: [{ measures: 3 }],
      relations: [{
        target: {
          type: 'spot',
          spot: { mdivPos: 1, targetPos: 99, targetType: 'measure' }
        }
      }]
    })

    expect(work.relations[0]).toMatchObject({ startMeasure: 2, endMeasure: 2, measureLabel: 'Measure 99' })
  })
})
