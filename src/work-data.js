/**
 * API and data-normalization helpers for the works island.
 */

/**
 * Fetches the work list.
 *
 * @param {string} apiBase API base URL.
 * @param {typeof fetch} fetchImpl Fetch implementation.
 * @returns {Promise<object[]>} Available works.
 */
export async function fetchWorks (apiBase, fetchImpl = fetch) {
  return fetchJson(`${trimApiBase(apiBase)}/works.json`, fetchImpl)
}

/**
 * Fetches and normalizes a single work.
 *
 * @param {string} apiBase API base URL.
 * @param {string} workId Work identifier.
 * @param {typeof fetch} fetchImpl Fetch implementation.
 * @returns {Promise<object>} Normalized work.
 */
export async function fetchWork (apiBase, workId, fetchImpl = fetch) {
  const work = await fetchJson(`${trimApiBase(apiBase)}/works/${encodeURIComponent(workId)}.json`, fetchImpl)
  return normalizeWork(work)
}

/**
 * Converts API relation positions into measure offsets suitable for rendering.
 *
 * @param {object} work Raw work payload.
 * @returns {object} Work with normalized movements and relations.
 */
export function normalizeWork (work) {
  const movements = Array.isArray(work.movements) ? work.movements : []
  const offsets = movements.reduce((result, _movement) => {
    result.push(result.length === 0 ? 0 : result[result.length - 1] + movements[result.length - 1].measures)
    return result
  }, [])
  const totalMeasures = movements.reduce((total, movement) => total + Number(movement.measures || 0), 0)

  return {
    ...work,
    movements: movements.map((movement, index) => ({
      ...movement,
      offset: offsets[index],
      measures: Number(movement.measures || 0)
    })),
    totalMeasures,
    relations: (Array.isArray(work.relations) ? work.relations : [])
      .map(relation => normalizeRelation(relation, movements, offsets))
      .filter(Boolean)
  }
}

/**
 * Returns every relation whose measure span intersects the given one.
 *
 * @param {object[]} relations Normalized relations.
 * @param {object} selectedRelation Selected relation.
 * @returns {object[]} Intersecting relations.
 */
export function overlappingRelations (relations, selectedRelation) {
  return relations.filter(relation => relation.startMeasure <= selectedRelation.endMeasure && relation.endMeasure >= selectedRelation.startMeasure)
}

async function fetchJson (url, fetchImpl) {
  const response = await fetchImpl(url)
  if (!response.ok) {
    throw new Error(`Unable to load ${url}: HTTP ${response.status}`)
  }
  return response.json()
}

function trimApiBase (apiBase) {
  return String(apiBase || '').replace(/\/$/, '')
}

function normalizeRelation (relation, movements, offsets) {
  const target = relation.target || {}
  const start = target.type === 'range' ? target.start : target.spot
  const end = target.type === 'range' ? target.end : target.spot
  const startMeasure = measurePosition(start, movements, offsets, false)
  const endMeasure = measurePosition(end, movements, offsets, true)

  if (startMeasure === null || endMeasure === null) return null

  return {
    ...relation,
    plist: normalizePrerenderedSvgUrl(relation.plist),
    startMeasure: Math.min(startMeasure, endMeasure),
    endMeasure: Math.max(startMeasure, endMeasure),
    label: start.mdivLabel || '',
    measureLabel: target.type === 'range'
      ? `Measures ${start.targetPos || 1}-${end.targetPos || 1}`
      : `Measure ${start.targetPos || 1}`
  }
}

function normalizePrerenderedSvgUrl (url) {
  return typeof url === 'string' ? url.replace('/documents/', '/document/') : ''
}

function measurePosition (point, movements, offsets, isEnd) {
  if (!point || !Number.isInteger(point.mdivPos)) return null

  const movementIndex = point.mdivPos - 1
  const movement = movements[movementIndex]
  if (!movement) return null

  const localPosition = point.targetType === 'mdiv'
    ? (isEnd ? Number(movement.measures || 1) : 1)
    : Number(point.targetPos || 1)
  const boundedPosition = Math.max(1, Math.min(localPosition, Number(movement.measures || 1)))
  return offsets[movementIndex] + boundedPosition - 1
}
